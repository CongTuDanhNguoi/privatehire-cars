// =============================================================
// NotificationPage — "Notification Preferences" (Figma SCRUM-88: 01, 02, 03).
// Bước 1: chọn nhận thông báo qua SMS đến số đã đăng ký hay số khác.
// Bước 2: nhập số điện thoại (lỗi định dạng hiện đúng như 03). Bấm Next thì thanh toán (payBooking).
// =============================================================
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import MobileFrame from "../../components/MobileFrame";
import Icon from "../../components/Icon";
import { CARD, CheckoutHeader, Chip, splitPlace } from "../../components/checkout/CheckoutUi";
import { getCurrentUser } from "../../services/auth";
import { getBooking, payBooking, type CheckoutBooking } from "../../services/support";
import { formatGbp } from "../../data/pricing";
import { validateNotifyPhone } from "../../validation/checkoutValidation";

const EXAMPLE_PHONE = "+44 7700 900123";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; booking: CheckoutBooking };

export default function NotificationPage() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [state, setState] = useState<State>({ status: "loading" });
  const [step, setStep] = useState<"choose" | "phone">("choose");
  const [useRegistered, setUseRegistered] = useState(true);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [paying, setPaying] = useState(false);
  const [bannerError, setBannerError] = useState("");

  useEffect(() => {
    let active = true;
    void getBooking(ref).then((r) => {
      if (!active) return;
      if (!r.ok) {
        if (r.reason === "signedOut") return navigate("/login", { replace: true });
        setState({ status: "error", message: r.message });
        return;
      }
      const booking = r.data.booking;
      // No registered number on file → the customer has to type one.
      setUseRegistered(Boolean(booking.customerPhone));
      setPhone(booking.customerPhone ?? "");
      setState({ status: "ready", booking });
    });
    return () => {
      active = false;
    };
  }, [ref]);

  if (state.status === "loading") {
    return (
      <MobileFrame>
        <div role="status" className="flex flex-1 items-center justify-center text-[14px] text-[#64748b]">
          Loading your booking…
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
  if (booking.status === "PAID") return <Navigate to={`/checkout/${booking.bookingRef}/success`} replace />;

  const [pickupName, pickupArea] = splitPlace(booking.pickupLocation);
  const [destName, destArea] = splitPlace(booking.destination);
  const last3 = booking.customerPhone ? booking.customerPhone.replace(/\D/g, "").slice(-3) : "";
  const phoneValid = !validateNotifyPhone(phone);

  // Step label is copied from the drawn state: 01 "Step 2 of 4", 02 "Step 2 of 3", 03 "Step 3 of 4".
  const stepLabel = step === "choose" ? "Step 2 of 4" : phoneError ? "Step 3 of 4" : "Step 2 of 3";

  function goNext() {
    if (step === "choose") {
      setPhone(useRegistered ? (booking.customerPhone ?? "") : "");
      setStep("phone");
    }
  }

  function onPhoneBlur() {
    if (phone.trim()) setPhoneError(validateNotifyPhone(phone));
  }

  async function onPay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (paying) return;
    const error = validateNotifyPhone(phone);
    setPhoneError(error);
    setBannerError("");
    if (error) return;

    setPaying(true);
    const r = await payBooking(booking.bookingRef, phone);
    setPaying(false);
    if (r.ok) {
      navigate(`/checkout/${booking.bookingRef}/success`, { state: { emailSent: r.data.emailSent } });
      return;
    }
    if (r.reason === "signedOut") return navigate("/login", { replace: true });
    const phoneFromServer = (r.fields as Record<string, string> | undefined)?.phone; // server reports the phone field by name
    if (phoneFromServer) setPhoneError(phoneFromServer);
    else setBannerError(r.message);
  }

  return (
    <MobileFrame>
      <CheckoutHeader title="Passenger Details" onBack={() => (step === "phone" ? setStep("choose") : navigate(`/checkout/${booking.bookingRef}/price`))} onClose={() => navigate("/home")} avatarName={user?.fullName ?? "Guest"} />

      <main className="flex flex-1 flex-col gap-4 px-5 pt-2 pb-8" data-testid="notification-page">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold text-[#0b2341]">Notification Preferences</h1>
          <Chip>{stepLabel}</Chip>
        </div>

        {/* Locked fare card (same on every step) */}
        <section className={`${CARD} p-4`} aria-label="Journey and locked fare">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-[0.5px] text-[#0b2341] uppercase">
              <Icon name="receipt" size={15} /> Journey &amp; Locked Fare
            </h2>
            <Chip>
              <Icon name="lock" size={11} /> Locked
            </Chip>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-[#64748b]">Guest</dt>
            <dd className="text-right font-semibold text-[#0b2341]">{user?.fullName ?? "Guest"}</dd>
            <dt className="text-[#64748b]">Pickup</dt>
            <dd className="text-right text-[#0b2341]">{pickupName}{pickupArea ? ` (${pickupArea})` : ""}</dd>
            <dt className="text-[#64748b]">Destination</dt>
            <dd className="text-right text-[#0b2341]">{destName}{destArea ? ` (${destArea})` : ""}</dd>
            <dt className="text-[#64748b]">Vehicle</dt>
            <dd className="text-right font-semibold text-[#0b2341]">{booking.vehicleSize}</dd>
          </dl>
          <div className="mt-3 flex items-end justify-between rounded-xl bg-[#e8f1fd] p-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.5px] text-[#0b2341] uppercase">Total locked fare</p>
              <p className="text-[12px] text-[#0284c7]">15% promo discount applied</p>
            </div>
            <p className="text-[22px] font-bold text-[#0b2341]">{formatGbp(booking.fare.totalPence)} <span className="text-[12px] font-medium">GBP</span></p>
          </div>
        </section>

        {step === "choose" && (
          <>
            <section className="flex flex-col gap-3" aria-labelledby="notify-choice">
              <h2 id="notify-choice" className="text-[16px] font-bold text-[#0b2341]">Notification Channel Selection</h2>
              <p className="text-[13px] leading-5 text-[#475569]">Choose how to receive booking confirmation, receipt, and real-time vehicle arrival alerts.</p>

              <label className={`${CARD} flex cursor-pointer items-start gap-3 border-2 p-4 ${useRegistered ? "border-[#0284c7]" : "border-transparent"}`}>
                <input type="radio" name="channel" className="mt-1 accent-[#0284c7]" checked={useRegistered} onChange={() => setUseRegistered(true)} disabled={!booking.customerPhone} />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-2 text-[14px] font-bold text-[#0b2341]">
                    Send Message to +44 •••• {last3 || "—"}
                    {useRegistered && <Chip>SELECTED</Chip>}
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-5 text-[#475569]">Receive instant chauffeur dispatch and 10–15 min vehicle arrival alert via SMS.</span>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#f1f5f9] px-2 py-1 text-[11.5px] text-[#334155]">
                    <Icon name="info" size={12} /> Phone number will be verified in next step
                  </span>
                </span>
              </label>

              <label className={`${CARD} flex cursor-pointer items-start gap-3 border-2 p-4 ${!useRegistered ? "border-[#0284c7]" : "border-transparent"}`}>
                <input type="radio" name="channel" className="mt-1 accent-[#0284c7]" checked={!useRegistered} onChange={() => setUseRegistered(false)} />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-2 text-[14px] font-bold text-[#0b2341]">
                    Change number / phone
                    <Chip>ALTERNATIVE</Chip>
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-5 text-[#475569]">Provide an alternate UK or international contact number for this passenger.</span>
                </span>
              </label>
            </section>

            <p className="flex items-start gap-2 rounded-xl bg-[#f1f5f9] p-3 text-[12px] leading-4 text-[#475569]">
              <Icon name="message" size={14} /> Standard carrier rates may apply. Chauffeur tracks flight arrivals automatically with flight monitoring.
            </p>
            <button type="button" data-testid="notify-next" onClick={goNext} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284c7] text-[15px] font-semibold text-white">
              NEXT <Icon name="arrowRight" size={16} />
            </button>
          </>
        )}

        {step === "phone" && (
          <form noValidate onSubmit={onPay} className="flex flex-col gap-4">
            <section className={`${CARD} p-4`} aria-labelledby="contact-sms">
              <h2 id="contact-sms" className="flex items-center gap-2 text-[15px] font-bold text-[#0b2341]">
                <Icon name="message" size={15} /> Contact Information (SMS)
              </h2>
              <p className="pt-1 text-[13px] leading-5 text-[#475569]">Provide your mobile phone number to receive real-time driver dispatch updates and arrival alerts.</p>

              <div className="mt-4 flex items-center justify-between">
                <label htmlFor="notifyPhone" className="text-[13px] font-bold text-[#0b2341]">
                  UK Mobile Telephone Number <span className="text-[#dc2626]">*</span>
                </label>
                <span className="text-[11px] font-semibold text-[#64748b]">REQUIRED</span>
              </div>
              <div className={`mt-1.5 flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 ${phoneError ? "border-[#ef4444]" : "border-[#cbd5e1] focus-within:border-[#0284c7]"}`}>
                <Icon name="phone" size={16} />
                <input
                  id="notifyPhone"
                  name="notifyPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneError("");
                    setBannerError("");
                  }}
                  onBlur={onPhoneBlur}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? "notifyPhone-error" : "notifyPhone-hint"}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[#0f172a] outline-none"
                />
                {phoneError ? (
                  <span className="text-[#ef4444]">
                    <Icon name="alertCircle" size={18} />
                  </span>
                ) : phoneValid && phone.trim() ? (
                  <Chip tone="green">✓ VALID</Chip>
                ) : null}
              </div>
              {phoneError ? (
                <p id="notifyPhone-error" role="alert" className="mt-2 text-[13px] font-semibold text-[#dc2626]">
                  ERROR: {phoneError}
                </p>
              ) : (
                <p id="notifyPhone-hint" className="mt-2 text-[12px] text-[#64748b]">
                  Format: UK mobile or international prefix with country code (e.g. +44 7...).
                </p>
              )}
              {phoneError && (
                <p className="mt-1 text-[12px] leading-4 text-[#64748b]">Telephone validity rules and international prefix constraints. Alphabetical characters are not permitted.</p>
              )}
              <button type="button" onClick={() => setPhone(EXAMPLE_PHONE)} className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg bg-[#f1f5f9] px-3 py-2 text-[12px] text-[#334155]">
                <span>Example standard format:</span>
                <span className="font-semibold text-[#0284c7]">Use {EXAMPLE_PHONE}</span>
              </button>
            </section>

            <section className="flex gap-3 rounded-2xl bg-[#e0f2fe] p-4">
              <Icon name="bell" size={18} />
              <div>
                <p className="text-[13px] font-bold text-[#0b2341]">Instant SMS Notifications</p>
                <p className="text-[12px] leading-4 text-[#334155]">Live chauffeur tracking link will be dispatched 15 minutes before your scheduled pickup.</p>
              </div>
            </section>

            {bannerError && (
              <p role="alert" className="text-center text-[13px] font-medium text-[#dc2626]">
                {bannerError}
              </p>
            )}

            <button
              type="submit"
              data-testid="notify-pay"
              disabled={paying || !phoneValid}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0284c7] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
            >
              {paying ? "Processing payment…" : "NEXT"} {!paying && <Icon name="arrowRight" size={16} />}
            </button>
            {!phoneValid && <p className="text-center text-[12px] text-[#64748b]">Please correct the mobile phone number format to continue.</p>}
            <button type="button" onClick={() => setStep("choose")} className="mx-auto cursor-pointer text-[14px] font-medium text-[#334155] hover:underline">
              Back to Options
            </button>
          </form>
        )}
      </main>
    </MobileFrame>
  );
}
