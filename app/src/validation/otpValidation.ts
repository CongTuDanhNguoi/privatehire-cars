// =============================================================
// otpValidation.ts — Mã xác nhận email (OTP 6 số) khi đăng ký.
// Dùng chung cho app Customer (màn /verify-email) và backend/, nên câu báo lỗi luôn giống nhau.
// =============================================================

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;

export const OTP_MESSAGES = {
  required: "Enter the 6-digit code.",
  format: "The code must be 6 digits.",
  incorrect: (left: number) => `The code is incorrect. ${left} attempt${left === 1 ? "" : "s"} left.`,
  expired: "This code has expired. Request a new code.",
  tooMany: "Too many incorrect attempts. Request a new code.",
  verifyFirst: "Please verify your email address first. Enter the code we sent to your email.",
  resendWait: (seconds: number) => `Please wait ${seconds} seconds before requesting a new code.`,
  sendFailed: "We couldn't send the verification email. Please request a new code.",
} as const;

// Bỏ dấu cách/gạch (người dùng hay dán "123 456"), giữ đúng chuỗi số.
export const normalizeOtp = (value: string) => value.replace(/[\s-]/g, "");

export function validateOtp(value: string): string {
  const code = normalizeOtp(value);
  if (!code) return OTP_MESSAGES.required;
  if (!/^\d{6}$/.test(code)) return OTP_MESSAGES.format;
  return "";
}
