// =============================================================
// ForgotPasswordPages — luồng Quên mật khẩu (SCRUM-65), dựng theo ảnh xuất từ Figma:
//   2. Forgot Password  (/forgot-password)         nhập email → gửi mã 4 số
//   3. Verify Code      (/forgot-password/verify)  nhập mã 4 số (4 ô)
//   4. Change Password  (/forgot-password/new)     mật khẩu mới + xác nhận
//   5. Password Changed (/forgot-password/done)    → Go to Login
// Email / reset token chuyển giữa các màn qua router state (không lưu localStorage).
// Câu báo lỗi lấy từ src/validation (rules.ts, passwordResetValidation.ts).
// =============================================================
import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Icon, { type IconName } from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { AuthField, BrandLogo, ErrorBanner, FONT, PrimaryButton } from "../components/auth/AuthUi";
import { requestPasswordReset, resetPassword, verifyResetCode } from "../services/auth";
import { validateEmail } from "../validation/rules";
import {
  RESET_CODE_LENGTH,
  RESET_RESEND_SECONDS,
  maskEmail,
  validateChangePassword,
  validateResetCode,
  type ChangePasswordErrors,
} from "../validation/passwordResetValidation";

interface FlowState {
  email?: string;
  resetToken?: string;
  done?: boolean;
}

// ---------- khối giao diện chung của 4 màn ----------
function Screen({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <MobileFrame>
      <div
        data-testid={testId}
        className={`${FONT} flex min-h-[844px] flex-col bg-[#f8f9fe] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]`}
      >
        {children}
      </div>
    </MobileFrame>
  );
}

function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right: ReactNode }) {
  return (
    <header className="grid h-16 grid-cols-[1fr_auto_1fr] items-center px-6 pt-4">
      <button type="button" onClick={onBack} className="flex cursor-pointer items-center gap-1.5 justify-self-start text-[15px] font-semibold text-[#0b2341] hover:underline">
        <Icon name="arrowLeft" size={18} /> Back
      </button>
      <p className="text-[15px] font-semibold tracking-[1.2px] text-[#0b2341]">{title}</p>
      <div className="justify-self-end">{right}</div>
    </header>
  );
}

