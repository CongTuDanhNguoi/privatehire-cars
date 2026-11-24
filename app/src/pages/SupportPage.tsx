// =============================================================
// SupportPage — "Submit an Enquiry" (/support, bắt buộc đăng nhập; SCRUM-95).
// Ba bước: chọn loại (S95-01) → form (S95-02 / S95-03, lỗi như S95-04) → đã gửi (S95-06).
// Dưới là "My enquiries" (câu hỏi đã gửi + trạng thái). Không có nút nào ở màn cũ dẫn tới đây — mở bằng /support hoặc từ Profile.
// =============================================================
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { useBooking } from "../context/BookingContext";
import { getCurrentUser } from "../services/auth";
import { formatLocalDate, formatUkDateTime, listMyBookings, listMyEnquiries, sendEnquiry, type Booking, type MyEnquiry } from "../services/support";
import {
  ENQUIRY_CATEGORIES,
  ENQUIRY_CONTACT_MESSAGES,
  ENQUIRY_LIMITS,
  hasPlannedTrip,
  validateEnquiry,
  validateEnquiryContact,
  type EnquiryErrors,
  type EnquiryForm,
  type TripSnapshot,
} from "../validation/enquiryValidation";
import { validateEmail, validateName } from "../validation/rules";
import { VEHICLE_LABELS } from "../data/pricing";

const FONT = "font-['Inter',sans-serif]";
const EMPTY: EnquiryForm = { type: "", bookingId: null, subject: "", message: "", contactName: "", contactEmail: "", contactPhone: "", category: "", tripSnapshot: null };
const STEP_LABELS = ["1. TYPE", "2. DETAILS", "3. CONTACT", "4. SUMMARY"];

type Step = "type" | "form" | "success";
type TripMode = "planned" | "saved";

