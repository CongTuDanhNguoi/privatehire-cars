// Shared caller telephone OTP validation for SCRUM-25 / SCRUM-107.
// Separate from app/src/validation/otpValidation.ts (registration email OTP).

export const CALLER_OTP_LENGTH = 6;
export const CALLER_OTP_TTL_MINUTES = 5;
export const CALLER_OTP_MAX_ATTEMPTS = 3;

export const CALLER_OTP_MESSAGES = {
  required: "Enter the 6-digit verification code.",
  format: "The verification code must be 6 numeric digits.",
  incorrect: (left: number) =>
    `Incorrect verification code. ${left} attempt${left === 1 ? "" : "s"} remaining.`,
  expired: "This verification code has expired. Request a new code.",
  exhausted: "Maximum attempts reached (3 of 3). Request a new verification code.",
  invalidated: "This verification code is no longer valid. Request a new code.",
} as const;

export const normalizeCallerOtp = (value: string): string => value.replace(/[\s-]/g, "");

export function validateCallerOtp(value?: string): string {
  const code = normalizeCallerOtp(value ?? "");
  if (!code) return CALLER_OTP_MESSAGES.required;
  if (!/^\d{6}$/.test(code)) return CALLER_OTP_MESSAGES.format;
  return "";
}
