// Request body schemas for the auth routes.
// zod only checks the *shape* (every field is a string). Field rules and their exact messages are reused
// from the customer app's src/validation so the browser and the server always show the same text.
import { z } from "zod";
import { validationError } from "../errors.js";

const text = z.string().default("");

export const LoginBody = z.object({ email: text, password: text });
export type LoginBody = z.infer<typeof LoginBody>;

export const RegisterBody = z.object({
  fullName: text,
  email: text,
  homeAddress: text,
  phone: text,
  cardholderName: text,
  cardNumber: text,
  expiry: text,
  cvv: text,
  password: text,
  confirmPassword: text,
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const EmailQuery = z.object({ email: text });

// Parses a body/query against a schema; a wrong type (e.g. a number instead of a string) becomes a 400.
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "body");
    fields[key] ??= "Invalid value.";
  }
  throw validationError(fields, "Request is missing required fields or has invalid values.");
}

// ---------- Staff login: rules shared with the Staff Portal ----------
export { STAFF_LOGIN_MESSAGES, validateStaffLogin } from "./staffLogin.js";
