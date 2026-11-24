// =============================================================
// EditJourneyPage — "Edit Journey - Location Parameters" (Figma SCRUM-72: 05A).
// Chỉ đổi điểm đón / điểm đến. Ngày, giờ, xe và số khách bị khóa như trong thiết kế.
// Lưu = tạo chuyến mới với địa điểm mới (saveTrip), rồi sang Price Review của chuyến đó.
// =============================================================
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import MobileFrame from "../../components/MobileFrame";
import Icon from "../../components/Icon";
import { CARD, CheckoutHeader, Chip, splitPlace } from "../../components/checkout/CheckoutUi";
import { getCurrentUser } from "../../services/auth";
import { getBooking, saveTrip, type CheckoutBooking } from "../../services/support";
import { DESTINATION_SUGGESTIONS, PICKUP_SUGGESTIONS, type MockLocation } from "../../data/locations";
import { VEHICLE_LABELS } from "../../data/pricing";
import { validateDestination, validatePickupLocation } from "../../validation/journeyValidation";

// Khóa xe trong bookings.vehicle_size → khóa xe của app (xem backend/src/validation/bookings.ts).
const VEHICLE_KEY: Record<string, string> = Object.fromEntries(Object.entries(VEHICLE_LABELS).map(([key, label]) => [label, key]));

// Ngày và giờ theo giờ UK (chuyến lưu ở UTC).
function ukDateAndTime(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const asText = (loc: MockLocation) => `${loc.name}, ${loc.postcode}`;

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; booking: CheckoutBooking };

