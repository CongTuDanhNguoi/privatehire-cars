// Login lockout, same rule as the customer app's simulated auth:
// 5 failed attempts in a row for the same email -> locked for 15 minutes. Tracked separately per scope.
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";

export type LoginScope = "STAFF" | "CUSTOMER";

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

interface AttemptRow extends RowDataPacket {
  fail_count: number;
  locked_until: Date | null;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const minutesUntil = (date: Date) => Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));

async function readAttempt(scope: LoginScope, email: string): Promise<AttemptRow | undefined> {
  const [rows] = await pool.execute<AttemptRow[]>(
    "SELECT fail_count, locked_until FROM login_attempts WHERE scope = ? AND email = ?",
    [scope, email],
  );
  return rows[0];
}

// Minutes left on an active lock, or 0 when the email is not locked.
export async function lockedMinutesLeft(scope: LoginScope, rawEmail: string): Promise<number> {
  const row = await readAttempt(scope, normalizeEmail(rawEmail));
  if (row?.locked_until && row.locked_until.getTime() > Date.now()) return minutesUntil(row.locked_until);
  return 0;
}

// Records a failed attempt. Returns the lock length in minutes if this attempt triggered a lock, else 0.
export async function recordFailedAttempt(scope: LoginScope, rawEmail: string): Promise<number> {
  const email = normalizeEmail(rawEmail);
  const row = await readAttempt(scope, email);
  const lockExpired = row?.locked_until != null && row.locked_until.getTime() <= Date.now();
  const count = !row || lockExpired ? 1 : row.fail_count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;

  await pool.execute(
    `INSERT INTO login_attempts (scope, email, fail_count, locked_until) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE fail_count = VALUES(fail_count), locked_until = VALUES(locked_until)`,
    [scope, email, lockedUntil ? 0 : count, lockedUntil],
  );
  return lockedUntil ? LOCK_MINUTES : 0;
}

export async function clearAttempts(scope: LoginScope, rawEmail: string): Promise<void> {
  await pool.execute("DELETE FROM login_attempts WHERE scope = ? AND email = ?", [scope, normalizeEmail(rawEmail)]);
}