// ---------- thẻ chọn (radio thật, ẩn ô tròn; viền đậm khi chọn) ----------
function ChoiceCard({
  name,
  value,
  checked,
  disabled,
  onChange,
  inputRef,
  describedBy,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <label className={`relative block ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input
        ref={inputRef}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-describedby={describedBy}
        className="peer absolute inset-0 m-0 opacity-0"
      />
      <span
        className={`flex items-start gap-3 rounded-[14px] p-[14px] text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2563eb] ${
          checked ? "border-2 border-[#0284c7] bg-[#f0f9ff] p-[13px]" : "border border-[#e2e8f0] bg-white"
        }`}
      >
        {children}
        <span
          aria-hidden="true"
          className={`ml-auto flex size-5 shrink-0 items-center justify-center rounded-full ${
            checked ? "bg-[#0284c7] text-white" : "border-2 border-[#cbd5e1] bg-white"
          }`}
        >
          {checked && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
      </span>
    </label>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className={`${FONT} inline-block rounded px-2 py-0.5 text-[10px] font-semibold tracking-[0.4px] text-[#475569] uppercase`}>{children}</span>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={`${FONT} flex items-start gap-1 pt-1 text-[12px] leading-4 text-[#dc2626]`}>
      <span aria-hidden="true">×</span> {message}
    </p>
  );
}

const STATUS_STYLE = {
  AWAITING: "border border-[#2563eb] bg-white text-[#2563eb]",
  RESOLVED: "bg-[#ecfdf5] text-[#059669]",
} as const;

// Trip planned in Book a Ride (BookingContext) → snapshot sent with the enquiry.
function plannedFromContext(ctx: {
  pickupLocation: string;
  destination: string;
  journeyDate: string;
  journeyTime: string;
  passengerCount: number;
  vehicleSize: string | null;
}): TripSnapshot | null {
  const snapshot: TripSnapshot = {
    pickupLocation: ctx.pickupLocation,
    destination: ctx.destination,
    journeyDate: ctx.journeyDate,
    journeyTime: ctx.journeyTime,
    passengerCount: ctx.passengerCount,
    vehicleSize: VEHICLE_LABELS[ctx.vehicleSize ?? ""] ?? ctx.vehicleSize ?? "",
  };
  return hasPlannedTrip({ type: "", bookingId: null, subject: "", message: "", tripSnapshot: snapshot }) ? snapshot : null;
}

export default function SupportPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const booking = useBooking();

  const [step, setStep] = useState<Step>("type");
  const [form, setForm] = useState<EnquiryForm>(() => ({ ...EMPTY, contactName: user?.fullName ?? "", contactEmail: user?.email ?? "", contactPhone: user?.phone ?? "" }));
  const [tripMode, setTripMode] = useState<TripMode>("planned");
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [banner, setBanner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ code: string; createdAt: string; summary: EnquiryForm } | null>(null);
  const [copied, setCopied] = useState(false);

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [enquiries, setEnquiries] = useState<MyEnquiry[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const typeRef = useRef<HTMLInputElement | null>(null);
  const bookingRef = useRef<HTMLInputElement | null>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);
  const contactEmailRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  async function loadData() {
    setLoadError("");
    const [b, e] = await Promise.all([listMyBookings(), listMyEnquiries()]);
    if (!b.ok || !e.ok) {
      const failed = !b.ok ? b : !e.ok ? e : null;
      if (failed?.reason === "signedOut") return navigate("/login", { replace: true });
      setLoadError(failed?.message ?? "");
      return;
    }
    setBookings(b.data.bookings);
    setEnquiries(e.data.enquiries);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null; // RequireAuth đã chặn trước

  const hasTrips = (bookings?.length ?? 0) > 0;
  const planned = plannedFromContext(booking);
  const isTrip = form.type === "TRIP";
  const categories = form.type === "GENERAL" || form.type === "TRIP" ? ENQUIRY_CATEGORIES[form.type] : [];
  const messageLimit = isTrip ? 500 : 1000; // S95-02 / S95-03 counters; the server keeps its own limit.

  function update<K extends keyof EnquiryForm>(key: K, value: EnquiryForm[K]) {
    setForm((f) => ({ ...f, [key]: value, ...(key === "type" && value === "GENERAL" ? { bookingId: null, tripSnapshot: null } : {}) }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    if (banner) setBanner("");
  }

  function chooseType(type: "GENERAL" | "TRIP") {
    update("type", type);
    if (type === "TRIP") setTripMode(planned ? "planned" : "saved");
  }

  function goToForm() {
    if (!form.type) {
      setErrors({ type: "Choose an enquiry type." });
      typeRef.current?.focus();
      return;
    }
    setErrors({});
    setStep("form");
  }

  // Rời ô: chỉ kiểm tra khi đã gõ (ô trống chỉ báo khi bấm Submit).
  function blur(key: "contactName" | "contactEmail") {
    const value = (form[key] ?? "").trim();
    if (!value) return;
    if (key === "contactName") setErrors((er) => ({ ...er, contactName: validateName(value) || undefined }));
    else setErrors((er) => ({ ...er, contactEmail: validateEmail(value) ? ENQUIRY_CONTACT_MESSAGES.emailInvalid : undefined }));
  }

  // Phần gửi lên server: thêm dòng mặc định cho chuyến không có chi tiết (đủ độ dài server yêu cầu).
  function buildPayload(): EnquiryForm {
    const usePlanned = isTrip && tripMode === "planned" && planned !== null;
    const details = form.message.trim();
    return {
      ...form,
      subject: form.category ?? "",
      message: isTrip && !details ? `${form.category} — no additional details.` : details,
      bookingId: isTrip && !usePlanned ? form.bookingId : null,
      tripSnapshot: usePlanned ? planned : null,
    };
  }

  async function onSubmit(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (submitting) return;
    const payload = buildPayload();
    const found: EnquiryErrors = { ...validateEnquiry(payload), ...validateEnquiryContact(form) };
    delete found.subject; // subject is the chosen category, so the category error covers it
    if (isTrip && tripMode === "saved" && !form.bookingId) found.bookingId = "Choose the trip this enquiry is about.";
    if (isTrip && tripMode === "planned" && !planned) found.bookingId = "Plan a journey first, or choose an existing trip.";
    if (!isTrip && !form.message.trim()) found.message = "Message is required.";
    setErrors(found);
    setBanner("");
    if (Object.keys(found).length > 0) {
      if (found.contactName) contactNameRef.current?.focus();
      else if (found.contactEmail) contactEmailRef.current?.focus();
      else if (found.category) categoryRef.current?.focus();
      else if (found.bookingId) bookingRef.current?.focus();
      else messageRef.current?.focus();
      return;
    }

    setSubmitting(true);
    const result = await sendEnquiry({
      type: payload.type as "GENERAL" | "TRIP",
      bookingId: payload.bookingId,
      subject: payload.subject,
      message: payload.message,
      contactName: form.contactName?.trim(),
      contactEmail: form.contactEmail?.trim(),
      contactPhone: form.contactPhone?.trim() || undefined,
      category: form.category,
      tripSnapshot: payload.tripSnapshot,
    });
    setSubmitting(false);
    if (result.ok) {
      setSent({ code: result.data.enquiry.code, createdAt: result.data.enquiry.createdAt, summary: payload });
      setStep("success");
      void loadData();
      return;
    }
    if (result.reason === "signedOut") return navigate("/login", { replace: true });
    if (result.fields && Object.keys(result.fields).length > 0) setErrors(result.fields);
    else setBanner(result.message); // giữ nguyên nội dung đã nhập
  }

  function startAgain() {
    setForm({ ...EMPTY, contactName: user?.fullName ?? "", contactEmail: user?.email ?? "", contactPhone: user?.phone ?? "" });
    setErrors({});
    setBanner("");
    setSent(null);
    setStep("type");
  }

  async function copyRef(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is still on screen.
    }
  }

  const stepIndex = step === "type" ? 0 : step === "form" ? 1 : 3;
  const header = (
    <header className="flex items-center justify-between border-b border-[#f1f5f9] bg-white px-5 pt-[10px] pb-[9px]">
      <button
        type="button"
        onClick={() => (step === "form" ? setStep("type") : navigate("/profile"))}
        aria-label={step === "form" ? "Back to type selection" : "Back to Profile"}
        className="flex h-9 cursor-pointer items-center gap-1 rounded-full px-1 text-[#0b2341] hover:bg-[#f1f5f9]"
      >
        <Icon name="chevronLeft" size={18} /> <span className={`${FONT} text-[13px] font-semibold`}>BACK</span>
      </button>
      <p className={`${FONT} text-[14px] font-bold tracking-[0.4px] text-[#0b2341] uppercase`}>Route Enquiry</p>
      <button type="button" onClick={() => navigate("/profile")} aria-label="Close" className="flex size-9 cursor-pointer items-center justify-center rounded-full text-[#0b2341] hover:bg-[#f1f5f9]">
        <Icon name="close" size={18} />
      </button>
    </header>
  );

  const stepper = (
    <ol aria-label="Enquiry progress" className="grid grid-cols-4 gap-1.5 px-5 pt-3">
      {STEP_LABELS.map((label, i) => (
        <li key={label} aria-current={i === stepIndex ? "step" : undefined} className="flex flex-col gap-1">
          <span className={`h-1 rounded-full ${i <= stepIndex ? "bg-[#0284c7]" : "bg-[#e2e8f0]"}`} />
          <span className={`${FONT} text-[10px] font-semibold tracking-[0.3px] ${i === stepIndex ? "text-[#0b2341]" : "text-[#94a3b8]"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );

  const myEnquiries = (
    <section aria-labelledby="my-enquiries-title" className="pt-8">
      <h2 id="my-enquiries-title" className={`${FONT} text-[16px] leading-6 font-bold text-[#0f172a]`}>
        My enquiries
      </h2>
      {enquiries === null ? (
        <p className={`${FONT} pt-2 text-[13px] text-[#64748b]`}>{loadError ? "" : "Loading…"}</p>
      ) : enquiries.length === 0 ? (
        <p className={`${FONT} pt-2 text-[13px] text-[#64748b]`}>You have not sent any enquiries yet.</p>
      ) : (
        <ul className="mt-3 rounded-2xl bg-white px-4 shadow-[0px_1px_3px_0px_rgba(15,23,42,0.06)]">
          {enquiries.map((q, i) => (
            <li key={q.id} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-[#f1f5f9]" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className={`${FONT} truncate text-[14px] leading-5 font-semibold text-[#0f172a]`}>{q.subject}</p>
                <p className={`${FONT} text-[12px] leading-4 text-[#64748b]`}>
                  {q.code} · {q.type === "TRIP" ? "About a trip" : "General"} · {formatLocalDate(q.createdAt)}
                </p>
              </div>
              <span className={`${FONT} shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[q.status]}`}>
                {q.status === "RESOLVED" ? "Resolved" : "Awaiting"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  // ---------- S95-06: đã gửi ----------
  if (step === "success" && sent) {
    const s = sent.summary;
    const routeText = s.tripSnapshot ? `${s.tripSnapshot.pickupLocation} → ${s.tripSnapshot.destination}` : bookings?.find((b) => b.id === s.bookingId);
    return (
      <MobileFrame>
        <div className="flex min-h-[844px] flex-col bg-[#f8fafc] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
          {header}
          <main className="flex-1 px-5 pt-6 pb-8" role="status" data-testid="enquiry-success">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#0284c7] text-[#0284c7]">
                <Icon name="check" size={18} strokeWidth={2.5} />
              </span>
              <h1 className={`${FONT} text-[22px] leading-7 font-bold text-[#0f172a]`}>Enquiry Submitted Successfully</h1>
            </div>
            <p className={`${FONT} pt-2 text-[14px] leading-5 text-[#475569]`}>Your enquiry has been received and queued for staff review.</p>

            <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0px_1px_3px_0px_rgba(15,23,42,0.06)]">
              <div className="flex gap-2">
                <Tag>Enquiry dispatched / received</Tag>
                <Tag>Awaiting staff triage</Tag>
              </div>
              <p className={`${FONT} pt-3 text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase`}>Official enquiry reference</p>
              <div className="flex items-center justify-between">
                <p data-testid="enquiry-code" className={`${FONT} text-[18px] font-bold text-[#0f172a]`}>
                  {sent.code}
                </p>
                <button type="button" onClick={() => void copyRef(sent.code)} aria-label="Copy enquiry reference" className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#cbd5e1] text-[#0b2341]">
                  <Icon name="clipboard" size={14} />
                </button>
              </div>
              {copied && <p className={`${FONT} text-[11px] text-[#059669]`}>Copied</p>}
              <p className={`${FONT} pt-2 text-[12px] text-[#64748b]`}>Submission timestamp: {formatUkDateTime(sent.createdAt)} (UK time)</p>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0px_1px_3px_0px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between">
                <p className={`${FONT} text-[14px] font-bold text-[#0f172a]`}>Submission Summary</p>
                <Tag>{s.type === "TRIP" ? "Trip-specific enquiry" : "General enquiry"}</Tag>
              </div>
              <p className={`${FONT} pt-3 text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase`}>Customer contact details</p>
              <p className={`${FONT} text-[14px] font-semibold text-[#0f172a]`}>{s.contactName}</p>
              <p className={`${FONT} text-[12px] text-[#475569]`}>
                {s.contactEmail}
                {s.contactPhone ? ` · ${s.contactPhone}` : ""}
              </p>
              {routeText && (
                <>
                  <p className={`${FONT} pt-3 text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase`}>Trip reference</p>
                  <p className={`${FONT} text-[13px] text-[#0f172a]`}>{typeof routeText === "string" ? routeText : `${routeText.bookingRef} · ${routeText.serviceName}`}</p>
                </>
              )}
              <p className={`${FONT} pt-3 text-[11px] font-semibold tracking-[0.5px] text-[#64748b] uppercase`}>Message summary</p>
              <p className={`${FONT} text-[13px] leading-5 text-[#334155] italic`}>&ldquo;{s.message}&rdquo;</p>
            </div>

            <div className="flex flex-col gap-3 pt-6">
              <button type="button" onClick={() => navigate("/home")} className={`${FONT} flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#65b3fc] text-[15px] font-semibold text-white`}>
                Return to Home / Dashboard <Icon name="arrowRight" size={18} />
              </button>
              <button type="button" onClick={startAgain} className={`${FONT} h-12 w-full cursor-pointer rounded-xl border border-[#cbd5e1] bg-white text-[15px] font-semibold text-[#0f172a]`}>
                Submit another enquiry
              </button>
            </div>
            {myEnquiries}
          </main>
        </div>
      </MobileFrame>
    );
  }

  const inputBox = (hasError: boolean) =>
    `${FONT} block w-full rounded-lg bg-white px-[15px] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] ${
      hasError ? "border-2 border-[#ef4444]" : "border border-[#cbd5e1] focus:border-[#0b2341]"
    }`;
  const labelClass = `${FONT} pb-1 text-[12px] leading-4 font-semibold text-[#1e293b]`;
  const errorList = Object.entries(errors).filter(([, v]) => v) as [string, string][];

  // ---------- S95-01: chọn loại ----------
  if (step === "type") {
    return (
      <MobileFrame>
        <div className="flex min-h-[844px] flex-col bg-[#f8fafc] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
          {header}
          {stepper}
          <main className="flex-1 px-5 pt-5 pb-8">
            <h1 className={`${FONT} text-[22px] leading-7 font-bold tracking-[-0.4px] text-[#0f172a]`}>Submit an Enquiry</h1>
            <p className={`${FONT} pt-2 text-[14px] leading-[22px] text-[#64748b]`}>Choose the nature of your enquiry below. A prior booking is not required.</p>

            {loadError && (
              <div role="alert" className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-[13px]">
                <p className={`${FONT} text-[12px] font-medium text-[#b91c1c]`}>{loadError}</p>
                <button type="button" onClick={() => void loadData()} className={`${FONT} mt-1 cursor-pointer text-[12px] font-semibold text-[#0b2341] underline`}>
                  Try again
                </button>
              </div>
            )}

            <fieldset aria-describedby={errors.type ? "type-error" : undefined} className="mt-5 flex flex-col gap-3 border-0 p-0">
              <legend className="sr-only">Enquiry type</legend>
              <ChoiceCard name="type" value="GENERAL" checked={form.type === "GENERAL"} onChange={() => chooseType("GENERAL")} inputRef={(el) => (typeRef.current = el)}>
                <span className="flex flex-col gap-1.5">
                  <span className={`${FONT} flex items-center gap-2 text-[15px] font-bold text-[#0f172a]`}>
                    <Icon name="info" size={15} /> General Enquiry
                  </span>
                  <span className={`${FONT} text-[13px] leading-5 text-[#475569]`}>Ask questions about our fleet, rates, corporate services, airport transfer protocols, or general private hire policies.</span>
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    <Tag>No booking required</Tag>
                    <Tag>Standard support</Tag>
                  </span>
                </span>
              </ChoiceCard>
              <ChoiceCard
                name="type"
                value="TRIP"
                checked={form.type === "TRIP"}
                onChange={() => chooseType("TRIP")}
                describedBy="trip-type-hint"
              >
                <span className="flex flex-col gap-1.5">
                  <span className={`${FONT} flex items-center gap-2 text-[15px] font-bold text-[#0f172a]`}>
                    <Icon name="crosshair" size={15} /> Trip-Specific Enquiry
                  </span>
                  <span className={`${FONT} text-[13px] leading-5 text-[#475569]`}>Inquire about a planned or pending journey, route feasibility, passenger count adjustments, or reference an existing trip reference.</span>
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    <Tag>Optional trip ref</Tag>
                    <Tag>Route context</Tag>
                  </span>
                </span>
              </ChoiceCard>
              <FieldError id="type-error" message={errors.type} />
              <span id="trip-type-hint" className="sr-only">
                {bookings !== null && !hasTrips && !planned ? "You have no trips yet." : ""}
              </span>
            </fieldset>

            <div className="mt-6 flex flex-col gap-3">
              <button type="button" onClick={goToForm} className={`${FONT} flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#65b3fc] text-[15px] font-semibold text-white`}>
                Continue to enquiry form <Icon name="arrowRight" size={18} />
              </button>
              <button type="button" onClick={() => navigate("/profile")} className={`${FONT} h-12 w-full cursor-pointer rounded-xl border border-[#cbd5e1] bg-white text-[15px] font-semibold text-[#0f172a]`}>
                Cancel / Return
              </button>
            </div>
            {myEnquiries}
          </main>
        </div>
      </MobileFrame>
    );
  }

  // ---------- S95-02 / S95-03 / S95-04: form (và lỗi) ----------
  return (
    <MobileFrame>
      <div className="flex min-h-[844px] flex-col bg-[#f8fafc] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
        {header}
        {stepper}
        <main className="flex-1 px-5 pt-5 pb-8">
          <h1 className={`${FONT} text-[22px] leading-7 font-bold tracking-[-0.4px] text-[#0f172a]`}>{isTrip ? "Trip-Specific Enquiry Form" : "General Enquiry Form"}</h1>
          <p className={`${FONT} pt-2 text-[14px] leading-[22px] text-[#64748b]`}>
            {isTrip ? "Inquire about a specific journey, planned route, or existing booking." : "Please provide your contact information and details of your enquiry."}
          </p>

          {errorList.length > 0 && (
            <div role="alert" className="mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4">
              <p className={`${FONT} flex items-center gap-2 text-[13px] font-bold text-[#b91c1c]`}>
                <Icon name="alertCircle" size={15} /> {ENQUIRY_CONTACT_MESSAGES.bannerTitle}
              </p>
              <ul className={`${FONT} list-disc pt-2 pl-5 text-[12px] leading-5 text-[#b91c1c]`}>
                {errorList.map(([k, v]) => (
                  <li key={k}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {loadError && (
            <div role="alert" className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-[13px]">
              <p className={`${FONT} text-[12px] font-medium text-[#b91c1c]`}>{loadError}</p>
            </div>
          )}

          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5 pt-5">
            {banner && (
              <div role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-[13px]">
                <p className={`${FONT} text-[12px] font-medium text-[#b91c1c]`}>{banner}</p>
                <button type="button" onClick={() => void onSubmit()} className={`${FONT} mt-1 cursor-pointer text-[12px] font-semibold text-[#0b2341] underline`}>
                  Try again
                </button>
              </div>
            )}

            {isTrip && (
              <fieldset className="flex flex-col gap-3 border-0 p-0" aria-describedby={errors.bookingId ? "booking-error" : undefined}>
                <legend className={labelClass}>1. Trip context</legend>
                <ChoiceCard name="tripMode" value="planned" checked={tripMode === "planned"} disabled={!planned} onChange={() => setTripMode("planned")}>
                  <span className="flex flex-col">
                    <span className={`${FONT} text-[14px] leading-5 font-bold text-[#0f172a]`}>Journey Planning (No Confirmed Booking Yet)</span>
                    <span className={`${FONT} pt-1 text-[11px] leading-4 text-[#64748b]`}>Route inquiry, vehicle recommendations &amp; tailored price</span>
                  </span>
                </ChoiceCard>
                {tripMode === "planned" && planned && (
                  <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className={`${FONT} text-[11px] font-bold tracking-[0.5px] text-[#0b2341] uppercase`}>Planned journey specification</p>
                      <span className="flex gap-3 text-[12px] font-semibold text-[#0284c7]">
                        <button type="button" onClick={() => navigate("/journey")} className="cursor-pointer">
                          Edit
                        </button>
                        <button type="button" onClick={() => navigate("/vehicle")} className="cursor-pointer">
                          Change
                        </button>
                      </span>
                    </div>
                    <p className={`${FONT} pt-2 text-[13px] text-[#0f172a]`}>
                      {planned.pickupLocation} → {planned.destination}
                    </p>
                    <p className={`${FONT} pt-1 text-[12px] text-[#64748b]`}>
                      {planned.journeyDate} {planned.journeyTime} (UK time) · {planned.passengerCount} passengers · {planned.vehicleSize}
                    </p>
                  </div>
                )}
                {hasTrips && (
                  <ChoiceCard name="tripMode" value="saved" checked={tripMode === "saved"} onChange={() => setTripMode("saved")}>
                    <span className="flex flex-col">
                      <span className={`${FONT} text-[14px] leading-5 font-bold text-[#0f172a]`}>An existing booking</span>
                      <span className={`${FONT} pt-1 text-[11px] leading-4 text-[#64748b]`}>Choose the trip below</span>
                    </span>
                  </ChoiceCard>
                )}
                {tripMode === "saved" &&
                  bookings?.map((b, i) => (
                    <ChoiceCard
                      key={b.id}
                      name="booking"
                      value={String(b.id)}
                      checked={form.bookingId === b.id}
                      onChange={() => update("bookingId", b.id)}
                      inputRef={i === 0 ? (el) => (bookingRef.current = el) : undefined}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className={`${FONT} text-[14px] leading-5 font-bold text-[#0f172a]`}>
                          {b.bookingRef} · {b.serviceName}
                        </span>
                        <span className={`${FONT} pt-1 text-[12px] leading-4 text-[#475569]`}>
                          {b.pickupLocation} → {b.destination}
                        </span>
                        <span className={`${FONT} pt-1 text-[11px] leading-4 text-[#64748b]`}>{formatUkDateTime(b.journeyDateTime)} (UK time)</span>
                      </span>
                    </ChoiceCard>
                  ))}
                <FieldError id="booking-error" message={errors.bookingId} />
              </fieldset>
            )}

            <fieldset className="flex flex-col gap-4 border-0 p-0">
              <legend className={labelClass}>{isTrip ? "2. Customer contact information" : "Contact information"}</legend>
              <div className="flex flex-col">
                <label htmlFor="contactName" className={labelClass}>
                  Full Name <span className="text-[#ef4444]" aria-hidden="true">*</span>
                </label>
                <input
                  ref={contactNameRef}
                  id="contactName"
                  name="contactName"
                  required
                  maxLength={100}
                  value={form.contactName ?? ""}
                  onChange={(e) => update("contactName", e.target.value)}
                  onBlur={() => blur("contactName")}
                  aria-invalid={!!errors.contactName}
                  aria-describedby={errors.contactName ? "contactName-error" : undefined}
                  className={`${inputBox(!!errors.contactName)} h-11`}
                />
                <FieldError id="contactName-error" message={errors.contactName} />
              </div>
              <div className="flex flex-col">
                <label htmlFor="contactEmail" className={labelClass}>
                  {isTrip ? "Contact Email" : "Email Address"} <span className="text-[#ef4444]" aria-hidden="true">*</span>
                </label>
                <input
                  ref={contactEmailRef}
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  required
                  maxLength={254}
                  value={form.contactEmail ?? ""}
                  onChange={(e) => update("contactEmail", e.target.value)}
                  onBlur={() => blur("contactEmail")}
                  aria-invalid={!!errors.contactEmail}
                  aria-describedby={errors.contactEmail ? "contactEmail-error" : undefined}
                  className={`${inputBox(!!errors.contactEmail)} h-11`}
                />
                <FieldError id="contactEmail-error" message={errors.contactEmail} />
              </div>
              <div className="flex flex-col">
                <label htmlFor="contactPhone" className={labelClass}>
                  {isTrip ? "Telephone" : "Phone Number"} <span className="font-normal text-[#94a3b8]">(Optional)</span>
                </label>
                <input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  inputMode="tel"
                  value={form.contactPhone ?? ""}
                  onChange={(e) => update("contactPhone", e.target.value)}
                  aria-invalid={!!errors.contactPhone}
                  aria-describedby={errors.contactPhone ? "contactPhone-error" : undefined}
                  className={`${inputBox(!!errors.contactPhone)} h-11`}
                />
                <FieldError id="contactPhone-error" message={errors.contactPhone} />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-4 border-0 p-0">
              <legend className={labelClass}>{isTrip ? "3. Enquiry message" : "Enquiry message"}</legend>
              <div className="flex flex-col">
                <label htmlFor="category" className={labelClass}>
                  Enquiry Category <span className="text-[#ef4444]" aria-hidden="true">*</span>
                </label>
                <select
                  ref={categoryRef}
                  id="category"
                  name="category"
                  required
                  value={form.category ?? ""}
                  onChange={(e) => {
                    update("category", e.target.value);
                    update("subject", e.target.value);
                  }}
                  aria-invalid={!!errors.category}
                  aria-describedby={errors.category ? "category-error" : "category-hint"}
                  className={`${inputBox(!!errors.category)} h-11 bg-white`}
                >
                  <option value="">Select an enquiry category…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {!errors.category && (
                  <p id="category-hint" className={`${FONT} pt-1 text-[11px] text-[#64748b]`}>
                    Select the classification best matching your operational requirement
                  </p>
                )}
                <FieldError id="category-error" message={errors.category} />
              </div>
              <div className="flex flex-col">
                <label htmlFor="message" className={labelClass}>
                  {isTrip ? "Details & Special Requests (Optional)" : "Enquiry Message"} {!isTrip && <span className="text-[#ef4444]" aria-hidden="true">*</span>}
                </label>
                <textarea
                  ref={messageRef}
                  id="message"
                  name="message"
                  rows={5}
                  maxLength={ENQUIRY_LIMITS.messageMax}
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "message-error" : undefined}
                  placeholder={isTrip ? "Provide any additional trip requirements, special luggage needs, or driver notes (optional)…" : ""}
                  className={`${inputBox(!!errors.message)} resize-y py-2.5`}
                />
                <div className="flex items-start justify-between gap-3">
                  <FieldError id="message-error" message={errors.message} />
                  <span className={`${FONT} ml-auto pt-1 text-[11px] tabular-nums ${form.message.length > messageLimit ? "text-[#dc2626]" : "text-[#64748b]"}`}>
                    {form.message.length} / {messageLimit} characters
                  </span>
                </div>
              </div>
            </fieldset>

            <button
              type="submit"
              aria-disabled={submitting || undefined}
              className={`${FONT} flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#65b3fc] text-[15px] font-semibold text-white aria-disabled:cursor-wait`}
            >
              {submitting ? "Sending…" : isTrip ? "Submit trip enquiry" : "Submit enquiry"} {!submitting && <Icon name="arrowRight" size={18} />}
            </button>
            <button type="button" onClick={() => (isTrip ? navigate("/profile") : setStep("type"))} className={`${FONT} h-12 w-full cursor-pointer rounded-xl border border-[#cbd5e1] bg-white text-[14px] font-semibold text-[#0f172a]`}>
              {isTrip ? "Cancel / Return" : "Back to type selection"}
            </button>
          </form>

          {myEnquiries}
        </main>
      </div>
    </MobileFrame>
  );
}
