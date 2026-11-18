// =============================================================
// RegisterPage — màn Đăng ký chạy thật, dựng theo thiết kế Sprint 1
// "2. Registration Form" + "2A. Registration Validation Errors":
// header logo | Registration | Login, ô nhập viền xám, lỗi: viền đỏ + nền đỏ nhạt + "* <câu lỗi>" bên dưới,
// nhóm PAYMENT INFORMATION / ACCOUNT SECURITY, nút Create Account (primary).
// Câu báo lỗi lấy từ src/validation (yêu cầu bắt buộc). Logic (định dạng thẻ, ngày hết hạn, OTP) giữ như cũ.
// =============================================================
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { AuthField, AuthFrame, AuthNav, BrandLogo, NavLinkButton, PrimaryButton } from "../components/auth/AuthUi";
import {
  EMPTY_REGISTRATION,
  REGISTRATION_FIELDS,
  validateRegistration,
  validateRegistrationField,
  type RegistrationErrors,
  type RegistrationField,
  type RegistrationForm,
} from "../validation/registerValidation";
import { formatCardNumber, formatExpiry } from "../validation/format";
import { registerUser } from "../services/auth";

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="border-t border-[#e2e8f0] pt-4 text-[11.5px] leading-4 font-semibold tracking-[0.6px] text-[#0b2341] uppercase">
      {title} <span className="text-[#ef4444]">*</span>
    </h2>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegistrationForm>(EMPTY_REGISTRATION);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Partial<Record<RegistrationField, HTMLInputElement | null>>>({});

  // Email trùng do server kiểm tra khi bấm Create Account (409 → câu báo lỗi dưới ô email).
  const opts = {};

  function change(name: RegistrationField) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Số thẻ tự cách nhóm 4 số, ngày hết hạn tự thêm "/"
      const value =
        name === "cardNumber" ? formatCardNumber(raw) : name === "expiry" ? formatExpiry(raw, form.expiry) : raw;
      setForm((f) => ({ ...f, [name]: value }));
      if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
    };
  }

  // Rời ô: chỉ báo lỗi định dạng khi đã gõ (ô trống chỉ báo khi bấm Create Account)
  function blur(name: RegistrationField) {
    return () => {
      if (!form[name].trim()) return;
      setErrors((er) => ({ ...er, [name]: validateRegistrationField(name, form, opts) || undefined }));
      // Gõ lại mật khẩu thì kiểm tra lại ô xác nhận
      if (name === "password" && form.confirmPassword) {
        setErrors((er) => ({ ...er, confirmPassword: validateRegistrationField("confirmPassword", form, opts) || undefined }));
      }
    };
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const found = validateRegistration(form, opts);
    setErrors(found);
    const first = REGISTRATION_FIELDS.find((f) => found[f]);
    if (first) {
      inputs.current[first]?.focus();
      return;
    }
    setSubmitting(true);
    const result = await registerUser(form);
    setSubmitting(false);
    // P0-18: tài khoản mới phải nhập mã OTP gửi qua email trước khi sang Registration Complete.
    if (result.ok) {
      navigate("/verify-email", {
        replace: true,
        state: { email: result.user.email, emailSent: result.verification.emailSent },
      });
    } else setErrors(result.errors);
  }

  const field = (name: RegistrationField) => ({
    id: name,
    name,
    value: form[name],
    error: errors[name],
    onChange: change(name),
    onBlur: blur(name),
    inputRef: (el: HTMLInputElement | null) => {
      inputs.current[name] = el;
    },
  });

  const eye = (shown: boolean, toggle: () => void, label: string) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={shown}
      className="flex cursor-pointer items-center text-[#64748b] hover:text-[#0b2341]"
    >
      <Icon name={shown ? "eyeOff" : "eye"} size={18} />
    </button>
  );

  return (
    <AuthFrame>
      <AuthNav
        left={
          <button type="button" onClick={() => navigate("/")} aria-label="Back to Welcome" className="cursor-pointer">
            <BrandLogo className="h-8 w-auto" />
          </button>
        }
        center={<h1 className="text-[17px] leading-6 font-bold text-[#0b2341]">Registration</h1>}
        right={<NavLinkButton onClick={() => navigate("/login")}>Login</NavLinkButton>}
      />

      <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-5 pt-4 pb-8">
        <AuthField {...field("fullName")} label="Full Name" autoComplete="name" placeholder="Enter full name" />
        <AuthField
          {...field("email")}
          label="Email Address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          trailing={errors.email ? <span className="text-[#ef4444]"><Icon name="alertCircle" size={18} /></span> : undefined}
        />
        <AuthField {...field("homeAddress")} label="Home Address" autoComplete="street-address" placeholder="Street address, City, Postcode" />
        <AuthField {...field("phone")} label="Phone Number" type="tel" inputMode="tel" autoComplete="tel" placeholder="+44 7XXX XXXXXX" />

        <SectionTitle title="Payment information (test data only)" />
        <AuthField {...field("cardholderName")} label="Cardholder Name" autoComplete="cc-name" placeholder="Name on card" />
        <AuthField
          {...field("cardNumber")}
          label="Card Number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 **** **** 4242"
          maxLength={23}
        />
        <div className="grid grid-cols-2 gap-3">
          <AuthField {...field("expiry")} label="Expiry Date (MM/YY)" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={7} center />
          <AuthField {...field("cvv")} label="CVV / CVC" type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="***" maxLength={4} center />
        </div>

        <SectionTitle title="Account security" />
        <AuthField
          {...field("password")}
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          trailing={eye(showPassword, () => setShowPassword((v) => !v), "password")}
        />
        <AuthField
          {...field("confirmPassword")}
          label="Confirm Password"
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          trailing={eye(showConfirm, () => setShowConfirm((v) => !v), "confirm password")}
        />

        <PrimaryButton type="submit" disabled={submitting} className="mt-2">
          {submitting ? "Creating account…" : "Create Account"}
        </PrimaryButton>
        <p className="text-center text-[14px] text-[#334155]">
          Already have an account?{" "}
          <button type="button" onClick={() => navigate("/login")} className="cursor-pointer font-semibold text-[#0b2341] underline underline-offset-2">
            Go to Login
          </button>
        </p>
      </form>
    </AuthFrame>
  );
}