export default function EditJourneyPage() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [state, setState] = useState<State>({ status: "loading" });
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [errors, setErrors] = useState<{ pickup?: string; destination?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBooking(ref).then((r) => {
      if (!active) return;
      if (!r.ok) {
        if (r.reason === "signedOut") return navigate("/login", { replace: true });
        setState({ status: "error", message: r.message });
        return;
      }
      setPickup(r.data.booking.pickupLocation);
      setDestination(r.data.booking.destination);
      setState({ status: "ready", booking: r.data.booking });
    });
    return () => {
      active = false;
    };
  }, [ref]);

  if (state.status === "loading") {
    return (
      <MobileFrame>
        <div role="status" className="flex flex-1 items-center justify-center text-[14px] text-[#64748b]">
          Loading your journey…
        </div>
      </MobileFrame>
    );
  }
  if (state.status === "error") {
    return (
      <MobileFrame>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" data-testid="edit-journey-error">
          <h1 className="text-[20px] font-bold text-[#0b2341]">{state.message}</h1>
          <button type="button" onClick={() => navigate("/home")} className="h-12 w-full cursor-pointer rounded-xl bg-[#0b2341] text-[15px] font-semibold text-white">
            Back to Home
          </button>
        </main>
      </MobileFrame>
    );
  }

  const { booking } = state;
  if (booking.status === "PAID") return <Navigate to={`/checkout/${booking.bookingRef}/success`} replace />;

  const back = () => navigate(`/checkout/${booking.bookingRef}/price`);
  const [origPickupName] = splitPlace(booking.pickupLocation);
  const [origDestName] = splitPlace(booking.destination);
  const pickupChanged = pickup.trim() !== booking.pickupLocation;
  const destinationChanged = destination.trim() !== booking.destination;
  const modified = Number(pickupChanged) + Number(destinationChanged);
  const destinationValid = destinationChanged && !validateDestination(destination, pickup);
  const { date, time } = ukDateAndTime(booking.journeyDateTime);

  function onPickupChange(e: ChangeEvent<HTMLInputElement>) {
    setPickup(e.target.value);
    setErrors((p) => ({ ...p, pickup: undefined }));
    setSaveError(null);
  }
  function onDestinationChange(e: ChangeEvent<HTMLInputElement>) {
    setDestination(e.target.value);
    setErrors((p) => ({ ...p, destination: undefined }));
    setSaveError(null);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const next = { pickup: validatePickupLocation(pickup), destination: validateDestination(destination, pickup) };
    setErrors(next);
    if (next.pickup || next.destination) return;

    setSaving(true);
    setSaveError(null);
    const r = await saveTrip({
      serviceName: booking.serviceName,
      pickupLocation: pickup.trim(),
      destination: destination.trim(),
      journeyDate: date,
      journeyTime: time,
      passengerCount: booking.passengerCount,
      vehicleSize: VEHICLE_KEY[booking.vehicleSize] ?? "standard",
    });
    setSaving(false);
    if (!r.ok) {
      if (r.reason === "signedOut") return navigate("/login", { replace: true });
      setSaveError(r.message);
      return;
    }
    navigate(`/checkout/${r.data.booking.bookingRef}/price`);
  }

  return (
    <MobileFrame>
      <CheckoutHeader title="PrivateHire Booking" subtitle="Select Vehicle Class" onBack={back} onClose={() => navigate("/home")} avatarName={user?.fullName ?? "Guest"} />

      <main className="flex flex-1 flex-col gap-4 px-5 pt-2 pb-8" data-testid="edit-journey-page">
        <section className="flex gap-3 rounded-2xl bg-[#e0f2fe] p-4 text-[#0c4a6e]">
          <span className="mt-0.5 shrink-0 text-[#0284c7]">
            <Icon name="badgeCheck" size={18} />
          </span>
          <div>
            <p className="text-[14px] font-bold">Editing Location Parameters</p>
            <p className="text-[13px] leading-5">Modify pickup point and destination below. Fare and promo eligibility will be recalculated upon saving.</p>
          </div>
        </section>

        <section className={`${CARD} p-4`} aria-label="Trip configuration">
          <div className="flex items-center justify-between text-[13px] font-bold text-[#0b2341]">
            <span className="flex items-center gap-2">
              <Icon name="route" size={15} /> Trip Configuration
            </span>
            <Chip>Step 2 of 4</Chip>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#e2e8f0]">
            <div className="h-1.5 w-1/2 rounded-full bg-[#0284c7]" />
          </div>
        </section>

        {/* Map: static OpenStreetMap view of Manchester (no API key). Distance is a mock value. */}
        <section className="relative overflow-hidden rounded-2xl bg-[#e2e8f0] shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
          <iframe
            title="Route map"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-2.33,53.42,-2.17,53.50&layer=mapnik"
            loading="lazy"
            className="block h-[170px] w-full border-0"
          />
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-[11.5px] font-semibold">
            <span className="rounded-full bg-[#0b2341]/85 px-2.5 py-1 text-white">Approx. 9.8 miles (24 mins)</span>
            {saving && <span className="rounded-full bg-white px-2.5 py-1 text-[#0284c7]">Recalculating</span>}
          </div>
        </section>

        <form noValidate onSubmit={onSave} className="flex flex-col gap-4">
          <section className={`${CARD} p-4`} aria-labelledby="location-params">
            <div className="flex items-center justify-between">
              <h2 id="location-params" className="flex items-center gap-2 text-[15px] font-bold text-[#0b2341]">
                <Icon name="mapPin" size={16} /> Location Parameters
              </h2>
              <Chip>{modified} Modified</Chip>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="pickup" className="text-[13px] font-semibold text-[#0b2341]">
                  Pickup Location <span className="text-[#dc2626]">*</span>
                </label>
                <span className="text-[11px] text-[#64748b]">{pickupChanged ? "Modified" : "Unchanged"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[#cbd5e1] px-3 py-2.5 focus-within:border-[#0284c7]">
                <Icon name="mapPin" size={16} />
                <input
                  id="pickup"
                  name="pickup"
                  list="pickup-options"
                  value={pickup}
                  onChange={onPickupChange}
                  aria-invalid={Boolean(errors.pickup)}
                  aria-describedby={errors.pickup ? "pickup-error" : undefined}
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[#0f172a] outline-none"
                />
              </div>
              <datalist id="pickup-options">
                {PICKUP_SUGGESTIONS.map((loc) => (
                  <option key={loc.id} value={asText(loc)} />
                ))}
              </datalist>
              {errors.pickup ? (
                <p id="pickup-error" role="alert" className="text-[12px] font-medium text-[#dc2626]">
                  {errors.pickup}
                </p>
              ) : (
                <p className="text-[12px] text-[#64748b]">Original: {origPickupName}</p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="destination" className="text-[13px] font-semibold text-[#0b2341]">
                  Destination Location <span className="text-[#dc2626]">*</span>
                </label>
                <span className="rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-semibold text-[#0369a1]">
                  {destinationChanged ? "Active Editing" : "Unchanged"}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[#cbd5e1] px-3 py-2.5 focus-within:border-[#0284c7]">
                <Icon name="mapPin" size={16} />
                <input
                  id="destination"
                  name="destination"
                  list="destination-options"
                  value={destination}
                  onChange={onDestinationChange}
                  aria-invalid={Boolean(errors.destination)}
                  aria-describedby={errors.destination ? "destination-error" : undefined}
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[#0f172a] outline-none"
                />
                {destination && (
                  <button type="button" aria-label="Clear destination" onClick={() => setDestination("")} className="cursor-pointer text-[#64748b]">
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
              <datalist id="destination-options">
                {DESTINATION_SUGGESTIONS.map((loc) => (
                  <option key={loc.id} value={asText(loc)} />
                ))}
              </datalist>
              {errors.destination ? (
                <p id="destination-error" role="alert" className="text-[12px] font-medium text-[#dc2626]">
                  {errors.destination}
                </p>
              ) : destinationValid ? (
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-[#166534]">
                  <Icon name="check" size={12} /> Valid postal address recognized · Original: {origDestName}
                </p>
              ) : (
                <p className="text-[12px] text-[#64748b]">Original: {origDestName}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1" aria-label="Quick picks">
                {DESTINATION_SUGGESTIONS.slice(0, 3).map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setDestination(asText(loc))}
                    className="cursor-pointer rounded-full border border-[#cbd5e1] px-3 py-1 text-[12px] text-[#334155] hover:bg-[#f1f5f9]"
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={`${CARD} p-4`} aria-labelledby="locked-params">
            <div className="flex items-center justify-between">
              <h2 id="locked-params" className="flex items-center gap-2 text-[15px] font-bold text-[#0b2341]">
                <Icon name="lock" size={15} /> Locked Journey Parameters
              </h2>
              <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] text-[#64748b]">Read-Only</span>
            </div>
            <dl className="mt-3 flex flex-col gap-2 text-[13px]">
              <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3">
                <div>
                  <dt className="text-[#64748b]">Date &amp; Time</dt>
                  <dd className="font-semibold text-[#0b2341]">
                    {date} · {time}
                  </dd>
                </div>
                <Icon name="lock" size={14} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3">
                <div>
                  <dt className="text-[#64748b]">Vehicle Class</dt>
                  <dd className="font-semibold text-[#0b2341]">{booking.vehicleSize}</dd>
                </div>
                <Icon name="lock" size={14} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3">
                <div>
                  <dt className="text-[#64748b]">Passenger Count</dt>
                  <dd className="font-semibold text-[#0b2341]">{booking.passengerCount} Passengers</dd>
                </div>
                <Icon name="lock" size={14} />
              </div>
            </dl>
            <p className="mt-3 flex gap-2 text-[12px] leading-4 text-[#64748b]">
              <Icon name="info" size={14} /> To change vehicle capacity or schedule, please cancel and return to Vehicle Selection or Schedule tab.
            </p>
          </section>

          <section className="flex items-center justify-between gap-3 rounded-2xl bg-[#e0f2fe] p-4">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-bold text-[#0369a1]">
                <Icon name="badgeCheck" size={15} /> 15% Online Discount Eligibility
              </p>
              <p className="text-[12px] text-[#0c4a6e]">Applicable for updated airport drop-off route</p>
            </div>
            <Icon name="badgeCheck" size={18} />
          </section>

          {saveError && (
            <p role="alert" className="text-center text-[13px] font-medium text-[#dc2626]">
              {saveError}
            </p>
          )}

          <button
            type="submit"
            data-testid="save-recalculate"
            disabled={saving}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284c7] text-[15px] font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Recalculating…" : "Save & Recalculate Fare"}
          </button>
          <button type="button" onClick={back} className="flex cursor-pointer items-center justify-center gap-1 text-[14px] font-medium text-[#334155] hover:underline">
            <Icon name="arrowLeft" size={14} /> Cancel Changes
          </button>
        </form>
      </main>
    </MobileFrame>
  );
}
