import { api } from "./client";
import type {
  CustomerSearchCandidate,
  NewCustomerBeginResponse,
  SimulatedOtpResponse,
  StaffCustomerBooking,
  VerifiedCustomerProfile,
} from "../types";

export const customersApi = {
  searchByPhone(phone: string, signal?: AbortSignal) {
    const qs = new URLSearchParams({ phone });
    return api<{ customers: CustomerSearchCandidate[] }>(`/staff/customers/search?${qs}`, { signal });
  },
  clearCallerSession() {
    return api<void>("/staff/customers/session/clear", { method: "POST" });
  },
  sendOtp(customerId: number) {
    return api<SimulatedOtpResponse>(`/staff/customers/${customerId}/otp/send`, { method: "POST" });
  },
  verifyOtp(customerId: number, code: string) {
    return api<{ verified: true; customerId: number }>(`/staff/customers/${customerId}/otp/verify`, {
      method: "POST",
      body: { code },
    });
  },
  getProfile(customerId: number) {
    return api<{ customer: VerifiedCustomerProfile }>(`/staff/customers/${customerId}`);
  },
  getBookings(customerId: number) {
    return api<{ bookings: StaffCustomerBooking[] }>(`/staff/customers/${customerId}/bookings`);
  },
  sendNewCustomerOtp(phone: string) {
    return api<SimulatedOtpResponse>("/staff/customers/new/otp/send", {
      method: "POST",
      body: { phone },
    });
  },
  verifyNewCustomerOtp(phone: string, code: string) {
    return api<{ verified: true; phoneNormalized: string }>("/staff/customers/new/otp/verify", {
      method: "POST",
      body: { phone, code },
    });
  },
  beginNewCustomerCreation(phone: string) {
    return api<NewCustomerBeginResponse>("/staff/customers/new/begin", {
      method: "POST",
      body: { phone },
    });
  },
  getNewCustomerEntry() {
    return api<NewCustomerBeginResponse>("/staff/customers/new/entry");
  },
};
