// =============================================================
// PriceReviewPage — "Price Review" (Figma SCRUM-72: 05 và 08).
// Giá lấy từ server (getBooking). Nếu khách vừa đổi địa điểm (từ màn Edit Journey) thì hiện bản "Parameters Changed" (08).
// =============================================================
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import MobileFrame from "../../components/MobileFrame";
import Icon from "../../components/Icon";
import { CARD, CheckoutHeader, Chip, FareRow, Stepper, splitPlace } from "../../components/checkout/CheckoutUi";
import { getCurrentUser } from "../../services/auth";
import { formatUkDateTime, getBooking, type CheckoutBooking } from "../../services/support";
import { formatGbp } from "../../data/pricing";

// Quote shown last time, to tell "parameters changed" apart from a first look at the price.
const LAST_QUOTE_KEY = "phc_last_quote";
interface LastQuote {
  ref: string;
  totalPence: number;
  destination: string;
}

function readLastQuote(): LastQuote | null {
  try {
    const raw = sessionStorage.getItem(LAST_QUOTE_KEY);
    return raw ? (JSON.parse(raw) as LastQuote) : null;
  } catch {
    return null;
  }
}

function writeLastQuote(quote: LastQuote) {
  try {
    sessionStorage.setItem(LAST_QUOTE_KEY, JSON.stringify(quote));
  } catch {
    // Storage can be blocked (private mode); the page still works without it.
  }
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; booking: CheckoutBooking; previous: LastQuote | null };

const STEPS_PRICE = ["1. Route", "2. Vehicle", "3. Review", "4. Pay"];

