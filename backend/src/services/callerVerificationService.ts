// Caller telephone OTP & session-bound verification grants (SCRUM-106 + SCRUM-107).
// Completely independent from email_verifications / email_verified_at.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { config } from "../config.js";
import { pool } from "../db.js";
import { AppError, validationError } from "../errors.js";
import {
  CALLER_OTP_MAX_ATTEMPTS,
  CALLER_OTP_MESSAGES,
  CALLER_OTP_TTL_MINUTES,
  normalizeCallerOtp,
  validateCallerOtp,
} from "../validation/callerOtp.js";
import { normalizeSearchPhone, validateSearchPhone } from "../validation/customerSearch.js";

export interface CallerVerificationGrant {
  staffId: number;
  customerId: number;
  sessionIssuedAtMs: number;
  verifiedAt: Date;
}

export interface CallerVerificationStore {
  hasVerifiedCaller(staffId: number, customerId: number, sessionIssuedAt: Date): Promise<boolean>;
  grantVerification(staffId: number, customerId: number, sessionIssuedAt: Date): Promise<void>;
  clearVerification(staffId: number): Promise<void>;
}

/**
 * In-memory store preserved for isolated unit testing without a database.
 */
export class InMemoryCallerVerificationStore implements CallerVerificationStore {
  private readonly grants = new Map<number, CallerVerificationGrant>();

  async hasVerifiedCaller(staffId: number, customerId: number, sessionIssuedAt: Date): Promise<boolean> {
    const grant = this.grants.get(staffId);
    if (!grant) return false;
    return grant.customerId === customerId && grant.sessionIssuedAtMs === sessionIssuedAt.getTime();
  }

  async grantVerification(staffId: number, customerId: number, sessionIssuedAt: Date): Promise<void> {
    this.grants.set(staffId, {
      staffId,
      customerId,
      sessionIssuedAtMs: sessionIssuedAt.getTime(),
      verifiedAt: new Date(),
    });
  }

  async clearVerification(staffId: number): Promise<void> {
    this.grants.delete(staffId);
  }
}

interface CallerVerificationRow extends RowDataPacket {
  staff_id: number;
  customer_id: number | null;
  phone_normalized: string;
  session_iat_ms: number | string;
  code_hash: string | null;
  expires_at: Date | null;
  attempts: number;
  invalidated_at: Date | null;
  verified_at: Date | null;
  is_expired: number;
}

