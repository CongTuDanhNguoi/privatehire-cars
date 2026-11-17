// Customer side: own bookings, sending an enquiry, listing own enquiries.
// A customer can only ever read or reference their own bookings and enquiries.
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { validationError } from "../errors.js";
import { ENQUIRY_MESSAGES, validateEnquiry, type EnquiryForm } from "../../../src/validation/enquiryValidation";
import { enquiryCode } from "../validation/reply.js";

export interface Booking {
  id: number;
  bookingRef: string;
  serviceName: string;
  pickupLocation: string;
  destination: string;
  journeyDateTime: Date;
  passengerCount: number;
  vehicleSize: string;
}

interface BookingRow extends RowDataPacket {
  id: number;
  booking_ref: string;
  service_name: string;
  pickup_location: string;
  destination: string;
  journey_datetime: Date;
  passenger_count: number;
  vehicle_size: string;
}

export const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  bookingRef: r.booking_ref,
  serviceName: r.service_name,
  pickupLocation: r.pickup_location,
  destination: r.destination,
  journeyDateTime: r.journey_datetime,
  passengerCount: r.passenger_count,
  vehicleSize: r.vehicle_size,
});

export async function listCustomerBookings(customerId: number): Promise<Booking[]> {
  const [rows] = await pool.execute<BookingRow[]>(
    `SELECT id, booking_ref, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size
     FROM bookings WHERE customer_id = ? ORDER BY journey_datetime ASC`,
    [customerId],
  );
  return rows.map(toBooking);
}

export async function createEnquiry(customerId: number, form: EnquiryForm) {
  const errors = validateEnquiry(form);
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const type = form.type as "GENERAL" | "TRIP";
  // GENERAL enquiries are never linked to a booking; TRIP ones must use the customer's own booking.
  const bookingId = type === "TRIP" ? form.bookingId : null;
  if (type === "TRIP") {
    const [own] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM bookings WHERE id = ? AND customer_id = ?", [
      bookingId,
      customerId,
    ]);
    if (own.length === 0) throw validationError({ bookingId: ENQUIRY_MESSAGES.bookingRequired });
  }

  const [r] = await pool.execute<ResultSetHeader>(
    "INSERT INTO enquiries (customer_id, type, booking_id, subject, message) VALUES (?, ?, ?, ?, ?)",
    [customerId, type, bookingId, form.subject.trim(), form.message.trim()],
  );
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT status, created_at FROM enquiries WHERE id = ?", [r.insertId]);
  return { id: r.insertId, code: enquiryCode(r.insertId), status: rows[0].status as string, createdAt: rows[0].created_at as Date };
}

export async function listCustomerEnquiries(customerId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, type, subject, status, created_at FROM enquiries WHERE customer_id = ? ORDER BY created_at DESC, id DESC",
    [customerId],
  );
  return rows.map((r) => ({
    id: r.id as number,
    code: enquiryCode(r.id),
    type: r.type as string,
    subject: r.subject as string,
    status: r.status as string,
    createdAt: r.created_at as Date,
  }));
}
