// =============================================================
// ReceiptPage — "Receipt & Confirmation" (Figma SCRUM-83: 14 Confirmed Booking Receipt – Digital View).
// Chỉ hiện khi đã thanh toán. Số liệu lấy từ server.
// =============================================================
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import MobileFrame from "../../components/MobileFrame";
import Icon from "../../components/Icon";
import { CARD, CheckoutHeader, Chip, Stepper, initials, splitPlace } from "../../components/checkout/CheckoutUi";
import { getCurrentUser } from "../../services/auth";
import { formatUkDateTime, ukZoneName } from "../../services/support";
import { formatGbp } from "../../data/pricing";
import { useCheckoutBooking } from "./useCheckoutBooking";

// Receipt number is derived from the booking reference (PHC-24051 → REC-24051).
export const receiptNumber = (bookingRef: string) => `REC-${bookingRef.replace(/\D/g, "")}`;

export default function ReceiptPage() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const state = useCheckoutBooking(ref);
  const [copied, setCopied] = useState(false);

  if (state.status === "loading") {
    return (
      <MobileFrame>
        <div role="status" className="flex flex-1 items-center justify-center text-[14px] text-[#64748b]">
          Loading your receipt…
        </div>
      </MobileFrame>
    );
  }
  if (state.status === "error") {
    return (
      <MobileFrame>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-[20px] font-bold text-[#0b2341]">{state.message}</h1>
          <button type="button" onClick={() => navigate("/home")} className="h-12 w-full cursor-pointer rounded-xl bg-[#0b2341] text-[15px] font-semibold text-white">
            Back to Home
          </button>
        </main>
      </MobileFrame>
    );
  }

  const { booking } = state;
  if (booking.status !== "PAID") return <Navigate to={`/checkout/${booking.bookingRef}/price`} replace />;

  const { fare } = booking;
  const name = user?.fullName ?? "Guest";
  const [pickupName, pickupArea] = splitPlace(booking.pickupLocation);
  const [destName, destArea] = splitPlace(booking.destination);
  const toAirport = /airport/i.test(booking.destination);

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(booking.bookingRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the reference is still on screen.
    }
  }

  return (
    <MobileFrame>
      <CheckoutHeader
        title="Receipt & Confirmation"
        onBack={() => navigate(`/checkout/${booking.bookingRef}/success`)}
        onClose={() => navigate("/home")}
        avatarName={name}
      />
      <div className="pt-1 pb-3">
        <Stepper items={["Route", "Vehicle", "Price", "Paid"]} current={4} />
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-8" data-testid="receipt-page">
        <section className="flex items-center justify-between rounded-2xl bg-[#e0f2fe] p-4">
          <p className="flex items-center gap-2 text-[14px] font-bold text-[#0b2341]">
            <Icon name="badgeCheck" size={16} /> RECEIPT #{receiptNumber(booking.bookingRef)}
          </p>
          <Chip>● PAID &amp; CONFIRMED</Chip>
        </section>

        <section className={`${CARD} flex items-center justify-between p-4`}>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase">Booking reference</p>
            <p className="text-[20px] font-bold text-[#0b2341]">#{booking.bookingRef}</p>
          </div>
          <button type="button" onClick={copyRef} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#cbd5e1] px-3 text-[13px] font-semibold text-[#0b2341]">
            <Icon name="clipboard" size={14} /> {copied ? "Copied" : "Copy"}
          </button>
        </section>

        <section className={`${CARD} flex items-center gap-3 p-4`}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#cfe3fb] text-[14px] font-bold text-[#0b2341]">{initials(name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#0b2341]">{name}</p>
            <p className="truncate text-[12.5px] text-[#64748b]">{user?.email}</p>
          </div>
          <Chip>
            <Icon name="users" size={11} /> {booking.passengerCount} Pax
          </Chip>
        </section>

        <section className={`${CARD} p-4`}>
          <p className="text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase">Journey date &amp; pickup time</p>
          <p className="pt-0.5 text-[15px] font-bold text-[#0b2341]">
            <time dateTime={booking.journeyDateTime}>{formatUkDateTime(booking.journeyDateTime)}</time> <span className="text-[12px] font-medium text-[#64748b]">{ukZoneName(booking.journeyDateTime)}</span>
          </p>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase">Trip trajectory</p>
          <div className="mt-2 flex flex-col gap-3 border-l-2 border-[#0284c7] pl-4">
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.5px] text-[#0284c7] uppercase">Pickup location</p>
              <p className="text-[14px] font-semibold text-[#0b2341]">{pickupName}</p>
              {pickupArea && <p className="text-[12px] text-[#64748b]">{pickupArea}</p>}
            </div>
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.5px] text-[#0284c7] uppercase">{toAirport ? "Destination airport" : "Destination"}</p>
              <p className="text-[14px] font-semibold text-[#0b2341]">{destName}</p>
              {destArea && <p className="text-[12px] text-[#64748b]">{destArea}</p>}
            </div>
          </div>
        </section>

        <section className={`${CARD} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase">Assigned fleet</p>
            <Chip>LUXURY CLASS</Chip>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f8fafc] p-3">
            <span className="flex size-12 items-center justify-center rounded-lg bg-[#cfe3fb] text-[#0b2341]">
              <Icon name="car" size={20} />
            </span>
            <div>
              <p className="text-[14px] font-bold text-[#0b2341]">{booking.vehicleSize}</p>
              <p className="text-[12px] text-[#64748b]">Chauffeur-driven private hire · {booking.passengerCount} passengers</p>
            </div>
          </div>
        </section>

        <section className={`${CARD} p-4`} aria-labelledby="receipt-fare">
          <div className="flex items-center justify-between">
            <h2 id="receipt-fare" className="text-[15px] font-bold text-[#0b2341]">Fare Breakdown</h2>
            <span className="flex items-center gap-1 text-[11px] text-[#64748b]">
              <Icon name="lock" size={11} /> Secure Invoice
            </span>
          </div>
          <dl className="mt-3 flex flex-col gap-2.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[#334155]">{booking.vehicleSize} Base Tariff</dt>
              <dd className="font-semibold text-[#0b2341]">{formatGbp(fare.basePence)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-[#dc2626]">Online Booking Discount (15%)</dt>
              <dd className="font-semibold text-[#dc2626]">-{formatGbp(fare.discountPence)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#334155]">Airport Drop-off Terminal Access Fee</dt>
              <dd className="rounded bg-[#e0f2fe] px-2 text-[12px] text-[#0369a1]">Included (£0.00)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#334155]">Meet &amp; Greet Chauffeur Service</dt>
              <dd className="rounded bg-[#e0f2fe] px-2 text-[12px] text-[#0369a1]">Standard (£0.00)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#334155]">Zero-Rated Passenger VAT</dt>
              <dd className="text-[#0b2341]">£0.00</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-xl bg-[#e8f1fd] p-4">
            <div className="flex items-end justify-between">
              <p className="text-[13px] font-bold tracking-[0.3px] text-[#0b2341] uppercase">Total amount paid</p>
              <p data-testid="receipt-total" className="text-[24px] font-bold text-[#0b2341]">
                {formatGbp(fare.totalPence)} <span className="text-[12px] font-medium">GBP</span>
              </p>
            </div>
            <p className="mt-2 flex items-center gap-2 text-[12px] text-[#334155]">
              Paid via card ending in •••• {booking.cardLast4 ?? "????"}
            </p>
          </div>
        </section>

        <button type="button" onClick={() => navigate(`/receipt/${booking.bookingRef}/print`)} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284c7] text-[15px] font-semibold text-white">
          <Icon name="receipt" size={16} /> PRINT OFFICIAL RECEIPT
        </button>
        <button type="button" onClick={() => navigate(`/checkout/${booking.bookingRef}/success`)} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#cbd5e1] bg-white text-[14px] font-semibold text-[#0b2341]">
          RETURN TO BOOKING CONFIRMATION
        </button>

        {/* Carrier footer: fixed company text, copied from the design. */}
        <footer className="flex flex-col items-center gap-1 pt-2 text-center text-[11.5px] leading-4 text-[#475569]">
          <p>Carrier: PrivateHire Cars London Ltd under TfL &amp; Manchester City Council</p>
          <p>Licensed Operator Licence: PHO-4821 • VAT Reg: GB 982 4410 29</p>
          <p>
            24/7 Priority Dispatch Desk: <span className="text-[#0284c7]">+44 [0]20 7946 0991</span>
          </p>
        </footer>
      </main>
    </MobileFrame>
  );
}
