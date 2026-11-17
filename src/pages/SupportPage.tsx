// =============================================================
// SupportPage — "Contact Support" (/support, bắt buộc đăng nhập).
// Màn mới: khách gửi câu hỏi chung hoặc về một chuyến của mình; nhân viên trả lời qua Staff Portal.
// Dưới form là "My enquiries" (các câu hỏi đã gửi + trạng thái).
// Không có nút nào ở màn cũ dẫn tới đây (giữ nguyên UI app) — mở bằng đường dẫn /support.
// Kiểu dáng theo các màn dựng tay sẵn có (Service Selection / Profile): Inter, navy #0b2341, thẻ chọn viền đậm.
// =============================================================
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { getCurrentUser } from "../services/auth";
import {
  formatLocalDate,
  formatUkDateTime,
  listMyBookings,
  listMyEnquiries,
  sendEnquiry,
  type Booking,
  type MyEnquiry,
} from "../services/support";
import {
  ENQUIRY_LIMITS,
  validateEnquiry,
  type EnquiryErrors,
  type EnquiryForm,
} from "../validation/enquiryValidation";

const FONT = "font-['Inter',sans-serif]";
const EMPTY: EnquiryForm = { type: "", bookingId: null, subject: "", message: "" };

// ---------- thẻ chọn (radio thật, ẩn ô tròn; viền đậm khi chọn như Service Selection) ----------
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
          checked ? "border-2 border-[#0b2341] bg-[#eff6ff] p-[13px]" : "border border-[#e2e8f0] bg-white"
        }`}
      >
        {children}
        <span
          aria-hidden="true"
          className={`ml-auto flex size-5 shrink-0 items-center justify-center rounded-full ${
            checked ? "bg-[#0b2341] text-white" : "border-2 border-[#cbd5e1] bg-white"
          }`}
        >
          {checked && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
      </span>
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={`${FONT} pt-1 text-[11px] leading-[15px] text-[#dc2626]`}>
      {message}
    </p>
  );
}

const STATUS_STYLE = {
  AWAITING: "border border-[#2563eb] bg-white text-[#2563eb]",
  RESOLVED: "bg-[#ecfdf5] text-[#059669]",
} as const;

