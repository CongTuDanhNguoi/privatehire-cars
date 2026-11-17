// =============================================================
// VerifyEmailPage — nhập mã OTP 6 số gửi qua email sau khi đăng ký (P0-18).
// Không có frame Figma riêng: dựng theo phong cách màn Registration / Registration Complete
// (header logo + tiêu đề, ô nhập viền 1px #cbd5e1 / lỗi 2px #ef4444, nút #0b2341).
// Ô mã theo hướng dẫn web hiện đại: 1 ô duy nhất, inputmode="numeric", autocomplete="one-time-code".
// =============================================================
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import Icon from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { resendVerificationCode, verifyEmail } from "../services/auth";
import {
  OTP_LENGTH,
  OTP_MESSAGES,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  normalizeOtp,
  validateOtp,
} from "../validation/otpValidation";

const FONT = "font-['Inter',sans-serif]";

interface VerifyState {
  email?: string;
  emailSent?: boolean;
  fromLogin?: boolean;
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as VerifyState;
  const email = state.email ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState(state.emailSent === false ? OTP_MESSAGES.sendFailed : "");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Đến từ Login: chưa gửi mã mới nên cho bấm "Resend code" ngay.
  const [cooldown, setCooldown] = useState(state.fromLogin || state.emailSent === false ? 0 : OTP_RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Chỉ vào được ngay sau khi đăng ký / đăng nhập (cần biết email).
  if (!email) return <Navigate to="/register" replace />;

  function change(e: ChangeEvent<HTMLInputElement>) {
    setCode(normalizeOtp(e.target.value).replace(/\D/g, "").slice(0, OTP_LENGTH));
    if (error) setError("");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const found = validateOtp(code);
    if (found) {
      setError(found);
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setNotice("");
    const result = await verifyEmail(email, code);
    setSubmitting(false);
    if (result.ok) {
      navigate("/register/complete", { replace: true, state: { email: result.user.email } });
    } else {
      setError(result.error);
      inputRef.current?.focus();
    }
  }

  async function resend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    setNotice("");
    const result = await resendVerificationCode(email);
    setResending(false);
    if (result.ok) {
      setCode("");
      setError(result.verification.emailSent ? "" : OTP_MESSAGES.sendFailed);
      if (result.verification.emailSent) setNotice(`A new code has been sent to ${result.verification.sentTo}.`);
      setCooldown(result.verification.resendInSeconds);
      inputRef.current?.focus();
    } else {
      setError(result.error);
      if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
    }
  }

  const hasError = Boolean(error);

  return (
    <MobileFrame>
      <div
        className="flex min-h-[844px] flex-col bg-[#f8fafc] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]"
        data-testid="verify-email-page"
      >
        <header className="flex h-[57px] items-center justify-between border-b border-[#f1f5f9] bg-white px-4">
          <button
            type="button"
            onClick={() => navigate(state.fromLogin ? "/login" : "/", { replace: true })}
            className={`${FONT} flex w-[64px] cursor-pointer items-center gap-1 text-[14px] text-[#475569]`}
          >
            <Icon name="chevronLeft" size={16} />
            Back
          </button>
          <div className="flex items-center gap-1.5">
            <img src={logo} alt="PrivateHire Cars" className="h-7 w-[54px] rounded object-cover" />
            <h1 className={`${FONT} text-[16px] leading-6 font-bold whitespace-nowrap text-[#0f172a]`}>Verify Email</h1>
          </div>
          <span className="w-[64px]" />
        </header>

        <form noValidate onSubmit={submit} className="flex flex-1 flex-col justify-between px-4 pt-8 pb-4">
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-[#0b2341] text-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1)]">
              <Icon name="mail" size={30} />
            </div>
            <h2 className={`${FONT} pt-4 text-center text-[22px] leading-8 font-bold text-[#0f172a]`}>
              Check your email
            </h2>
            <p className={`${FONT} px-3 pt-2 text-center text-[15px] leading-[24px] text-[#475569]`}>
              We sent a {OTP_LENGTH}-digit verification code to{" "}
              <span data-testid="verify-email-address" className="font-semibold break-all text-[#0f172a]">
                {email}
              </span>
              . The code expires in {OTP_TTL_MINUTES} minutes.
            </p>

            <div className="mt-6 flex w-full flex-col">
              <label htmlFor="code" className={`${FONT} pb-1 text-[12px] leading-4 font-semibold text-[#1e293b]`}>
                Verification Code <span className="text-[#ef4444]">*</span>
              </label>
              <p id="code-hint" className={`${FONT} pb-2 text-[11px] leading-[15px] text-[#64748b]`}>
                Enter the {OTP_LENGTH} digits from the email. Check your spam folder if you can't find it.
              </p>
              <input
                id="code"
                name="code"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={OTP_LENGTH}
                placeholder="123456"
                autoFocus
                value={code}
                onChange={change}
                aria-invalid={hasError}
                aria-describedby={hasError ? "code-hint code-error" : "code-hint"}
                className={`${FONT} block h-12 w-full rounded-lg bg-white px-[15px] text-center text-[22px] font-semibold tracking-[0.5em] text-[#0f172a] outline-none placeholder:text-[#cbd5e1] ${
                  hasError ? "border-2 border-[#ef4444]" : "border border-[#cbd5e1] focus:border-[#0b2341]"
                }`}
              />
              {hasError && (
                <p id="code-error" role="alert" className={`${FONT} pt-1 text-[11px] leading-[15px] text-[#dc2626]`}>
                  {error}
                </p>
              )}
              {notice && !hasError && (
                <p role="status" className={`${FONT} pt-1 text-[11px] leading-[15px] text-[#059669]`}>
                  {notice}
                </p>
              )}
            </div>

            <p className={`${FONT} pt-5 text-center text-[13px] text-[#64748b]`}>
              Didn't get the code?{" "}
              <button
                type="button"
                onClick={resend}
                disabled={resending || cooldown > 0}
                data-testid="resend-code"
                className="cursor-pointer font-semibold text-[#0284c7] disabled:cursor-not-allowed disabled:text-[#94a3b8]"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
              </button>
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-10">
            <button
              type="submit"
              disabled={submitting}
              data-testid="verify-code"
              className={`${FONT} flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0b2341] text-[16px] font-semibold text-white transition-colors hover:bg-[#13335a] disabled:cursor-wait`}
            >
              Verify Email <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>
    </MobileFrame>
  );
}
