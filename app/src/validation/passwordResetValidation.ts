// =============================================================
// passwordResetValidation.ts — Quên mật khẩu (SCRUM-65): mã 4 số gửi qua email → đổi mật khẩu.
// Dùng chung cho app Customer và backend/, nên câu báo lỗi luôn giống nhau.
// Mật khẩu mới dùng lại luật đăng ký (validateNewPassword / validateConfirmPassword trong rules.ts).
// =============================================================
import { validateConfirmPassword, validateNewPassword } from "./rules";

export const RESET_CODE_LENGTH = 4;
export const RESET_CODE_TTL_MINUTES = 10;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_RESEND_SECONDS = 60;
export const RESET_TOKEN_TTL_MINUTES = 15; // sau khi nhập đúng mã, có 15 phút để đặt mật khẩu mới

export const RESET_MESSAGES = {
  required: "Enter the 4-digit code.",
  format: "The code must be 4 digits.",
  incorrect: (left: number) => `The code is incorrect. ${left} attempt${left === 1 ? "" : "s"} left.`,
  expired: "This code has expired. Request a new code.",
  tooMany: "Too many incorrect attempts. Request a new code.",
  resendWait: (seconds: number) => `Please wait ${seconds} seconds before requesting a new code.`,
  sessionExpired: "Your reset session has expired. Please request a new code.",
  notRegistered: "This email address is not registered. Please check it or sign up.",
} as const;

export const normalizeResetCode = (value: string) => value.replace(/[\s-]/g, "");

export function validateResetCode(value: string): string {
  const code = normalizeResetCode(value);
  if (!code) return RESET_MESSAGES.required;
  if (!/^\d{4}$/.test(code)) return RESET_MESSAGES.format;
  return "";
}

export interface ChangePasswordForm {
  password: string;
  confirmPassword: string;
}
export type ChangePasswordErrors = Partial<Record<keyof ChangePasswordForm, string>>;

export function validateChangePassword(form: ChangePasswordForm, email = ""): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  const password = validateNewPassword(form.password, email);
  const confirmPassword = validateConfirmPassword(form.confirmPassword, form.password);
  if (password) errors.password = password;
  if (confirmPassword) errors.confirmPassword = confirmPassword;
  return errors;
}

// "chris.morgan@domain.com" → "ch*******@domain.com" (như thiết kế Verify Code)
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}
