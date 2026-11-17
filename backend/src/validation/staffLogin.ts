// Staff login form rules and messages (plan §9). Pure functions with no server-only imports,
// so the Staff Portal (web/) uses exactly the same rules and wording as the API.
import { validateEmail } from "../../../app/src/validation/rules";

export const STAFF_LOGIN_MESSAGES = {
  emailRequired: "Email address is required.",
  emailInvalid: "Enter a valid email address.",
  passwordRequired: "Password is required.",
  invalidCredentials: "Incorrect email or password.",
  locked: (minutes: number) => `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
};

export interface StaffLoginForm {
  email: string;
  password: string;
}
export type StaffLoginErrors = Partial<Record<keyof StaffLoginForm, string>>;

// Same email rule (regex, no spaces, no "..", max 254) as the customer app, staff wording.
export function validateStaffEmail(email: string): string {
  if (!email.trim()) return STAFF_LOGIN_MESSAGES.emailRequired;
  if (validateEmail(email)) return STAFF_LOGIN_MESSAGES.emailInvalid;
  return "";
}

export function validateStaffLogin({ email, password }: StaffLoginForm): StaffLoginErrors {
  const errors: StaffLoginErrors = {};
  const emailError = validateStaffEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = STAFF_LOGIN_MESSAGES.passwordRequired;
  return errors;
}
