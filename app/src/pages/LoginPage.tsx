// =============================================================
// LoginPage — màn Đăng nhập chạy thật, dựng theo thiết kế Sprint 1 "SCRUM-65 _ Login":
//   - thường: thẻ thương hiệu (logo, "Official Portal", Log In) + thẻ form + quick access + chân trang bảo mật
//   - bỏ trống: banner "Please complete all required fields" + viền đỏ, câu lỗi dưới ô
//   - sai tài khoản: banner "Authentication failed"
// Câu báo lỗi lấy từ src/validation (yêu cầu bắt buộc, không đổi chữ). Logic giữ như bản trước.
// =============================================================
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { validateEmail } from "../validation/rules";
import { validateLogin, LOGIN_MESSAGES, type LoginErrors } from "../validation/loginValidation";
import { loginUser, SERVER_UNAVAILABLE_MESSAGE } from "../services/auth";
import Icon from "../components/Icon";
import { AuthField, AuthFrame, AuthNav, BrandLogo, ErrorBanner, NavLinkButton, PrimaryButton } from "../components/auth/AuthUi";

type Banner = { kind: "missing" | "auth" | "other"; title: string; text: string } | null;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email || "";
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quickNote, setQuickNote] = useState(false);

  function onEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
    if (banner) setBanner(null);
  }
  function onPasswordChange(e: ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
    if (banner) setBanner(null);
  }
  // Rời ô email: chỉ kiểm tra định dạng nếu đã gõ (lỗi "bỏ trống" chỉ báo khi bấm Log In)
  function onEmailBlur() {
    if (email.trim()) setErrors((p) => ({ ...p, email: validateEmail(email) || undefined }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const formErrors = validateLogin({ email, password });
    setErrors(formErrors);
    setBanner(null);
    const missing = !email.trim() || !password; // ô bắt buộc còn trống → banner tổng hợp
    if (missing) {
      setBanner({
        kind: "missing",
        title: "Please complete all required fields",
        text: "Enter your email and account password to securely access your reservations.",
      });
    }
    if (formErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (formErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    const result = await loginUser(email, password);
    setSubmitting(false);
    if (result.ok) navigate("/home", { replace: true });
    else if (result.reason === "locked") setBanner({ kind: "other", title: "Account temporarily locked", text: LOGIN_MESSAGES.locked(result.minutesLeft) });
    else if (result.reason === "unavailable") setBanner({ kind: "other", title: "Connection problem", text: SERVER_UNAVAILABLE_MESSAGE });
    // Đúng mật khẩu nhưng chưa xác nhận email (P0-18) → sang màn nhập mã, có nút gửi lại mã.
    else if (result.reason === "unverified") navigate("/verify-email", { state: { email: result.email, fromLogin: true } });
    else setBanner({ kind: "auth", title: "Authentication failed", text: LOGIN_MESSAGES.invalidCredentials });
  }

  return (
    <AuthFrame muted>
      <AuthNav
        left={
          <NavLinkButton onClick={() => navigate("/")}>
            <Icon name="chevronLeft" size={18} /> Back
          </NavLinkButton>
        }
        center={<p className="text-[16px] font-semibold tracking-[1px] text-[#0b2341]">LOG IN</p>}
        right={
          <NavLinkButton tone="blue" onClick={() => navigate("/register")}>
            Register
          </NavLinkButton>
        }
      />

      <main className="flex flex-col gap-4 px-5 pt-5 pb-8">
        {/* Thẻ thương hiệu */}
        <section className="flex flex-col items-center rounded-2xl bg-white px-6 pt-8 pb-6 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
          <BrandLogo className="h-[84px] w-auto" />
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-[11px] font-medium text-[#0369a1]">
            <Icon name="shield" size={12} /> Official Portal
          </span>
          <h1 className="pt-2 text-[28px] leading-9 font-bold text-[#0b2341]">Log In</h1>
          <p className="text-[14px] leading-5 text-[#475569]">Customer Account Login</p>
        </section>

        {banner?.kind === "missing" && <ErrorBanner title={banner.title}>{banner.text}</ErrorBanner>}

        {/* Thẻ form */}
        <section className="rounded-2xl bg-white p-5 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            {banner && banner.kind !== "missing" && <ErrorBanner title={banner.title}>{banner.text}</ErrorBanner>}
            <AuthField
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              label="Email Address"
              placeholder="customer@example.com"
              icon="mail"
              soft
              tint={banner?.kind === "auth"}
              value={email}
              onChange={onEmailChange}
              onBlur={onEmailBlur}
              error={errors.email}
              inputRef={(el) => {
                emailRef.current = el;
              }}
              trailing={errors.email ? <span className="text-[#ef4444]"><Icon name="alertCircle" size={18} /></span> : undefined}
            />
            <AuthField
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              label="Password"
              placeholder={errors.password ? "Enter your password" : "••••••••••••"}
              icon="lock"
              soft
              tint={banner?.kind === "auth"}
              value={password}
              onChange={onPasswordChange}
              error={errors.password}
              inputRef={(el) => {
                passwordRef.current = el;
              }}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-[#0284c7]"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={15} />
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            />
            {banner?.kind === "auth" && <p className="-mb-2 text-[13px] font-semibold text-[#dc2626]">* Invalid email or password.</p>}
            {/* SCRUM-65: luồng Quên mật khẩu (mang theo email đã gõ) */}
            <button
              type="button"
              onClick={() => navigate("/forgot-password", { state: { email: email.trim() } })}
              data-testid="forgot-password-link"
              className="-mt-1 cursor-pointer self-end text-[12px] font-medium text-[#0284c7] hover:underline"
            >
              Forgot Password?
            </button>

            <PrimaryButton type="submit" disabled={submitting}>
              <Icon name="logIn" size={18} />
              {submitting ? "Logging in…" : "Log In"}
            </PrimaryButton>
          </form>

          <div className="flex items-center gap-3 pt-5 pb-3">
            <span className="h-px flex-1 bg-[#e2e8f0]" />
            <span className="text-[11px] font-medium tracking-[0.6px] text-[#64748b]">OR QUICK ACCESS</span>
            <span className="h-px flex-1 bg-[#e2e8f0]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "fingerprint" as const, label: "Face / Touch ID" },
              { icon: "key" as const, label: "Passkey" },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setQuickNote(true)}
                className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#f1f5f9] text-[12.5px] font-medium text-[#334155] hover:bg-[#e2e8f0]"
              >
                <Icon name={q.icon} size={16} /> {q.label}
              </button>
            ))}
          </div>
          {quickNote && (
            <p role="status" className="pt-2 text-center text-[11.5px] text-[#64748b]">
              Quick access is not available in this prototype. Please log in with your email and password.
            </p>
          )}
        </section>

        <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#475569]">
          <span className="text-[#0284c7]">
            <Icon name="shield" size={13} />
          </span>
          256-bit SSL End-to-End Secure Mobility Network
        </p>
        <p className="text-center text-[14px] text-[#334155]">
          Don&apos;t have an account?{" "}
          <button type="button" onClick={() => navigate("/register")} className="cursor-pointer font-semibold text-[#0284c7] underline underline-offset-2">
            Register / Sign Up
          </button>
        </p>
        <button type="button" onClick={() => navigate("/")} className="mx-auto flex cursor-pointer items-center gap-1 text-[12.5px] text-[#64748b] hover:underline">
          <Icon name="arrowLeft" size={14} /> Back to Welcome
        </button>
      </main>
    </AuthFrame>
  );
}
