// =============================================================
// PaymentSuccessPage — "Payment Successful" (Figma SCRUM-90 / 04 Payment Successful).
// Hiện sau khi thanh toán thành công (đọc lại từ server, nên tải lại trang vẫn đúng).
// =============================================================
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import MobileFrame from "../../components/MobileFrame";
import Icon from "../../components/Icon";
import { CARD, CheckoutHeader, Chip } from "../../components/checkout/CheckoutUi";
import { getCurrentUser } from "../../services/auth";
import { formatUkDateTime, getBooking, ukZoneName, type CheckoutBooking } from "../../services/support";
import { formatGbp } from "../../data/pricing";
import { useBooking } from "../../context/BookingContext";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; booking: CheckoutBooking };

export default function PaymentSuccessPage() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearBooking } = useBooking();
  const user = getCurrentUser();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void getBooking(ref).then((r) => {
      if (!active) return;
      setState(r.ok ? { status: "ready", booking: r.data.booking } : { status: "error", message: r.message });
    });
    return () => {
      active = false;
    };
  }, [ref]);

  if (state.status === "loading") {
    return (
      <MobileFrame>
        <div role="status" className="flex flex-1 items-center justify-center text-[14px] text-[#64748b]">
          Loading your confirmation…
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
  // Not paid yet → go back to the price review.
  if (booking.status !== "PAID") return <Navigate to={`/checkout/${booking.bookingRef}/price`} replace />;

  const emailSent = (location.state as { emailSent?: boolean } | null)?.emailSent !== false;
  const { fare } = booking;

  return (
    <MobileFrame>
      <CheckoutHeader title="Booking Review" onBack={() => navigate(`/checkout/${booking.bookingRef}/price`)} onClose={() => navigate("/home")} avatarName={user?.fullName ?? "Guest"} />

      <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-8" data-testid="payment-success-page">
        <section className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-[#e0f2fe]">
            <span className="flex size-14 items-center justify-center rounded-full bg-[#0284c7] text-white">
              <Icon name="check" size={28} strokeWidth={3} />
            </span>
          </span>
          <h1 className="text-[22px] font-bold tracking-[0.3px] text-[#0b2341] uppercase">Payment Successful</h1>
          <p className="text-[14px] leading-5 text-[#334155]">
            Your payment of <strong>{formatGbp(fare.totalPence)}</strong> has been processed successfully.
          </p>
        </section>

        <section className={`${CARD} p-4`} aria-label="Payment status">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold tracking-[0.5px] text-[#334155] uppercase">Payment status</span>
            <Chip>● Authorised &amp; Captured</Chip>
          </div>
          <dl className="mt-3 flex flex-col gap-2.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Amount Paid</dt>
              <dd className="font-bold text-[#0b2341]">{formatGbp(fare.totalPence)} GBP</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Transaction Ref</dt>
              <dd data-testid="payment-ref" className="font-mono text-[#0b2341]">{booking.paymentRef}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Booking Reference</dt>
              <dd className="font-semibold text-[#0284c7]">{booking.bookingRef}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Payment Date &amp; Time</dt>
              <dd className="text-[#0b2341]">{booking.paidAt ? `${formatUkDateTime(booking.paidAt)} ${ukZoneName(booking.paidAt)}` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Card</dt>
              <dd className="text-[#0b2341]">Card ending •••• {booking.cardLast4 ?? "????"}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2.5 text-[13px]">
              <span className="flex items-center gap-2 text-[#334155]">
                <Icon name="mail" size={14} /> Payment reference sent to email
              </span>
              <Chip tone={emailSent ? "green" : "red"}>{emailSent ? "SENT" : "PENDING"}</Chip>
            </div>
            {/* shortcut: SMS is not really sent in this prototype; the row is shown as drawn. */}
            <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2.5 text-[13px]">
              <span className="flex items-center gap-2 text-[#334155]">
                <Icon name="message" size={14} /> Journey detail sent to SMS
              </span>
              <Chip tone="green">SENT</Chip>
            </div>
          </div>

          <button
            type="button"
            data-testid="view-receipt"
            onClick={() => navigate(`/receipt/${booking.bookingRef}`)}
            className="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#e0f2fe] text-[14px] font-semibold text-[#0369a1]"
          >
            <Icon name="receipt" size={16} /> View Receipt
          </button>
        </section>

        <section className={`${CARD} flex items-center gap-3 p-4`}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0369a1]">
            <Icon name="car" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#0b2341]">{booking.vehicleSize}</p>
            <p className="truncate text-[12px] text-[#64748b]">
              {booking.pickupLocation} → {booking.destination}
            </p>
          </div>
          <Icon name="check" size={16} />
        </section>

        <button type="button" onClick={() => navigate(`/receipt/${booking.bookingRef}`)} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284c7] text-[15px] font-semibold text-white">
          Go to booking detail <Icon name="arrowRight" size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            clearBooking();
            navigate("/home");
          }}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[15px] font-semibold text-[#0b2341]"
        >
          Return to Dashboard / New Booking
        </button>
      </main>
    </MobileFrame>
  );
}
