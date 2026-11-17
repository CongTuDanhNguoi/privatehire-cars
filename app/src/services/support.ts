// =============================================================
// support.ts — Gửi câu hỏi (enquiry) tới đội hỗ trợ qua backend/.
// Nhân viên xem và trả lời trong Staff Portal.
// =============================================================
import { clearSession, SERVER_UNAVAILABLE_MESSAGE } from "./auth";
import type { EnquiryErrors, EnquiryType } from "../validation/enquiryValidation";

export interface Booking {
  id: number;
  bookingRef: string;
  serviceName: string;
  pickupLocation: string;
  destination: string;
  journeyDateTime: string;
  passengerCount: number;
  vehicleSize: string;
}

export interface MyEnquiry {
  id: number;
  code: string;
  type: EnquiryType;
  subject: string;
  status: "AWAITING" | "RESOLVED";
  createdAt: string;
}

// Kết quả chung: ok + dữ liệu, hoặc lỗi (kèm lỗi từng ô nếu server trả về).
export type SupportResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unavailable" | "signedOut" | "error"; message: string; fields?: EnquiryErrors };

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<SupportResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/customer${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    return { ok: false, reason: "unavailable", message: SERVER_UNAVAILABLE_MESSAGE };
  }
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return { ok: true, data: data as T };
  const error = (data?.error ?? {}) as { message?: string; fields?: EnquiryErrors };
  if (res.status >= 500 && !data?.error) return { ok: false, reason: "unavailable", message: SERVER_UNAVAILABLE_MESSAGE };
  if (res.status === 401) {
    clearSession();
    return { ok: false, reason: "signedOut", message: error.message ?? "Your session has expired. Please sign in again." };
  }
  return {
    ok: false,
    reason: "error",
    message: res.status >= 500 ? "Something went wrong. Please try again." : (error.message ?? "Something went wrong. Please try again."),
    fields: error.fields,
  };
}

export const listMyBookings = () => call<{ bookings: Booking[] }>("/bookings");
export const listMyEnquiries = () => call<{ enquiries: MyEnquiry[] }>("/enquiries");
export const sendEnquiry = (body: { type: EnquiryType; bookingId: number | null; subject: string; message: string }) =>
  call<{ enquiry: { id: number; code: string; status: string; createdAt: string } }>("/enquiries", { method: "POST", body });

// Giờ chuyến xe là giờ UK: hiển thị đúng giờ London dù máy đang ở múi giờ nào.
export function formatUkDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatLocalDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
