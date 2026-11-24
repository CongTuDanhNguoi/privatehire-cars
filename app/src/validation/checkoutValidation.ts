// =============================================================
// checkoutValidation.ts — Kiểm tra số điện thoại nhận thông báo chuyến (màn Notification).
// Dùng chung app + backend. Không đổi validatePhone trong rules.ts (câu báo lỗi đăng ký là yêu cầu cố định).
// =============================================================

export const CHECKOUT_MESSAGES = {
  phoneRequired: "Phone number is required.",
  phoneFormat: "Check telephone number format (e.g. +44 7...).",
  agreeRequired: "Please confirm you have reviewed the fare.",
} as const;

// Bỏ khoảng trắng, dấu gạch, ngoặc. Giữ dấu + ở đầu nếu có.
export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s\-()]/g, "");
}

export function validateNotifyPhone(value?: string): string {
  const phone = normalizePhone(value ?? "");
  if (!phone) return CHECKOUT_MESSAGES.phoneRequired;
  if (!/^\+?\d{10,15}$/.test(phone)) return CHECKOUT_MESSAGES.phoneFormat;
  return "";
}
