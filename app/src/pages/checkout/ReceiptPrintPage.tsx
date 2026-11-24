// =============================================================
// ReceiptPrintPage — "Official Customer Receipt – Clean Print Preview" (Figma SCRUM-83: 15).
// Bố cục A4 để in. Thanh công cụ (print:hidden) không in ra giấy.
// =============================================================
import { Navigate, useNavigate, useParams } from "react-router-dom";
import MobileFrame from "../../components/MobileFrame";
import Icon from "../../components/Icon";
import QrMark from "../../components/checkout/QrMark";
import { CARD, Chip, splitPlace } from "../../components/checkout/CheckoutUi";
import { getCurrentUser } from "../../services/auth";
import { formatUkDateTime, ukZoneName } from "../../services/support";
import { formatGbp } from "../../data/pricing";
import { receiptNumber } from "./ReceiptPage";
import { useCheckoutBooking } from "./useCheckoutBooking";

export default function ReceiptPrintPage() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const state = useCheckoutBooking(ref);

  if (state.status === "loading") {
    return (
      <MobileFrame>
        <div role="status" className="flex flex-1 items-center justify-center text-[14px] text-[#64748b]">
          Preparing your receipt…
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

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${booking.bookingRef}`, url });
        return;
      } catch {
        // User cancelled the share sheet.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  }

  return (
    <MobileFrame>
      {/* Toolbar: not printed */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 print:hidden" data-testid="print-toolbar">
        <button type="button" onClick={() => navigate(`/receipt/${booking.bookingRef}`)} aria-label="Back to receipt" className="flex size-9 cursor-pointer items-center justify-center rounded-full text-[#0b2341] hover:bg-[#e2e8f0]">
          <Icon name="arrowLeft" size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-[#0b2341]">Tax Receipt</p>
          <p className="text-[11px] text-[#64748b]">Clean Print Preview • A4</p>
        </div>
        <button type="button" onClick={() => window.print()} aria-label="Print receipt" className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-[#0284c7] text-white">
          <Icon name="receipt" size={16} />
        </button>
        <button type="button" onClick={() => window.print()} aria-label="Download receipt as PDF" className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[#cbd5e1] text-[#0b2341]">
          <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" onClick={() => void share()} aria-label="Share receipt" className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[#cbd5e1] text-[#0b2341]">
          <Icon name="arrowUpRight" size={16} />
        </button>
      </div>

      <main className={`${CARD} mx-4 mb-6 flex flex-col gap-4 p-5 text-[#0b2341] print:mx-0 print:mb-0 print:shadow-none`} data-testid="receipt-print-page">
        <header className="flex flex-col gap-2 border-b border-[#e2e8f0] pb-4">
          <p className="flex items-center gap-2 text-[17px] font-bold uppercase">
            <Icon name="car" size={18} /> PrivateHire Cars London Ltd
          </p>
          <p className="text-[12px] font-semibold tracking-[0.5px] text-[#0284c7] uppercase">Official passenger trip receipt</p>
          <div className="flex items-center justify-between gap-3">
            <Chip>✓ PAID IN FULL</Chip>
            <span className="text-[11px] text-[#64748b]">Settled electronically</span>
          </div>
        </header>

        <section className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] p-3">
          <QrMark size={52} />
          <div className="text-[12px]">
            <p className="flex items-center gap-1 font-bold">
              <Icon name="badgeCheck" size={13} /> VERIFY OFFICIAL TRIP
            </p>
            <p className="text-[#64748b]">Scan to authenticate ride licence.</p>
          </div>
        </section>

        <section className="text-[12px] leading-5">
          <p>
            <strong>VAT Reg:</strong> GB 982 4410 29
          </p>
          <p>
            <strong>PHO Licence:</strong> PHO-4821
          </p>
          <p>
            <strong>24/7 Dispatch:</strong> +44 [0]20 7946 0991 · <strong>Support:</strong> support@privatehire.mock
          </p>
        </section>

        <section className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-[#f8fafc] p-3 text-[12.5px]">
          <p className="col-span-2 text-[11px] font-bold tracking-[0.5px] uppercase">Receipt &amp; payment ref</p>
          <span className="text-[#64748b]">Receipt No</span>
          <span className="text-right font-semibold">{receiptNumber(booking.bookingRef)}</span>
          <span className="text-[#64748b]">Booking Ref</span>
          <span className="text-right font-semibold text-[#0284c7]">#{booking.bookingRef}</span>
          <span className="text-[#64748b]">Date issued</span>
          <span className="text-right">{booking.paidAt ? formatUkDateTime(booking.paidAt) : "—"}</span>
          <span className="text-[#64748b]">Payment method</span>
          <span className="text-right">Card (•••• {booking.cardLast4 ?? "????"})</span>
          <span className="text-[#64748b]">Transaction ID</span>
          <span className="text-right font-mono">{booking.paymentRef}</span>
        </section>

        <section className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-[#f8fafc] p-3 text-[12.5px]">
          <p className="col-span-2 text-[11px] font-bold tracking-[0.5px] uppercase">Passenger &amp; chauffeur</p>
          <span className="text-[#64748b]">Lead passenger</span>
          <span className="text-right font-semibold">{name}</span>
          <span className="text-[#64748b]">Email</span>
          <span className="truncate text-right">{user?.email}</span>
          <span className="text-[#64748b]">Capacity</span>
          <span className="text-right">{booking.passengerCount} Pax</span>
          <span className="text-[#64748b]">Vehicle</span>
          <span className="text-right font-semibold">{booking.vehicleSize}</span>
        </section>

        <section className="rounded-xl bg-[#e0f2fe] p-3 text-[12.5px]">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.5px] uppercase">
            <span>Trip itinerary</span>
            <span className="font-normal normal-case">{formatUkDateTime(booking.journeyDateTime)} {ukZoneName(booking.journeyDateTime)}</span>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            <p>
              <span className="block text-[11px] text-[#0369a1]">Pickup</span>
              <strong>{pickupName}</strong>
              {pickupArea && <span className="block text-[#334155]">{pickupArea}</span>}
            </p>
            <p>
              <span className="block text-[11px] text-[#0369a1]">Destination</span>
              <strong>{destName}</strong>
              {destArea && <span className="block text-[#334155]">{destArea}</span>}
            </p>
          </div>
        </section>

        <section>
          <p className="pb-2 text-[12px] font-bold tracking-[0.5px] uppercase">Itemised tariff breakdown</p>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-left text-[#64748b]">
                <th className="py-1.5 font-semibold">Tariff item</th>
                <th className="py-1.5 text-center font-semibold">Qty</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#f1f5f9]">
                <td className="py-2">{booking.vehicleSize} base tariff</td>
                <td className="text-center">1</td>
                <td className="text-right">{formatGbp(fare.basePence)}</td>
              </tr>
              <tr className="border-b border-[#f1f5f9] text-[#0284c7]">
                <td className="py-2">Online booking discount (15%)</td>
                <td className="text-center">1</td>
                <td className="text-right">-{formatGbp(fare.discountPence)}</td>
              </tr>
              <tr className="border-b border-[#f1f5f9]">
                <td className="py-2">Airport drop-off access fee</td>
                <td className="text-center">1</td>
                <td className="text-right">£0.00 (included)</td>
              </tr>
              <tr className="border-b border-[#f1f5f9]">
                <td className="py-2">Meet &amp; greet chauffeur service</td>
                <td className="text-center">1</td>
                <td className="text-right">£0.00 (standard)</td>
              </tr>
              <tr>
                <td className="py-2">Zero-rated passenger VAT (0%)</td>
                <td className="text-center">—</td>
                <td className="text-right">£0.00</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0284c7] p-4 text-white">
            <div>
              <p className="text-[13px] font-bold uppercase">Total amount paid</p>
              <p className="text-[11px] opacity-90">Includes all applicable UK transport charges</p>
            </div>
            <p data-testid="print-total" className="text-right text-[22px] font-bold">
              {formatGbp(fare.totalPence)} <span className="block text-[11px] font-medium">GBP (Settled)</span>
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-[#e2e8f0] p-3 text-[11.5px] leading-5 text-[#334155]">
          <p>
            <strong>Carrier notice:</strong> PrivateHire Cars London Ltd operates under Transport for London (TfL) and Manchester City Council private hire operator conditions.
            This electronic customer receipt constitutes an official proof of payment and journey record. For corporate expense queries or bespoke billing schedules, contact{" "}
            <span className="text-[#0284c7]">accounts@privatehire.mock</span>.
          </p>
        </section>

        <footer className="flex items-center justify-between text-[11px] text-[#64748b]">
          <span className="flex items-center gap-1">
            <Icon name="shield" size={12} /> Digital cryptographic signature: VALID
          </span>
          <span>Page 1 of 1</span>
        </footer>

        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284c7] text-[14px] font-semibold text-white">
            <Icon name="receipt" size={15} /> Print Receipt
          </button>
        </div>
      </main>
    </MobileFrame>
  );
}
