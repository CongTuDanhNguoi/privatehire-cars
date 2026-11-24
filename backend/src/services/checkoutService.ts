// Checkout (SCRUM-72…90): đọc chuyến đã lưu của khách và "thanh toán" giả lập.
// Giá luôn do server tính (quoteFare). Khi đã thanh toán, giá và trạng thái được chốt trong bookings.
// Không lưu số thẻ: chỉ dùng 4 số cuối đã có trong customers.
import { randomInt } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { AppError, validationError } from "../errors.js";
import { sendEmail } from "../email/index.js";
import { formatGbp, quoteFare, type FareQuote } from "../../../app/src/data/pricing";
import { normalizePhone, validateNotifyPhone } from "../../../app/src/validation/checkoutValidation";
import { isReservedTestEmail } from "./emailVerificationService.js";
import { toBooking, type Booking } from "./customerEnquiryService.js";

export interface CheckoutBooking extends Booking {
  status: "SAVED" | "PAID";
  fare: FareQuote;
  notifyPhone: string | null;
  paymentRef: string | null;
  paidAt: Date | null;
  cardLast4: string | null;
  customerPhone: string | null;
}

interface CheckoutRow extends RowDataPacket {
  id: number;
  booking_ref: string;
  service_name: string;
  pickup_location: string;
  destination: string;
  journey_datetime: Date;
  passenger_count: number;
  vehicle_size: string;
  status: "SAVED" | "PAID";
  fare_pence: number | null;
  discount_pence: number | null;
  notify_phone: string | null;
  payment_ref: string | null;
  paid_at: Date | null;
  card_last4: string | null;
  customer_phone: string | null;
}

// Databases created before checkout (e.g. production) get the payment columns on first use.
let columnsReady: Promise<unknown> | null = null;
export const ensureBookingPaymentColumns = () =>
  (columnsReady ??= (async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'status'",
    );
    if (Number(rows[0].n) === 0) {
      await pool.query(`ALTER TABLE bookings
        ADD COLUMN status ENUM('SAVED','PAID') NOT NULL DEFAULT 'SAVED',
        ADD COLUMN fare_pence INT UNSIGNED NULL,
        ADD COLUMN discount_pence INT UNSIGNED NULL,
        ADD COLUMN notify_phone VARCHAR(30) NULL,
        ADD COLUMN payment_ref VARCHAR(20) NULL,
        ADD COLUMN paid_at DATETIME NULL`);
    }
  })().catch((err) => {
    columnsReady = null;
    throw err;
  }));

const SELECT_CHECKOUT = `SELECT b.id, b.booking_ref, b.service_name, b.pickup_location, b.destination, b.journey_datetime,
       b.passenger_count, b.vehicle_size, b.status, b.fare_pence, b.discount_pence, b.notify_phone, b.payment_ref, b.paid_at,
       c.card_last4, c.phone AS customer_phone
     FROM bookings b JOIN customers c ON c.id = b.customer_id
     WHERE b.booking_ref = ? AND b.customer_id = ?`;

function toCheckout(r: CheckoutRow): CheckoutBooking {
  // fare_pence = total paid, discount_pence = discount; the base is their sum.
  const fare: FareQuote | null =
    r.status === "PAID" && r.fare_pence !== null && r.discount_pence !== null
      ? { basePence: r.fare_pence + r.discount_pence, discountPence: r.discount_pence, totalPence: r.fare_pence }
      : quoteFare(r.vehicle_size);
  if (!fare) throw new Error(`No fare configured for vehicle "${r.vehicle_size}"`);
  return {
    ...toBooking(r),
    status: r.status,
    fare,
    notifyPhone: r.notify_phone,
    paymentRef: r.payment_ref,
    paidAt: r.paid_at,
    cardLast4: r.card_last4,
    customerPhone: r.customer_phone,
  };
}

// Only the customer's own booking. Anyone else's ref (or an unknown ref) is "not found".
export async function getCheckoutBooking(customerId: number, ref: string): Promise<CheckoutBooking> {
  await ensureBookingPaymentColumns();
  const [rows] = await pool.execute<CheckoutRow[]>(SELECT_CHECKOUT, [ref, customerId]);
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Booking not found.");
  return toCheckout(rows[0]);
}

// Confirmation email. Never fails the payment: returns false when it could not be sent.
async function sendConfirmation(customerId: number, booking: CheckoutBooking, paymentRef: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT full_name, email FROM customers WHERE id = ?", [customerId]);
  const customer = rows[0] as { full_name: string; email: string };
  if (isReservedTestEmail(customer.email)) return false; // example.com-style addresses are never emailed

  const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }).format(
    booking.journeyDateTime,
  );
  const result = await sendEmail({
    customerEmail: customer.email,
    customerName: customer.full_name,
    subject: `Your PrivateHire Cars booking ${booking.bookingRef} is confirmed`,
    body:
      `Thank you. We have received your payment of ${formatGbp(booking.fare.totalPence)}.\n\n` +
      `Booking reference: ${booking.bookingRef}\n` +
      `Payment reference: ${paymentRef}\n` +
      `Route: ${booking.pickupLocation} → ${booking.destination}\n` +
      `Date and time: ${when} (UK time)\n` +
      `Vehicle: ${booking.vehicleSize}\n`,
    enquiryCode: "Booking confirmation",
  });
  if (!result.ok) console.warn(`[checkout] confirmation email to ${customer.email} failed: ${result.error}`);
  return result.ok;
}

// "Pay" for a saved trip. Idempotent: paying an already-paid booking returns it unchanged.
export async function payBooking(
  customerId: number,
  ref: string,
  rawPhone: string,
): Promise<{ booking: CheckoutBooking; emailSent: boolean }> {
  const phoneError = validateNotifyPhone(rawPhone);
  if (phoneError) throw validationError({ phone: phoneError }, phoneError);

  const current = await getCheckoutBooking(customerId, ref);
  if (current.status === "PAID") return { booking: current, emailSent: false };

  const paymentRef = `TXN-${randomInt(10000, 100000)}`;
  const [r] = await pool.execute<ResultSetHeader>(
    `UPDATE bookings SET status = 'PAID', fare_pence = ?, discount_pence = ?, notify_phone = ?, payment_ref = ?, paid_at = UTC_TIMESTAMP()
     WHERE id = ? AND status = 'SAVED'`,
    [current.fare.totalPence, current.fare.discountPence, normalizePhone(rawPhone), paymentRef, current.id],
  );
  if (r.affectedRows === 0) {
    // A concurrent request paid first; return what is stored now.
    return { booking: await getCheckoutBooking(customerId, ref), emailSent: false };
  }

  const booking = await getCheckoutBooking(customerId, ref);
  const emailSent = await sendConfirmation(customerId, booking, paymentRef);
  return { booking, emailSent };
}
