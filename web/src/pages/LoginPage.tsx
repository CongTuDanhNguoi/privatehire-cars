// /login — Staff Login (plan §8.5 A).
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/logo.png";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { announce } from "../lib/announce";
import {
  validateStaffEmail,
  validateStaffLogin,
  type StaffLoginErrors,
} from "../../../be/src/validation/staffLogin";

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
    <main className="grid min-h-dvh place-items-center bg-muted px-4 py-12">
      <div className="w-[440px] rounded-xl border border-muted bg-surface p-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="PrivateHire Cars" width={140} height={72} className="h-[72px] w-auto" />
          <h1 className="text-page font-bold text-ink">Staff Portal</h1>
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
                <Button
                  variant="text"
                  className="px-3 text-label"
                  aria-pressed={showPassword}
                  aria-controls="password"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                  <span className="visually-hidden"> password</span>
                </Button>
              }
            />
            <Button type="submit" fullWidth loading={submitting} loadingText="Signing in…">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