function TopLink({ onClick, children, tone = "blue" }: { onClick: () => void; children: ReactNode; tone?: "blue" | "navy" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer text-[15px] font-semibold hover:underline ${tone === "blue" ? "text-[#0369a1]" : "text-[#0b2341]"}`}
    >
      {children}
    </button>
  );
}

function LogoTile({ badge = false }: { badge?: boolean }) {
  return (
    <div className="relative flex items-center justify-center rounded-[22px] bg-[#eef1fb] p-2.5">
      <div className="flex h-[72px] w-[108px] items-center justify-center bg-white">
        <BrandLogo className="h-auto w-[104px]" />
      </div>
      {badge && (
        <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-[#05c1fa] text-[#0b2341] ring-2 ring-white">
          <Icon name="repeat" size={12} />
        </span>
      )}
    </div>
  );
}

function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h1 className="pt-3 text-center text-[28px] leading-9 font-bold text-[#0b2341]">{title}</h1>
      <p className="px-2 pt-1 text-center text-[15px] leading-6 text-[#475569]">{children}</p>
    </>
  );
}

function InfoBox({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-[#eef1fb] px-4 py-3 text-[12.5px] leading-[18px] text-[#334155]">
      <span className="mt-0.5 shrink-0 text-[#0b4a7a]">
        <Icon name={icon} size={15} />
      </span>
      <div>{children}</div>
    </div>
  );
}

function BackToLogin({ label = "Back to Login" }: { label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/login")}
      className="mx-auto flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-[#334155] hover:underline"
    >
      <Icon name="arrowLeft" size={16} /> {label}
    </button>
  );
}

// =============================================================
// 2. Forgot Password
// =============================================================
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState((location.state as FlowState | null)?.email ?? "");
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (error) setError("");
    if (banner) setBanner("");
  }
  function onBlur() {
    if (email.trim()) setError(validateEmail(email));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const found = validateEmail(email);
    if (found) {
      setError(found);
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    if (result.ok) {
      navigate("/forgot-password/verify", { state: { email: result.sentTo } satisfies FlowState });
    } else if (result.field === "email") {
      setError(result.error);
      inputRef.current?.focus();
    } else {
      setBanner(result.error);
    }
  }

  return (
    <Screen testId="forgot-password-page">
      <TopBar title="FORGOT PASSWORD" onBack={() => navigate("/login")} right={<TopLink onClick={() => navigate("/login")}>Login</TopLink>} />
      <main className="flex flex-col items-center px-6 pt-6 pb-10">
        <LogoTile />
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#e3ecfb] px-3 py-1 text-[13px] font-semibold text-[#0b4a7a]">
          <Icon name="repeat" size={13} /> Account Recovery
        </span>
        <Heading title="Forgot Password">
          Enter your registered email address to receive a {RESET_CODE_LENGTH}-digit verification code.
        </Heading>

        <form noValidate onSubmit={submit} className="mt-6 flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
          {banner && <ErrorBanner title="Something went wrong">{banner}</ErrorBanner>}
          <AuthField
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            label="Email Address"
            placeholder="Enter your email address"
            icon="mail"
            value={email}
            onChange={onChange}
            onBlur={onBlur}
            error={error}
            inputRef={(el) => {
              inputRef.current = el;
            }}
          />
          {!error && <p className="-mt-1 text-[12px] text-[#475569]">We'll send an authentication code instantly.</p>}
          <PrimaryButton type="submit" disabled={submitting} className="mt-3" data-testid="send-reset-code">
            {submitting ? "Sending…" : "Send Verification Code"} <Icon name="arrowRight" size={18} />
          </PrimaryButton>
        </form>

        <div className="mt-6 w-full">
          <InfoBox icon="shield">Protected by 256-bit automated identity verification</InfoBox>
        </div>
        <p className="pt-7 text-[15px] text-[#334155]">
          Remember password?{" "}
          <button type="button" onClick={() => navigate("/login")} className="cursor-pointer font-semibold text-[#0369a1] hover:underline">
            Log In
          </button>
        </p>
        <div className="pt-5">
          <BackToLogin />
        </div>
      </main>
    </Screen>
  );
}

// =============================================================
// 3. Verify Code — 4 ô, tự nhảy ô, dán được cả mã
// =============================================================
export function VerifyResetCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as FlowState | null)?.email ?? "";
  const [digits, setDigits] = useState<string[]>(() => Array(RESET_CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESET_RESEND_SECONDS);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!email) return <Navigate to="/forgot-password" replace />;

  const code = digits.join("");
  const hasError = Boolean(error);

  function fill(from: number, text: string) {
    const clean = text.replace(/\D/g, "");
    if (!clean && text) return;
    setDigits((prev) => {
      const next = [...prev];
      if (!clean) next[from] = "";
      for (let i = 0; i < clean.length && from + i < RESET_CODE_LENGTH; i++) next[from + i] = clean[i];
      return next;
    });
    if (error) setError("");
    if (clean) boxes.current[Math.min(from + clean.length, RESET_CODE_LENGTH - 1)]?.focus();
  }
  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < RESET_CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
  }
  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const found = validateResetCode(code);
    if (found) {
      setError(found);
      boxes.current[digits.findIndex((d) => !d)]?.focus();
      return;
    }
    setSubmitting(true);
    setNotice("");
    const result = await verifyResetCode(email, code);
    setSubmitting(false);
    if (result.ok) {
      navigate("/forgot-password/new", { replace: true, state: { email, resetToken: result.resetToken } satisfies FlowState });
    } else {
      setError(result.error);
      setDigits(Array(RESET_CODE_LENGTH).fill(""));
      boxes.current[0]?.focus();
    }
  }

  async function resend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    setNotice("");
    const result = await requestPasswordReset(email);
    setResending(false);
    if (result.ok) {
      setDigits(Array(RESET_CODE_LENGTH).fill(""));
      setError("");
      setNotice("A new code has been sent to your email.");
      setCooldown(result.resendInSeconds);
      boxes.current[0]?.focus();
    } else {
      setError(result.error);
      if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
    }
  }

  return (
    <Screen testId="verify-reset-code-page">
      <TopBar title="VERIFY CODE" onBack={() => navigate("/forgot-password", { state: { email } })} right={<TopLink onClick={() => navigate("/login")}>Login</TopLink>} />
      <main className="flex flex-col items-center px-6 pt-6 pb-10">
        <LogoTile />
        <Heading title="Verify Code">Enter the {RESET_CODE_LENGTH}-digit verification code sent to your email.</Heading>
        <span data-testid="reset-email-masked" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#e3ecfb] px-3 py-1 text-[13px] font-medium text-[#0b2341]">
          <Icon name="mail" size={13} /> {maskEmail(email)}
        </span>

        <form noValidate onSubmit={submit} className="flex w-full flex-col items-center">
          <fieldset className="mt-6 flex gap-3 border-0 p-0" aria-describedby={hasError ? "code-error" : undefined}>
            <legend className="sr-only">Verification code</legend>
            {digits.map((d, i) => (
              <input
                key={i}
                id={i === 0 ? "code" : `code-${i + 1}`}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                aria-label={`Digit ${i + 1} of ${RESET_CODE_LENGTH}`}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={RESET_CODE_LENGTH}
                autoFocus={i === 0}
                value={d}
                // Ô đã có số mà gõ thêm → giữ số mới; ô trống nhận cả chuỗi (autofill "one-time-code").
                onChange={(e) => fill(i, d && e.target.value ? e.target.value.replace(d, "") || d : e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                aria-invalid={hasError}
                className={`size-[68px] rounded-xl text-center text-[24px] font-semibold text-[#0b2341] caret-[#0b2341] shadow-[0px_1px_3px_rgba(15,23,42,0.08)] outline-none ${
                  hasError
                    ? "border-2 border-[#ef4444] bg-[#fef2f2]"
                    : "border border-transparent bg-white focus:border-2 focus:border-[#65b3fc] focus:bg-[#eef4ff]"
                }`}
              />
            ))}
          </fieldset>
          {hasError ? (
            <p id="code-error" role="alert" className="pt-3 text-center text-[13px] text-[#dc2626]">
              {error}
            </p>
          ) : notice ? (
            <p role="status" className="pt-3 text-center text-[13px] text-[#059669]">
              {notice}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 pt-3 text-[13px] text-[#475569]">
              <span className="text-[#0b4a7a]">
                <Icon name="shield" size={14} />
              </span>
              End-to-end encrypted verification
            </p>
          )}

          <p className="pt-7 text-[15px] text-[#334155]">
            Didn't receive code?{" "}
            <button
              type="button"
              onClick={resend}
              disabled={resending || cooldown > 0}
              data-testid="resend-reset-code"
              className="cursor-pointer font-semibold text-[#0b2341] underline underline-offset-2 disabled:cursor-not-allowed disabled:text-[#94a3b8] disabled:no-underline"
            >
              {cooldown > 0 ? `Resend Code in ${cooldown}s` : resending ? "Sending…" : "Resend Code"}
            </button>
          </p>

          <PrimaryButton type="submit" disabled={submitting} className="mt-8" data-testid="verify-reset-code">
            <Icon name="lock" size={18} /> {submitting ? "Verifying…" : "Verify Code"}
          </PrimaryButton>
        </form>

        <div className="pt-6">
          <BackToLogin />
        </div>
        <div className="mt-10 w-full">
          <InfoBox icon="info">
            <p className="text-[14px] font-semibold text-[#0b2341]">Need chauffeur support?</p>
            Check your spam folder or contact 24/7 VIP Concierge for instant SMS validation.
          </InfoBox>
        </div>
      </main>
    </Screen>
  );
}

// =============================================================
// 4. Change Password
// =============================================================
// Số điều kiện đạt (0–4) cho thanh độ mạnh 4 vạch: ≥8 ký tự, chữ hoa, số, ký tự đặc biệt.
const strengthOf = (pw: string) => [pw.length >= 8, /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email = "", resetToken = "" } = (location.state as FlowState | null) ?? {};
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [banner, setBanner] = useState<{ text: string; expired: boolean } | null>(null);
  const [show, setShow] = useState({ password: false, confirmPassword: false });
  const [submitting, setSubmitting] = useState(false);
  const refs = useRef<Record<"password" | "confirmPassword", HTMLInputElement | null>>({ password: null, confirmPassword: null });

  if (!email || !resetToken) return <Navigate to="/forgot-password" replace />;

  function onChange(key: "password" | "confirmPassword") {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
      if (banner && !banner.expired) setBanner(null);
    };
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const found = validateChangePassword(form, email);
    setErrors(found);
    if (found.password) return refs.current.password?.focus();
    if (found.confirmPassword) return refs.current.confirmPassword?.focus();

    setSubmitting(true);
    const result = await resetPassword({ email, resetToken, ...form });
    setSubmitting(false);
    if (result.ok) {
      navigate("/forgot-password/done", { replace: true, state: { email, done: true } satisfies FlowState });
      return;
    }
    if (result.errors.password || result.errors.confirmPassword) setErrors(result.errors);
    else setBanner({ text: result.error ?? "", expired: Boolean(result.expired) });
  }

  const strength = strengthOf(form.password);
  const showButton = (key: "password" | "confirmPassword") => (
    <button
      type="button"
      onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
      aria-label={show[key] ? "Hide password" : "Show password"}
      aria-pressed={show[key]}
      className="cursor-pointer text-[13px] font-medium text-[#0369a1]"
    >
      {show[key] ? "Hide" : "Show"}
    </button>
  );

  return (
    <Screen testId="change-password-page">
      <TopBar
        title="CHANGE PASSWORD"
        onBack={() => navigate("/forgot-password", { state: { email } })}
        right={
          <TopLink tone="navy" onClick={() => navigate("/login")}>
            Cancel
          </TopLink>
        }
      />
      <main className="flex flex-col items-center px-6 pt-6 pb-10">
        <LogoTile badge />
        <Heading title="Change Password">Create a new secure password for your account.</Heading>

        <form noValidate onSubmit={submit} className="mt-5 flex w-full flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
          {banner && (
            <ErrorBanner title={banner.expired ? "Reset session expired" : "Something went wrong"}>
              {banner.text}{" "}
              {banner.expired && (
                <button type="button" onClick={() => navigate("/forgot-password", { state: { email } })} className="cursor-pointer font-semibold underline">
                  Request a new code
                </button>
              )}
            </ErrorBanner>
          )}
          <div className="flex flex-col gap-2.5">
            <AuthField
              id="password"
              name="password"
              type={show.password ? "text" : "password"}
              autoComplete="new-password"
              label="New Password"
              hint={<span className="text-[13px] text-[#334155]">Min. 8 chars</span>}
              placeholder="Enter new password"
              soft
              value={form.password}
              onChange={onChange("password")}
              error={errors.password}
              trailing={showButton("password")}
              inputRef={(el) => {
                refs.current.password = el;
              }}
            />
            <div className="grid grid-cols-4 gap-1.5" role="img" aria-label={`Password strength ${strength} of 4`}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`h-1 rounded-full ${n <= strength ? "bg-[#65b3fc]" : "bg-[#e2e8f0]"}`} />
              ))}
            </div>
          </div>
          <AuthField
            id="confirmPassword"
            name="confirmPassword"
            type={show.confirmPassword ? "text" : "password"}
            autoComplete="new-password"
            label="Confirm New Password"
            placeholder="Confirm new password"
            soft
            value={form.confirmPassword}
            onChange={onChange("confirmPassword")}
            error={errors.confirmPassword}
            trailing={showButton("confirmPassword")}
            inputRef={(el) => {
              refs.current.confirmPassword = el;
            }}
          />
          <InfoBox icon="info">Both fields required. Passwords must match and contain at least 8 characters.</InfoBox>
          <PrimaryButton type="submit" disabled={submitting} className="mt-1" data-testid="save-password">
            <Icon name="badgeCheck" size={18} /> {submitting ? "Saving…" : "Save Password"}
          </PrimaryButton>
        </form>

        <div className="pt-8">
          <BackToLogin label="Cancel / Back to Login" />
        </div>
        <p className="flex items-center gap-1.5 pt-4 text-[13px] text-[#64748b]">
          <Icon name="shield" size={13} /> Protected by 256-bit encrypted security
        </p>
      </main>
    </Screen>
  );
}

// =============================================================
// 5. Password Changed Successfully
// =============================================================
export function PasswordChangedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email = "", done = false } = (location.state as FlowState | null) ?? {};
  const [conciergeNote, setConciergeNote] = useState(false);

  if (!done) return <Navigate to="/login" replace />;

  return (
    <Screen testId="password-changed-page">
      <nav aria-label="Progress" className="flex items-center justify-between px-5 pt-5 text-[14px]">
        <ol className="flex items-center gap-2">
          <li className="flex items-center gap-1.5 font-semibold text-[#0369a1]">
            <span className="flex size-4 items-center justify-center rounded bg-[#e3ecfb]">
              <Icon name="check" size={11} />
            </span>
            Success
          </li>
          <li aria-hidden="true" className="text-[#94a3b8]">
            <Icon name="chevronRight" size={14} />
          </li>
          <li aria-current="step" className="leading-[18px] font-semibold text-[#0b2341]">
            Password
            <br />
            Changed
          </li>
          <li aria-hidden="true" className="text-[#cbd5e1]">
            <Icon name="chevronRight" size={14} />
          </li>
          <li className="text-[#94a3b8]">Login</li>
        </ol>
        <span className="flex items-center gap-1.5 rounded-full bg-[#e3ecfb] px-3 py-1 text-[13px] font-semibold text-[#0b2341]">
          <span className="size-1.5 rounded-full bg-[#0b2341]" /> Secured
        </span>
      </nav>

      <main className="flex flex-col items-center px-5 pt-5 pb-8">
        <section className="flex w-full flex-col items-center rounded-2xl bg-gradient-to-br from-white to-[#eef4ff] px-6 pt-6 pb-6 shadow-[0px_4px_14px_rgba(15,23,42,0.08)]">
          <BrandLogo className="h-[84px] w-auto" />
          <div className="mt-4 flex size-[112px] items-center justify-center rounded-full bg-[#e6f6fd]">
            <div className="flex size-[80px] items-center justify-center rounded-full bg-[#05c1fa] shadow-[0px_6px_16px_rgba(5,193,250,0.35)]">
              <span className="flex size-9 items-center justify-center rounded-full bg-white text-[#05c1fa]">
                <Icon name="check" size={22} />
              </span>
            </div>
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#e3ecfb] px-3 py-1 text-[14px] font-semibold text-[#0b4a7a]">
            <Icon name="shield" size={14} /> Account Protected
          </span>
          <h1 className="pt-3 text-center text-[28px] leading-9 font-bold text-[#0b2341]">Password Changed Successfully</h1>
          <p className="pt-2 text-center text-[15px] leading-6 text-[#475569]">
            Your password has been updated. You can now log in with your new password.
          </p>
          <div className="mt-5 flex w-full items-start gap-3 rounded-xl bg-[#eef1fb] p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dbe6fb] text-[#0b4a7a]">
              <Icon name="repeat" size={15} />
            </span>
            <div className="text-[13px] leading-[18px] text-[#334155]">
              <p className="text-[15px] font-semibold text-[#0b2341]">Active Session Updated</p>
              All current chauffeur bookings and saved payment methods remain safe.
            </div>
          </div>
          <PrimaryButton type="button" onClick={() => navigate("/login", { replace: true, state: { email } })} className="mt-6" data-testid="go-to-login">
            Go to Login <Icon name="arrowRight" size={18} />
          </PrimaryButton>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="mt-4 flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-[#334155] hover:underline"
          >
            <Icon name="house" size={16} /> Back to Welcome
          </button>
        </section>

        <p className="pt-6 text-[14px] text-[#334155]">
          Didn't make this change?{" "}
          <button type="button" onClick={() => setConciergeNote(true)} className="cursor-pointer font-semibold text-[#0369a1] underline underline-offset-2">
            Contact Concierge
          </button>
        </p>
        <p className="flex items-center gap-1.5 pt-2 text-[13px] text-[#64748b]">
          <Icon name="phone" size={13} /> 24/7 Priority Chauffeur Support
        </p>
        {conciergeNote && (
          <p role="status" className="pt-3 text-center text-[12px] text-[#64748b]">
            Log in and open Help &amp; Support to send us a message. We reply by email.
          </p>
        )}
      </main>
    </Screen>
  );
}
