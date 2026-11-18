// Email verification for new customer accounts (decision P0-18):
// register → 6-digit code by email (valid 10 min, 5 wrong tries, resend after 60 s) → verify → may log in.
// Codes are stored as an HMAC (never in plain text). Verification emails always go to the address being verified.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { config } from "../config.js";
import { pool } from "../db.js";
import { emailSettings, sendEmail } from "../email/index.js";
import { AppError, validationError } from "../errors.js";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MESSAGES,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  normalizeOtp,
  validateOtp,
} from "../../../app/src/validation/otpValidation";
import { normalizeEmail } from "./loginAttempts.js";

export interface VerificationInfo {
  sentTo: string;
  emailSent: boolean;
  expiresInMinutes: number;
  resendInSeconds: number;
}

const hashCode = (code: string) => createHmac("sha256", config.jwtSecret).update(code).digest("hex");

// The last code per email that was NOT really emailed (MOCK provider, or a reserved test address below),
// so automated tests can read it through /api/dev (never mounted in production). Real addresses are never stored.
export const mockCodes = new Map<string, string>();

// RFC 2606 / 6761 reserved domains can never receive mail (e.g. the self-test's new.user+…@example.com).
// Sending them through EmailJS would only waste the monthly quota, so their code is kept for tests instead.
const RESERVED_DOMAIN = /@(example\.(com|net|org)|[^@]+\.(example|test|invalid|localhost))$/i;
export const isReservedTestEmail = (email: string) => RESERVED_DOMAIN.test(email);

interface CustomerRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  email_verified_at: Date | null;
}

async function findCustomer(rawEmail: string): Promise<CustomerRow | undefined> {
  const [rows] = await pool.execute<CustomerRow[]>(
    "SELECT id, full_name, email, email_verified_at FROM customers WHERE email = ?",
    [normalizeEmail(rawEmail)],
  );
  return rows[0];
}

// Creates a new code (replacing any previous one) and emails it. Throws 429 while the resend cooldown is running.
export async function issueVerificationCode(
  customer: { id: number; email: string; fullName: string },
  { enforceCooldown }: { enforceCooldown: boolean },
): Promise<VerificationInfo> {
  if (enforceCooldown) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT TIMESTAMPDIFF(SECOND, last_sent_at, UTC_TIMESTAMP()) AS ago FROM email_verifications WHERE customer_id = ?",
      [customer.id],
    );
    const ago = rows[0] ? Number(rows[0].ago) : Infinity;
    if (ago < OTP_RESEND_SECONDS) {
      const wait = OTP_RESEND_SECONDS - ago;
      throw new AppError("TOO_MANY_REQUESTS", OTP_MESSAGES.resendWait(wait), { retryAfterSeconds: wait });
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await pool.execute(
    `INSERT INTO email_verifications (customer_id, code_hash, expires_at, attempts, last_sent_at)
     VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, 0, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), attempts = 0,
                             last_sent_at = VALUES(last_sent_at)`,
    [customer.id, hashCode(code), OTP_TTL_MINUTES],
  );
  const notDelivered = emailSettings.provider === "MOCK" || isReservedTestEmail(customer.email);
  if (notDelivered) mockCodes.set(customer.email, code);
  if (emailSettings.provider !== "MOCK" && isReservedTestEmail(customer.email)) {
    console.log(`[verification] ${customer.email} is a reserved test address — code not emailed (read it via /api/dev).`);
    return { sentTo: customer.email, emailSent: true, expiresInMinutes: OTP_TTL_MINUTES, resendInSeconds: OTP_RESEND_SECONDS };
  }

  const result = await sendEmail({
    customerEmail: customer.email,
    customerName: customer.fullName,
    subject: "Your PrivateHire Cars verification code",
    body:
      `Your verification code is ${code}.\n\n` +
      `Enter it in the PrivateHire Cars app to confirm your email address. ` +
      `The code expires in ${OTP_TTL_MINUTES} minutes.\n\n` +
      `If you did not create an account, you can ignore this email.`,
    enquiryCode: "Email verification",
    bypassTestMode: true,
    verificationCode: code,
    expiresInMinutes: OTP_TTL_MINUTES,
  });
  if (result.ok) console.log(`[verification] code emailed to ${customer.email}`);
  else console.warn(`[verification] email to ${customer.email} failed: ${result.error}`);

  return { sentTo: customer.email, emailSent: result.ok, expiresInMinutes: OTP_TTL_MINUTES, resendInSeconds: OTP_RESEND_SECONDS };
}

// Checks a code. Wrong codes count towards the limit; the right one marks the email as verified.
export async function verifyEmailCode(rawEmail: string, rawCode: string): Promise<{ email: string; fullName: string }> {
  const formatError = validateOtp(rawCode);
  if (formatError) throw validationError({ code: formatError }, formatError);

  const customer = await findCustomer(rawEmail);
  if (!customer) throw validationError({ code: OTP_MESSAGES.expired }, OTP_MESSAGES.expired);
  const user = { email: customer.email, fullName: customer.full_name };
  if (customer.email_verified_at) return user; // already verified (e.g. a double click)

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT code_hash, attempts, expires_at < UTC_TIMESTAMP() AS expired FROM email_verifications WHERE customer_id = ?",
    [customer.id],
  );
  const row = rows[0];
  const fail = (message: string) => validationError({ code: message }, message);
  if (!row || Number(row.expired)) throw fail(OTP_MESSAGES.expired);
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw fail(OTP_MESSAGES.tooMany);

  const given = Buffer.from(hashCode(normalizeOtp(rawCode)), "hex");
  const stored = Buffer.from(String(row.code_hash), "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    const attempts = row.attempts + 1;
    await pool.execute("UPDATE email_verifications SET attempts = ? WHERE customer_id = ?", [attempts, customer.id]);
    const left = OTP_MAX_ATTEMPTS - attempts;
    throw fail(left > 0 ? OTP_MESSAGES.incorrect(left) : OTP_MESSAGES.tooMany);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("UPDATE customers SET email_verified_at = UTC_TIMESTAMP() WHERE id = ?", [customer.id]);
    await conn.execute("DELETE FROM email_verifications WHERE customer_id = ?", [customer.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  mockCodes.delete(customer.email);
  return user;
}

// "Resend code". Unknown or already-verified emails get the same answer, so nobody can probe which emails exist.
export async function resendVerificationCode(rawEmail: string): Promise<VerificationInfo> {
  const customer = await findCustomer(rawEmail);
  if (!customer || customer.email_verified_at) {
    return {
      sentTo: normalizeEmail(rawEmail),
      emailSent: true,
      expiresInMinutes: OTP_TTL_MINUTES,
      resendInSeconds: OTP_RESEND_SECONDS,
    };
  }
  return issueVerificationCode(
    { id: customer.id, email: customer.email, fullName: customer.full_name },
    { enforceCooldown: true },
  );
}
