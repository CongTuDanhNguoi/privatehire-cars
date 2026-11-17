import type { EmailSettings, Staff } from "../types";
import { api } from "./client";

export const staffAuthApi = {
  me: () => api<{ staff: Staff }>("/staff/auth/me", { skipAuthRedirect: true }),
  login: (email: string, password: string) =>
    api<{ staff: Staff }>("/staff/auth/login", { method: "POST", body: { email, password }, skipAuthRedirect: true }),
  logout: () => api<void>("/staff/auth/logout", { method: "POST", skipAuthRedirect: true }),
};

export const emailSettingsApi = {
  get: () => api<EmailSettings>("/staff/email-settings"),
};
