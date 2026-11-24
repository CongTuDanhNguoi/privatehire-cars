// Forgot password (SCRUM-65):
// email → 4-digit code by email (valid 10 min, 5 wrong tries, resend after 60 s) → right code gives a one-time
// reset token (15 min) → new password. Codes and tokens are stored as an HMAC, never in plain text.
// Step 1 tells the customer when an email is not registered (requested by the team).
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { config } from "../config.js";
import { pool } from "../db.js";
import { emailSettings, sendEmail } from "../email/index.js";
import { AppError, validationError } from "../errors.js";
import { validateEmail } from "../../../app/src/validation/rules";
import {
  RESET_CODE_TTL_MINUTES,
  RESET_MAX_ATTEMPTS,
  RESET_MESSAGES,
  RESET_RESEND_SECONDS,
  RESET_TOKEN_TTL_MINUTES,
  normalizeResetCode,
  validateChangePassword,
  validateResetCode,
} from "../../../app/src/validation/passwordResetValidation";
import { isReservedTestEmail } from "./emailVerificationService.js";
import { clearAttempts, normalizeEmail } from "./loginAttempts.js";
import { hashPassword } from "./passwords.js";

const hmac = (value: string) => createHmac("sha256", config.jwtSecret).update(`reset:${value}`).digest("hex");
const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
};

// Codes that were NOT really emailed (MOCK provider / reserved test domains), readable via /api/dev for tests.
export const mockResetCodes = new Map<string, string>();

// Resend cooldown per registered email. shortcut: in memory, resets when the server restarts; move to password_resets.last_sent_at if that matters.
const lastRequestAt = new Map<string, number>();

// Databases created before SCRUM-65 (e.g. production) get the table on first use.
let tableReady: Promise<unknown> | null = null;
const ensureTable = () =>
  (tableReady ??= pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
    customer_id      INT UNSIGNED PRIMARY KEY,
    code_hash        CHAR(64)     NOT NULL,
    expires_at       DATETIME     NOT NULL,
    attempts         TINYINT UNSIGNED NOT NULL DEFAULT 0,
    last_sent_at     DATETIME     NOT NULL,
    token_hash       CHAR(64)     NULL,
    token_expires_at DATETIME     NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch((err) => {
    tableReady = null;
    throw err;
  }));

interface CustomerRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
}

async function findCustomer(email: string): Promise<CustomerRow | undefined> {
  const [rows] = await pool.execute<CustomerRow[]>("SELECT id, full_name, email FROM customers WHERE email = ?", [email]);
  return rows[0];
}

function checkEmail(raw: string): string {
  const error = validateEmail(raw);
  if (error) throw validationError({ email: error }, error);
  return normalizeEmail(raw);
}

export interface ResetRequestInfo {
  sentTo: string;
  expiresInMinutes: number;
  resendInSeconds: number;
}

// Step 1 — "Send Verification Code" (also used by "Resend Code").
export async function requestPasswordReset(rawEmail: string): Promise<ResetRequestInfo> {
  const email = checkEmail(rawEmail);
  const info = { sentTo: email, expiresInMinutes: RESET_CODE_TTL_MINUTES, resendInSeconds: RESET_RESEND_SECONDS };

  // Unregistered email → error on the email field (the app already exposes /auth/email-exists, so this hides nothing).
  const customer = await findCustomer(email);
  if (!customer) throw validationError({ email: RESET_MESSAGES.notRegistered }, RESET_MESSAGES.notRegistered);

  const ago = (Date.now() - (lastRequestAt.get(email) ?? 0)) / 1000;
  if (ago < RESET_RESEND_SECONDS) {
    const wait = Math.ceil(RESET_RESEND_SECONDS - ago);
    throw new AppError("TOO_MANY_REQUESTS", RESET_MESSAGES.resendWait(wait), { retryAfterSeconds: wait });
  }
  lastRequestAt.set(email, Date.now());

  await ensureTable();

  const code = String(randomInt(0, 10_000)).padStart(4, "0");
  await pool.execute(
    `INSERT INTO password_resets (customer_id, code_hash, expires_at, attempts, last_sent_at, token_hash, token_expires_at)
     VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, 0, UTC_TIMESTAMP(), NULL, NULL)
     ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), attempts = 0,
                             last_sent_at = VALUES(last_sent_at), token_hash = NULL, token_expires_at = NULL`,
    [customer.id, hmac(code), RESET_CODE_TTL_MINUTES],
  );

  const notDelivered = emailSettings.provider === "MOCK" || isReservedTestEmail(customer.email);
  if (notDelivered) mockResetCodes.set(customer.email, code);
  if (emailSettings.provider !== "MOCK" && isReservedTestEmail(customer.email)) {
    console.log(`[password-reset] ${customer.email} is a reserved test address — code not emailed (read it via /api/dev).`);
    return info;
  }

  const result = await sendEmail({
    customerEmail: customer.email,
    customerName: customer.full_name,
    subject: "Your PrivateHire Cars password reset code",
    body:
      `Your password reset code is ${code}.\n\n` +
      `Enter it in the PrivateHire Cars app to choose a new password. ` +
      `The code expires in ${RESET_CODE_TTL_MINUTES} minutes.\n\n` +
      `If you did not ask to reset your password, you can ignore this email — your password stays the same.`,
    enquiryCode: "Password reset",
    bypassTestMode: true,
    verificationCode: code,
    codePurpose: "reset",
    expiresInMinutes: RESET_CODE_TTL_MINUTES,
  });
  if (result.ok) console.log(`[password-reset] code emailed to ${customer.email}`);
  else console.warn(`[password-reset] email to ${customer.email} failed: ${result.error}`);
  return info;
}