export default function PriceReviewPage() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [state, setState] = useState<State>({ status: "loading" });
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    let active = true;
    void getBooking(ref).then((r) => {
      if (!active) return;
      if (!r.ok) {
        setState({ status: "error", message: r.message });
        return;
      }
      const booking = r.data.booking;
      const previous = readLastQuote();
      writeLastQuote({ ref: booking.bookingRef, totalPence: booking.fare.totalPence, destination: booking.destination });
      setState({ status: "ready", booking, previous: previous && previous.ref !== booking.bookingRef ? previous : null });
    });
    return () => {
      active = false;
    };
  }, [ref]);

  const close = () => navigate("/home");

  if (state.status === "loading") {
    return (
      <MobileFrame>
        <div role="status" className="flex flex-1 items-center justify-center text-[14px] text-[#64748b]">
          Loading your fare…
        </div>
      </MobileFrame>
    );
  }

  if (state.status === "error") {
    return (
      <MobileFrame>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" data-testid="price-review-error">
          <h1 className="text-[20px] font-bold text-[#0b2341]">{state.message}</h1>
          <button type="button" onClick={close} className="h-12 w-full cursor-pointer rounded-xl bg-[#0b2341] text-[15px] font-semibold text-white">
            Back to Home
          </button>
        </main>
      </MobileFrame>
    );
  }

  const { booking, previous } = state;
  // Paid bookings are not priced any more; show the confirmation instead.
  if (booking.status === "PAID") return <Navigate to={`/checkout/${booking.bookingRef}/success`} replace />;

  const { fare } = booking;
  const updated = previous !== null && (previous.totalPence !== fare.totalPence || previous.destination !== booking.destination);
  const [pickupName, pickupArea] = splitPlace(booking.pickupLocation);
  const [destName, destArea] = splitPlace(booking.destination);

  return (
    <MobileFrame>
      <CheckoutHeader title="PrivateHire Booking" subtitle="Review & Checkout" onBack={() => navigate("/availability")} onClose={close} avatarName={user?.fullName ?? "Guest"} />
      <div className="pt-2 pb-3">
        <Stepper items={updated ? ["1. Route", "2. Vehicle", "3. Price", "4. Pay"] : STEPS_PRICE} current={2} />
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-8" data-testid="price-review-page">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] leading-8 font-bold text-[#0b2341]">Price Review</h1>
            <p className="flex items-center gap-1.5 pt-1 text-[13px] leading-5 text-[#334155]">
              {updated ? (
                "Please review your revised itinerary and updated quote before advancing to secure checkout."
              ) : (
                <>
                  <Icon name="badgeCheck" size={15} /> Promotional pricing unlocked for your journey
                </>
              )}
            </p>
          </div>
          {updated && <Chip>● Parameters Changed</Chip>}
        </div>

        {/* Journey summary */}
        <section className={`${CARD} p-4`} aria-labelledby="journey-summary">
          <div className="flex items-center justify-between">
            <h2 id="journey-summary" className="flex items-center gap-2 text-[13px] font-bold tracking-[0.6px] text-[#0b2341] uppercase">
              <Icon name="route" size={15} /> {updated ? "Journey & Vehicle" : "Journey Summary"}
            </h2>
            <Chip>{updated ? "UPDATED" : "15% APPLIED"}</Chip>
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-xl bg-[#f8fafc] p-3 text-[13px]">
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.5px] text-[#64748b] uppercase">Pickup</p>
              <p className="font-semibold text-[#0b2341]">{pickupName}</p>
              {pickupArea && <p className="text-[#64748b]">{pickupArea}</p>}
            </div>
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.5px] text-[#64748b] uppercase">
                Destination{updated && previous?.destination !== booking.destination ? " (edited)" : ""}
              </p>
              <p className="font-semibold text-[#0b2341]">{destName}</p>
              {destArea && <p className="text-[#64748b]">{destArea}</p>}
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
            <div className="rounded-xl bg-[#f8fafc] p-3">
              <dt className="text-[#64748b]">Date &amp; Time</dt>
              <dd className="font-semibold text-[#0b2341]">
                <time dateTime={booking.journeyDateTime}>{formatUkDateTime(booking.journeyDateTime)}</time>
              </dd>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-3">
              <dt className="text-[#64748b]">{updated ? "Capacity" : "Class & Size"}</dt>
              <dd className="font-semibold text-[#0b2341]">
                {booking.vehicleSize} · {booking.passengerCount} pax
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex items-center justify-between text-[13px] font-semibold">
            <button type="button" data-testid="change-details" onClick={() => navigate(`/checkout/${booking.bookingRef}/edit`)} className="flex cursor-pointer items-center gap-1.5 text-[#0284c7]">
              <Icon name="pencil" size={14} /> Change Details
            </button>
            <button type="button" data-testid="change-vehicle" onClick={() => navigate("/vehicle")} className="flex cursor-pointer items-center gap-1.5 text-[#0284c7]">
              <Icon name="sliders" size={14} /> Change Vehicle
            </button>
          </div>
        </section>

        {/* Fare breakdown */}
        <section className={`${CARD} p-4`} aria-labelledby="fare-breakdown">
          <div className="flex items-center justify-between">
            <h2 id="fare-breakdown" className="flex items-center gap-2 text-[13px] font-bold tracking-[0.6px] text-[#0b2341] uppercase">
              <Icon name="receipt" size={15} /> Fare Breakdown
            </h2>
            <Chip>{updated ? "DELTA VIEW" : "DISCOUNT VIEW"}</Chip>
          </div>

          <div className="mt-3 flex flex-col gap-2.5">
            {updated && previous && <FareRow label="Previous Total (Reference)" value={formatGbp(previous.totalPence)} tone="struck" />}
            {updated ? (
              <FareRow label="New Original Fare" value={formatGbp(fare.basePence)} />
            ) : (
              <FareRow label="Original Standard Fare" value={formatGbp(fare.basePence)} tone="struck" />
            )}
            <FareRow label={<span data-testid="discount-label">Online Booking Discount (15%)</span>} value={`-${formatGbp(fare.discountPence)}`} tone="discount" />
          </div>

          <div className="mt-3 rounded-xl bg-[#e8f1fd] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.5px] text-[#0b2341] uppercase">New final payable amount</p>
                <p className="text-[12px] text-[#0284c7]">{updated ? "After 15% discount applied" : "All taxes & airport drop-off fees included"}</p>
              </div>
              <p data-testid="fare-total" className="text-[28px] leading-8 font-bold text-[#0b2341]">
                {formatGbp(fare.totalPence)}
              </p>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#0369a1]">
              <Icon name="check" size={13} />
              {updated ? `Total savings: you save ${formatGbp(fare.discountPence)}` : `Brilliant! You save ${formatGbp(fare.discountPence)} on this journey`}
            </p>
          </div>
        </section>

        <label className={`${CARD} flex cursor-pointer items-start gap-3 p-4 text-[13px] leading-5 text-[#334155]`}>
          <input
            type="checkbox"
            data-testid="agree-fare"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#0284c7]"
          />
          <span>
            I have reviewed and agree to the {updated ? "updated " : ""}vehicle specifications, cancellation terms, and revised fare (
            <strong>{formatGbp(fare.totalPence)}</strong>).
          </span>
        </label>

        <button
          type="button"
          data-testid="continue-to-payment"
          disabled={!agreed}
          onClick={() => navigate(`/checkout/${booking.bookingRef}/notify`)}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284c7] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
        >
          Continue to Payment <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" onClick={close} className="mx-auto cursor-pointer text-[14px] font-medium text-[#334155] hover:underline">
          Cancel Journey
        </button>
      </main>
    </MobileFrame>
  );
}