export default function SupportPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [form, setForm] = useState<EnquiryForm>(EMPTY);
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [banner, setBanner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ code: string } | null>(null);

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [enquiries, setEnquiries] = useState<MyEnquiry[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const typeRef = useRef<HTMLInputElement | null>(null);
  const bookingRef = useRef<HTMLInputElement | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
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

  function update<K extends keyof EnquiryForm>(key: K, value: EnquiryForm[K]) {
    setForm((f) => ({ ...f, [key]: value, ...(key === "type" && value === "GENERAL" ? { bookingId: null } : {}) }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    if (banner) setBanner("");
  }

  // Rời ô: chỉ báo lỗi độ dài khi đã gõ (ô trống chỉ báo khi bấm Send enquiry)
  function blur(key: "subject" | "message") {
    if (!form[key].trim()) return;
    setErrors((er) => ({ ...er, [key]: validateEnquiry(form)[key] }));
  }

  async function onSubmit(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (submitting) return;
    const found = validateEnquiry(form);
    setErrors(found);
    setBanner("");
    if (found.type) return typeRef.current?.focus();
    if (found.bookingId) return bookingRef.current?.focus();
    if (found.subject) return subjectRef.current?.focus();
    if (found.message) return messageRef.current?.focus();

    setSubmitting(true);
    const result = await sendEnquiry({
      type: form.type as "GENERAL" | "TRIP",
      bookingId: form.type === "TRIP" ? form.bookingId : null,
      subject: form.subject,
      message: form.message,
    });
    setSubmitting(false);
    if (result.ok) {
      setSent({ code: result.data.enquiry.code });
      setForm(EMPTY);
      void loadData();
      return;
    }
    if (result.reason === "signedOut") return navigate("/login", { replace: true });
    if (result.fields && Object.keys(result.fields).length > 0) setErrors(result.fields);
    else setBanner(result.message); // giữ nguyên nội dung đã nhập
  }

  const header = (
    <header className="flex items-center justify-between border-b border-[#f1f5f9] bg-white px-5 pt-[10px] pb-[9px]">
      <button
        type="button"
        onClick={() => navigate("/profile")}
        aria-label="Back to Profile"
        className="flex size-9 cursor-pointer items-center justify-center rounded-full text-[#0b2341] hover:bg-[#f1f5f9]"
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <p className={`${FONT} text-[16px] font-bold tracking-[-0.4px] text-[#0b2341]`}>Contact Support</p>
      <span className="size-9" />
    </header>
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

  // ---------- đã gửi xong ----------
  if (sent) {
    return (
      <MobileFrame>
        <div className="flex min-h-[844px] flex-col bg-[#f8fafc] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
          {header}
          <main className="flex-1 px-5 pt-8 pb-8">
            <div role="status" className="flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#059669] text-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1)]">
                <Icon name="check" size={32} strokeWidth={2.5} />
              </div>
              <h1 className={`${FONT} pt-4 text-[22px] leading-8 font-bold text-[#0f172a]`}>Enquiry sent</h1>
              <p className={`${FONT} pt-2 text-[14px] font-semibold tracking-[0.6px] text-[#0b2341]`}>{sent.code}</p>
              <p className={`${FONT} px-3 pt-2 text-[15px] leading-[26px] text-[#475569]`}>
                Our team will reply by email to <span className="font-semibold text-[#0f172a]">{user.email}</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-8">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className={`${FONT} flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0b2341] text-[15px] font-semibold text-white`}
              >
                Back to Profile <Icon name="arrowRight" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setSent(null)}
                className={`${FONT} h-12 w-full cursor-pointer rounded-xl border border-[#cbd5e1] bg-white text-[15px] font-semibold text-[#0f172a]`}
              >
                Send another enquiry
              </button>
            </div>
            {myEnquiries}
          </main>
        </div>
      </MobileFrame>
    );
  }

  // ---------- form ----------
  const inputBox = (hasError: boolean) =>
    `${FONT} block w-full rounded-lg bg-white px-[15px] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] ${
      hasError ? "border-2 border-[#ef4444]" : "border border-[#cbd5e1] focus:border-[#0b2341]"
    }`;
  const labelClass = `${FONT} pb-1 text-[12px] leading-4 font-semibold text-[#1e293b]`;

  return (
    <MobileFrame>
      <div className="flex min-h-[844px] flex-col bg-[#f8fafc] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
        {header}
        <main className="flex-1 px-5 pt-5 pb-8">
          <h1 className={`${FONT} text-[22px] leading-7 font-bold tracking-[-0.4px] text-[#0f172a]`}>How can we help?</h1>
          <p className={`${FONT} pt-2 text-[14px] leading-[22px] text-[#64748b]`}>
            Ask a general question or about one of your trips. We reply by email.
          </p>

          {loadError && (
            <div role="alert" className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-[13px]">
              <p className={`${FONT} text-[12px] font-medium text-[#b91c1c]`}>{loadError}</p>
              <button type="button" onClick={() => void loadData()} className={`${FONT} mt-1 cursor-pointer text-[12px] font-semibold text-[#0b2341] underline`}>
                Try again
              </button>
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

            <fieldset aria-describedby={errors.type ? "type-error" : undefined} className="flex flex-col gap-2 border-0 p-0">
              <legend className={labelClass}>
                Enquiry type <span className="text-[#ef4444]" aria-hidden="true">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard name="type" value="GENERAL" checked={form.type === "GENERAL"} onChange={() => update("type", "GENERAL")} inputRef={(el) => (typeRef.current = el)}>
                  <span className="flex flex-col">
                    <span className={`${FONT} text-[14px] leading-5 font-bold text-[#0f172a]`}>General enquiry</span>
                    <span className={`${FONT} pt-1 text-[11px] leading-4 text-[#64748b]`}>Services, prices, accessibility…</span>
                  </span>
                </ChoiceCard>
                <ChoiceCard
                  name="type"
                  value="TRIP"
                  checked={form.type === "TRIP"}
                  disabled={bookings !== null && !hasTrips}
                  onChange={() => update("type", "TRIP")}
                  describedBy={bookings !== null && !hasTrips ? "no-trips" : undefined}
                >
                  <span className="flex flex-col">
                    <span className={`${FONT} text-[14px] leading-5 font-bold text-[#0f172a]`}>About a trip</span>
                    <span className={`${FONT} pt-1 text-[11px] leading-4 text-[#64748b]`}>Changes, luggage, waiting time…</span>
                  </span>
                </ChoiceCard>
              </div>
              {bookings !== null && !hasTrips && (
                <p id="no-trips" className={`${FONT} text-[12px] text-[#64748b]`}>
                  You have no trips yet
                </p>
              )}
              <FieldError id="type-error" message={errors.type} />
            </fieldset>

            {form.type === "TRIP" && hasTrips && (
              <fieldset aria-describedby={errors.bookingId ? "booking-error" : undefined} className="flex flex-col gap-2 border-0 p-0">
                <legend className={labelClass}>
                  Which trip? <span className="text-[#ef4444]" aria-hidden="true">*</span>
                </legend>
                {bookings!.map((b, i) => (
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

            <div className="flex flex-col">
              <label htmlFor="subject" className={labelClass}>
                Subject <span className="text-[#ef4444]" aria-hidden="true">*</span>
              </label>
              <input
                ref={subjectRef}
                id="subject"
                name="subject"
                required
                maxLength={ENQUIRY_LIMITS.subjectMax + 20}
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                onBlur={() => blur("subject")}
                aria-invalid={!!errors.subject}
                aria-describedby={errors.subject ? "subject-error" : undefined}
                placeholder="e.g. Extra luggage for my trip"
                className={`${inputBox(!!errors.subject)} h-11`}
              />
              <FieldError id="subject-error" message={errors.subject} />
            </div>

            <div className="flex flex-col">
              <label htmlFor="message" className={labelClass}>
                Message <span className="text-[#ef4444]" aria-hidden="true">*</span>
              </label>
              <textarea
                ref={messageRef}
                id="message"
                name="message"
                required
                rows={6}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                onBlur={() => blur("message")}
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? "message-error" : undefined}
                placeholder="Tell us how we can help (at least 20 characters)"
                className={`${inputBox(!!errors.message)} resize-y py-2.5`}
              />
              <div className="flex items-start justify-between gap-3">
                <FieldError id="message-error" message={errors.message} />
                <span className={`${FONT} ml-auto pt-1 text-[11px] tabular-nums ${form.message.length > ENQUIRY_LIMITS.messageMax ? "text-[#dc2626]" : "text-[#64748b]"}`}>
                  {form.message.length}/{ENQUIRY_LIMITS.messageMax}
                </span>
              </div>
            </div>

            <button
              type="submit"
              aria-disabled={submitting || undefined}
              className={`${FONT} flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0b2341] text-[15px] font-semibold text-white aria-disabled:cursor-wait`}
            >
              {submitting ? "Sending…" : "Send enquiry"} {!submitting && <Icon name="arrowRight" size={18} />}
            </button>
          </form>

          {myEnquiries}
        </main>
      </div>
    </MobileFrame>
  );
}