// Step 2 — "Verify Code". The right code returns a one-time reset token.
export async function verifyResetCode(rawEmail: string, rawCode: string): Promise<{ resetToken: string; expiresInMinutes: number }> {
  const email = checkEmail(rawEmail);
  const formatError = validateResetCode(rawCode);
  if (formatError) throw validationError({ code: formatError }, formatError);
  const fail = (message: string) => validationError({ code: message }, message);

  await ensureTable();
  const customer = await findCustomer(email);
  if (!customer) throw fail(RESET_MESSAGES.expired);
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT code_hash, attempts, token_hash, expires_at < UTC_TIMESTAMP() AS expired FROM password_resets WHERE customer_id = ?",
    [customer.id],
  );
  const row = rows[0];
  if (!row || Number(row.expired) || row.token_hash) throw fail(RESET_MESSAGES.expired); // token set = code already used
  if (row.attempts >= RESET_MAX_ATTEMPTS) throw fail(RESET_MESSAGES.tooMany);

  if (!sameHash(hmac(normalizeResetCode(rawCode)), String(row.code_hash))) {
    const attempts = row.attempts + 1;
    await pool.execute("UPDATE password_resets SET attempts = ? WHERE customer_id = ?", [attempts, customer.id]);
    const left = RESET_MAX_ATTEMPTS - attempts;
    throw fail(left > 0 ? RESET_MESSAGES.incorrect(left) : RESET_MESSAGES.tooMany);
  }

  const resetToken = randomBytes(32).toString("hex");
  await pool.execute(
    "UPDATE password_resets SET token_hash = ?, token_expires_at = UTC_TIMESTAMP() + INTERVAL ? MINUTE WHERE customer_id = ?",
    [hmac(resetToken), RESET_TOKEN_TTL_MINUTES, customer.id],
  );
  mockResetCodes.delete(customer.email);
  return { resetToken, expiresInMinutes: RESET_TOKEN_TTL_MINUTES };
}

// Step 3 — "Save Password". Uses the registration password rules; clears any login lockout.
export async function resetPassword(body: { email: string; resetToken: string; password: string; confirmPassword: string }): Promise<void> {
  const email = checkEmail(body.email);
  const errors = validateChangePassword(body, email);
  if (Object.keys(errors).length > 0) throw validationError(errors);

  await ensureTable();
  const expired = () => validationError({ resetToken: RESET_MESSAGES.sessionExpired }, RESET_MESSAGES.sessionExpired);
  const customer = await findCustomer(email);
  if (!customer || !/^[0-9a-f]{64}$/.test(body.resetToken)) throw expired();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT token_hash, token_expires_at < UTC_TIMESTAMP() AS expired FROM password_resets WHERE customer_id = ?",
    [customer.id],
  );
  const row = rows[0];
  if (!row?.token_hash || Number(row.expired) || !sameHash(hmac(body.resetToken), String(row.token_hash))) throw expired();

  const hash = await hashPassword(body.password);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("UPDATE customers SET password_hash = ? WHERE id = ?", [hash, customer.id]);
    await conn.execute("DELETE FROM password_resets WHERE customer_id = ?", [customer.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  await clearAttempts("CUSTOMER", email);
}