export class MySqlCallerVerificationStore implements CallerVerificationStore {
  async hasVerifiedCaller(staffId: number, customerId: number, sessionIssuedAt: Date): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM caller_verifications
       WHERE staff_id = ? AND customer_id = ? AND session_iat_ms = ? AND verified_at IS NOT NULL
       LIMIT 1`,
      [staffId, customerId, sessionIssuedAt.getTime()],
    );
    return rows.length > 0;
  }

  async grantVerification(staffId: number, customerId: number, sessionIssuedAt: Date): Promise<void> {
    await pool.execute(
      `INSERT INTO caller_verifications
         (staff_id, customer_id, phone_normalized, session_iat_ms, code_hash, expires_at, attempts, invalidated_at, verified_at)
       VALUES (?, ?, '', ?, NULL, NULL, 0, NULL, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         customer_id = VALUES(customer_id),
         session_iat_ms = VALUES(session_iat_ms),
         code_hash = NULL,
         expires_at = NULL,
         attempts = 0,
         invalidated_at = NULL,
         verified_at = VALUES(verified_at)`,
      [staffId, customerId, sessionIssuedAt.getTime()],
    );
  }

  async clearVerification(staffId: number): Promise<void> {
    await pool.execute("DELETE FROM caller_verifications WHERE staff_id = ?", [staffId]);
  }
}

export const callerVerificationStore: CallerVerificationStore = new MySqlCallerVerificationStore();

export interface SimulatedOtpResult {
  deliveryMode: "SIMULATION";
  simulation: true;
  phone: string;
  expiresInMinutes: number;
  maxAttempts: number;
  simulatedCode?: string;
}

const hashCallerOtp = (code: string): string =>
  createHmac("sha256", config.jwtSecret).update(`caller-otp:${code}`).digest("hex");

function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function codesMatch(submitted: string, storedHashHex: string): boolean {
  const a = Buffer.from(hashCallerOtp(submitted), "hex");
  const b = Buffer.from(storedHashHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function buildOtpResponse(displayPhone: string, code: string): SimulatedOtpResult {
  // Never expose demonstration codes in production responses or application logs.
  const isProd = process.env.NODE_ENV === "production";
  return {
    deliveryMode: "SIMULATION",
    simulation: true,
    phone: displayPhone,
    expiresInMinutes: CALLER_OTP_TTL_MINUTES,
    maxAttempts: CALLER_OTP_MAX_ATTEMPTS,
    ...(!isProd ? { simulatedCode: code } : {}),
  };
}

async function upsertPendingOtp(params: {
  staffId: number;
  customerId: number | null;
  phoneNormalized: string;
  sessionIssuedAt: Date;
  code: string;
}): Promise<void> {
  await pool.execute(
    `INSERT INTO caller_verifications
       (staff_id, customer_id, phone_normalized, session_iat_ms, code_hash, expires_at, attempts, invalidated_at, verified_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, 0, NULL, NULL)
     ON DUPLICATE KEY UPDATE
       customer_id = VALUES(customer_id),
       phone_normalized = VALUES(phone_normalized),
       session_iat_ms = VALUES(session_iat_ms),
       code_hash = VALUES(code_hash),
       expires_at = VALUES(expires_at),
       attempts = 0,
       invalidated_at = NULL,
       verified_at = NULL`,
    [
      params.staffId,
      params.customerId,
      params.phoneNormalized,
      params.sessionIssuedAt.getTime(),
      hashCallerOtp(params.code),
      CALLER_OTP_TTL_MINUTES,
    ],
  );
}

async function verifyPendingOtp(params: {
  staffId: number;
  customerId: number | null;
  phoneNormalized?: string;
  sessionIssuedAt: Date;
  rawCode: string;
}): Promise<void> {
  const otpError = validateCallerOtp(params.rawCode);
  if (otpError) throw validationError({ code: otpError }, otpError);
  const code = normalizeCallerOtp(params.rawCode);

  const [rows] = await pool.execute<CallerVerificationRow[]>(
    `SELECT staff_id, customer_id, phone_normalized, session_iat_ms, code_hash, expires_at, attempts,
            invalidated_at, verified_at,
            IF(expires_at IS NULL OR expires_at <= UTC_TIMESTAMP(), 1, 0) AS is_expired
     FROM caller_verifications
     WHERE staff_id = ?
     LIMIT 1`,
    [params.staffId],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError("CALLER_OTP_INVALID", CALLER_OTP_MESSAGES.invalidated);
  }

  const sameSession = Number(row.session_iat_ms) === params.sessionIssuedAt.getTime();
  const sameCustomer = row.customer_id === params.customerId;
  const samePhone = !params.phoneNormalized || row.phone_normalized === params.phoneNormalized;
  if (!sameSession || !sameCustomer || !samePhone || row.invalidated_at !== null || !row.code_hash) {
    throw new AppError("CALLER_OTP_INVALID", CALLER_OTP_MESSAGES.invalidated);
  }

  if (row.attempts >= CALLER_OTP_MAX_ATTEMPTS) {
    throw new AppError("CALLER_OTP_EXHAUSTED", CALLER_OTP_MESSAGES.exhausted, { attemptsRemaining: 0 });
  }

  if (Number(row.is_expired) === 1) {
    throw new AppError("CALLER_OTP_EXPIRED", CALLER_OTP_MESSAGES.expired);
  }

  if (!codesMatch(code, row.code_hash)) {
    const nextAttempts = row.attempts + 1;
    const remaining = Math.max(0, CALLER_OTP_MAX_ATTEMPTS - nextAttempts);
    if (remaining === 0) {
      await pool.execute(
        `UPDATE caller_verifications
         SET attempts = ?, invalidated_at = UTC_TIMESTAMP(), code_hash = NULL
         WHERE staff_id = ?`,
        [nextAttempts, params.staffId],
      );
      throw new AppError("CALLER_OTP_EXHAUSTED", CALLER_OTP_MESSAGES.exhausted, { attemptsRemaining: 0 });
    }
    await pool.execute("UPDATE caller_verifications SET attempts = ? WHERE staff_id = ?", [
      nextAttempts,
      params.staffId,
    ]);
    throw new AppError("CALLER_OTP_INCORRECT", CALLER_OTP_MESSAGES.incorrect(remaining), {
      attemptsRemaining: remaining,
    });
  }

  await pool.execute(
    `UPDATE caller_verifications
     SET verified_at = UTC_TIMESTAMP(), code_hash = NULL, attempts = 0, invalidated_at = NULL
     WHERE staff_id = ?`,
    [params.staffId],
  );
}

export async function sendExistingCustomerOtp(
  staffId: number,
  customerId: number,
  sessionIssuedAt: Date,
): Promise<SimulatedOtpResult> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, phone, phone_normalized FROM customers WHERE id = ? LIMIT 1",
    [customerId],
  );
  const customer = rows[0] as { id: number; phone: string | null; phone_normalized: string | null } | undefined;
  if (!customer) throw new AppError("NOT_FOUND", "Customer account not found.");
  const normalized = customer.phone_normalized ?? (customer.phone ? normalizeSearchPhone(customer.phone) : "");
  if (!normalized) {
    throw new AppError("VALIDATION_ERROR", "This customer account has no telephone number on file.");
  }

  const code = generateSixDigitOtp();
  await upsertPendingOtp({
    staffId,
    customerId,
    phoneNormalized: normalized,
    sessionIssuedAt,
    code,
  });
  return buildOtpResponse(customer.phone ?? normalized, code);
}

export async function verifyExistingCustomerOtp(
  staffId: number,
  customerId: number,
  sessionIssuedAt: Date,
  rawCode: string,
): Promise<{ verified: true; customerId: number }> {
  await verifyPendingOtp({
    staffId,
    customerId,
    sessionIssuedAt,
    rawCode,
  });
  return { verified: true, customerId };
}

export async function sendNewCustomerOtp(
  staffId: number,
  rawPhone: string,
  sessionIssuedAt: Date,
): Promise<SimulatedOtpResult> {
  const phoneErr = validateSearchPhone(rawPhone);
  if (phoneErr) throw validationError({ phone: phoneErr }, phoneErr);
  const normalized = normalizeSearchPhone(rawPhone);

  const code = generateSixDigitOtp();
  await upsertPendingOtp({
    staffId,
    customerId: null,
    phoneNormalized: normalized,
    sessionIssuedAt,
    code,
  });
  return buildOtpResponse(rawPhone.trim(), code);
}

export async function verifyNewCustomerOtp(
  staffId: number,
  rawPhone: string,
  sessionIssuedAt: Date,
  rawCode: string,
): Promise<{ verified: true; phoneNormalized: string }> {
  const phoneErr = validateSearchPhone(rawPhone);
  if (phoneErr) throw validationError({ phone: phoneErr }, phoneErr);
  const normalized = normalizeSearchPhone(rawPhone);

  await verifyPendingOtp({
    staffId,
    customerId: null,
    phoneNormalized: normalized,
    sessionIssuedAt,
    rawCode,
  });
  return { verified: true, phoneNormalized: normalized };
}

export async function beginVerifiedNewCustomerCreation(
  staffId: number,
  rawPhone: string,
  sessionIssuedAt: Date,
): Promise<{ allowed: true; phoneNormalized: string; entryMode: "STAFF_ASSISTED_REGISTRATION_ENTRY"; message: string }> {
  const phoneErr = validateSearchPhone(rawPhone);
  if (phoneErr) throw validationError({ phone: phoneErr }, phoneErr);
  const normalized = normalizeSearchPhone(rawPhone);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM caller_verifications
     WHERE staff_id = ? AND customer_id IS NULL AND phone_normalized = ? AND session_iat_ms = ? AND verified_at IS NOT NULL
     LIMIT 1`,
    [staffId, normalized, sessionIssuedAt.getTime()],
  );
  if (rows.length === 0) {
    throw new AppError(
      "CALLER_NOT_VERIFIED",
      "Telephone verification is required before beginning new-customer account creation.",
    );
  }
  return {
    allowed: true,
    phoneNormalized: normalized,
    entryMode: "STAFF_ASSISTED_REGISTRATION_ENTRY",
    message: "Caller telephone verified. Ready to begin new-customer account creation.",
  };
}

export async function getVerifiedNewCustomerEntry(
  staffId: number,
  sessionIssuedAt: Date,
): Promise<{ allowed: true; phoneNormalized: string; entryMode: "STAFF_ASSISTED_REGISTRATION_ENTRY"; message: string }> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT phone_normalized FROM caller_verifications
     WHERE staff_id = ? AND customer_id IS NULL AND session_iat_ms = ? AND verified_at IS NOT NULL
     LIMIT 1`,
    [staffId, sessionIssuedAt.getTime()],
  );
  const row = rows[0] as { phone_normalized: string } | undefined;
  if (!row) {
    throw new AppError(
      "CALLER_NOT_VERIFIED",
      "Telephone verification is required before accessing new-customer account creation.",
    );
  }
  return {
    allowed: true,
    phoneNormalized: row.phone_normalized,
    entryMode: "STAFF_ASSISTED_REGISTRATION_ENTRY",
    message: "Caller telephone verified. No customer account has been saved yet.",
  };
}
