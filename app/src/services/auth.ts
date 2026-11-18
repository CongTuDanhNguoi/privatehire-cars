// =============================================================
// auth.ts — Đăng nhập / đăng ký khách hàng qua backend thật (backend/, MySQL).
// Giữ nguyên tên hàm + kiểu trả về như bản giả lập cũ, nên các màn hình không phải sửa giao diện.
//   - Phiên đăng nhập là cookie httpOnly do server cấp (phc_customer).
//   - getCurrentUser() vẫn chạy đồng bộ: đọc bộ nhớ đệm phiên, được nạp bằng initSession()
//     (gọi GET /api/customer/auth/me) trong main.tsx trước khi vẽ app.
// =============================================================
import type { RegistrationErrors, RegistrationForm } from "../validation/registerValidation";

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export const DEMO_ACCOUNT = {
  fullName: "Alex Morgan",
  email: "alex.morgan@example.com",
  password: "Password123",
} as const;

export interface SessionUser {
  email: string;
  fullName: string;
  loggedInAt: string;
}

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; minutesLeft: number }
  | { ok: false; reason: "unverified"; email: string } // đúng mật khẩu nhưng chưa xác nhận email (P0-18)
  | { ok: false; reason: "unavailable" }; // không kết nối được server

export interface RegisteredUser {
  email: string;
  fullName: string;
}

// Thông tin mã xác nhận email vừa gửi (P0-18).
export interface VerificationInfo {
  sentTo: string;
  emailSent: boolean; // false = gửi mail lỗi, người dùng bấm "Resend code"
  expiresInMinutes: number;
  resendInSeconds: number;
}

export type RegisterResult =
  | { ok: true; user: RegisteredUser; verification: VerificationInfo }
  | { ok: false; errors: RegistrationErrors };

export type VerifyEmailResult = { ok: true; user: RegisteredUser } | { ok: false; error: string };

export type ResendCodeResult =
  | { ok: true; verification: VerificationInfo }
  | { ok: false; error: string; retryAfterSeconds?: number };

export const SERVER_UNAVAILABLE_MESSAGE = "Can't reach the server. Check your connection and try again.";

// ---------- gọi API ----------
interface ApiReply {
  status: number; // 0 = không kết nối được
  data: Record<string, unknown> | null;
}

async function call(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; keepalive?: boolean } = {},
): Promise<ApiReply> {
  try {
    const res = await fetch(`/api/customer${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store", // kết quả phụ thuộc cookie phiên: không dùng bản lưu cũ khi bấm Back/Forward
      keepalive: init.keepalive,
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    // Server luôn trả lỗi dạng JSON; 5xx không có JSON = proxy không tới được server.
    if (res.status >= 500 && !data?.error) return { status: 0, data: null };
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

const errorOf = (data: Record<string, unknown> | null) =>
  (data?.error ?? {}) as {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
    minutesLeft?: number;
    retryAfterSeconds?: number;
    email?: string;
  };

// ---------- phiên đăng nhập (bộ nhớ đệm) ----------
let currentUser: SessionUser | null = null;

// Gọi 1 lần khi mở app: hỏi server ai đang đăng nhập (cookie).
export async function initSession(): Promise<void> {
  const { status, data } = await call("/auth/me");
  currentUser = status === 200 && data?.user ? (data.user as SessionUser) : null;
}

export function getCurrentUser(): SessionUser | null {
  return currentUser;
}

export function logout(): void {
  currentUser = null; // xoá ngay để RequireAuth chặn lại
  // Server xoá cookie (chạy nền). keepalive: yêu cầu vẫn gửi xong dù trang chuyển đi / F5 ngay sau khi bấm Log Out,
  // nếu không cookie còn sống và lần tải trang sau lại thấy như đang đăng nhập.
  void call("/auth/logout", { method: "POST", keepalive: true });
}

// Phiên hết hạn khi đang dùng (API trả 401) → coi như đã đăng xuất.
export function clearSession(): void {
  currentUser = null;
}

// ---------- tài khoản ----------
export async function isEmailRegistered(email: string): Promise<boolean> {
  const { status, data } = await call(`/auth/email-exists?email=${encodeURIComponent(email.trim())}`);
  return status === 200 && data?.exists === true;
}

// Đăng ký: server kiểm tra lỗi (cùng luật với src/validation) và lưu MySQL.
// KHÔNG tự đăng nhập (SCRUM-12 / DEF-05): khách phải vào /login và nhập lại mật khẩu.
// P0-18: server gửi mã 6 số tới email vừa đăng ký; phải nhập mã (/verify-email) mới đăng nhập được.
export async function registerUser(form: RegistrationForm): Promise<RegisterResult> {
  const { status, data } = await call("/auth/register", { method: "POST", body: form });
  if (status === 201 && data?.user) {
    const user = data.user as RegisteredUser;
    return {
      ok: true,
      user: { email: user.email, fullName: user.fullName },
      verification: data.verification as VerificationInfo,
    };
  }
  if (status === 0) return { ok: false, errors: { email: SERVER_UNAVAILABLE_MESSAGE } };
  const err = errorOf(data);
  if (err.fields && Object.keys(err.fields).length > 0) return { ok: false, errors: err.fields as RegistrationErrors };
  return { ok: false, errors: { email: err.message ?? SERVER_UNAVAILABLE_MESSAGE } };
}

// ---------- xác nhận email bằng mã OTP (P0-18) ----------
export async function verifyEmail(email: string, code: string): Promise<VerifyEmailResult> {
  const { status, data } = await call("/auth/verify-email", { method: "POST", body: { email, code } });
  if (status === 200 && data?.user) return { ok: true, user: data.user as RegisteredUser };
  if (status === 0) return { ok: false, error: SERVER_UNAVAILABLE_MESSAGE };
  const err = errorOf(data);
  return { ok: false, error: err.fields?.code ?? err.message ?? SERVER_UNAVAILABLE_MESSAGE };
}

export async function resendVerificationCode(email: string): Promise<ResendCodeResult> {
  const { status, data } = await call("/auth/resend-code", { method: "POST", body: { email } });
  if (status === 200 && data?.verification) return { ok: true, verification: data.verification as VerificationInfo };
  if (status === 0) return { ok: false, error: SERVER_UNAVAILABLE_MESSAGE };
  const err = errorOf(data);
  return { ok: false, error: err.message ?? SERVER_UNAVAILABLE_MESSAGE, retryAfterSeconds: err.retryAfterSeconds };
}

// ---------- đăng nhập ----------
export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const { status, data } = await call("/auth/login", { method: "POST", body: { email, password } });
  if (status === 200 && data?.user) {
    currentUser = data.user as SessionUser;
    return { ok: true, user: currentUser };
  }
  if (status === 0) return { ok: false, reason: "unavailable" };
  const err = errorOf(data);
  if (status === 423) return { ok: false, reason: "locked", minutesLeft: err.minutesLeft ?? LOCK_MINUTES };
  if (err.code === "EMAIL_NOT_VERIFIED") return { ok: false, reason: "unverified", email: err.email ?? email.trim() };
  // Không phân biệt "email chưa đăng ký" và "sai mật khẩu" để không lộ thông tin
  return { ok: false, reason: "invalid" };
}
