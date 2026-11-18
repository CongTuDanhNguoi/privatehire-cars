// /login — Staff Login (plan §8.5 A).
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/logo-transparent.png";
import logoWhite from "../assets/logo-white.png";
import type { IconName } from "../components/ui/Icon";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { TextField } from "../components/ui/Field";
import { announce } from "../lib/announce";
import {
  validateStaffEmail,
  validateStaffLogin,
  type StaffLoginErrors,
} from "../../../backend/src/validation/staffLogin";

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "inbox", title: "One inbox", text: "General & trip-specific enquiries in one place" },
  { icon: "mail", title: "Email replies", text: "Reply by email, retry if sending fails" },
  { icon: "check", title: "Clear status", text: "Awaiting / Resolved at a glance" },
];

export default function LoginPage() {
  const { signIn, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<StaffLoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  function onEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
    setFormError(null);
  }
  function onPasswordChange(e: ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
    setFormError(null);
  }
  // Format errors only after the user leaves a field they typed in; "required" only on submit.
  function onEmailBlur() {
    if (!email.trim()) return;
    const message = validateStaffEmail(email);
    if (message) {
      setErrors((p) => ({ ...p, email: message }));
      announce(`Email address: ${message}`, "polite", 500);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    clearNotice();
    setFormError(null);
    const found = validateStaffLogin({ email, password });
    setErrors(found);
    // Focus the first invalid field: its error is read out when focus arrives.
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from && from !== "/login" ? from : "/enquiries", { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && Object.keys(err.fields).length) {
        setErrors(err.fields);
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (decorative summary of what the portal does). Hidden on phones: the form alone fits the screen. */}
      <section aria-label="About the Staff Portal" className="hidden flex-col justify-between gap-10 bg-ink p-10 text-surface md:flex lg:p-14">
        <img src={logoWhite} alt="PrivateHire Cars" width={195} height={101} className="h-20 w-fit" />

        <div className="flex max-w-[440px] flex-col gap-6">
          <span className="w-fit rounded-full bg-surface/10 px-3 py-1 text-helper font-semibold uppercase">Staff Portal</span>
          <div className="flex flex-col gap-3">
            <p className="text-page font-bold text-balance">Customer enquiries, answered fast.</p>
            <p className="text-body text-pretty text-surface/75">
              Read what customers ask, reply by email and keep every enquiry on track.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4 rounded-xl border border-surface/10 bg-surface/5 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                  <Icon name={f.icon} size={20} />
                </span>
                <span className="flex flex-col">
                  <span className="text-label font-semibold">{f.title}</span>
                  <span className="text-helper text-surface/75">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-helper text-surface/60">© 2026 PrivateHire Cars · Staff Portal</p>
      </section>

      <div className="flex items-center justify-center bg-surface px-4 py-10 sm:px-8 sm:py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center md:items-start md:text-left">
          {/* On desktop the logo is in the brand panel; phones show it here. */}
          <img src={logo} alt="PrivateHire Cars" width={195} height={101} className="h-20 w-auto md:hidden" />
          <h1 className="text-page font-bold text-balance text-ink">Staff Portal</h1>
          <p className="text-body text-ink">Sign in to manage customer enquiries</p>
        </div>

        <div className="flex flex-col gap-5">
          {notice && (
            <Alert variant="info" title="Signed out">
              {notice}
            </Alert>
          )}
          {formError && <Alert variant="error" title={formError} />}

          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
            <TextField
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              label="Email"
              required
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              value={email}
              onChange={onEmailChange}
              onBlur={onEmailBlur}
              error={errors.email}
            />
            <TextField
              ref={passwordRef}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              required
              autoComplete="current-password"
              enterKeyHint="done"
              value={password}
              onChange={onPasswordChange}
              error={errors.password}
              trailing={
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  onClick={() => setShowPassword((v) => !v)}
                  className="mr-1 grid size-9 place-items-center rounded-md text-ink/70 hover:bg-muted/60 hover:text-ink"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={20} />
                </button>
              }
            />
            <Button type="submit" fullWidth loading={submitting} loadingText="Signing in…">
              Sign in
            </Button>
          </form>
        </div>
      </div>
      </div>
    </main>
  );
}
