// Staff accounts (seeded only — no sign-up, no roles).
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { AppError, validationError } from "../errors.js";
import { STAFF_LOGIN_MESSAGES, validateStaffLogin, type LoginBody } from "../validation/auth.js";
import { clearAttempts, normalizeEmail, recordFailedAttempt } from "./loginAttempts.js";
import { verifyPassword } from "./passwords.js";

export interface StaffUser {
  id: number;
  fullName: string;
  email: string;
}

interface StaffRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
}

const toStaffUser = (row: StaffRow): StaffUser => ({ id: row.id, fullName: row.full_name, email: row.email });

export async function authenticateStaff(body: LoginBody): Promise<StaffUser> {
  const errors = validateStaffLogin(body);
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const email = normalizeEmail(body.email);
  const [rows] = await pool.execute<StaffRow[]>(
    "SELECT id, full_name, email, password_hash FROM staff WHERE email = ?",
    [email],
  );
  const row = rows[0];
  if (!(await verifyPassword(body.password, row?.password_hash)) || !row) {
    const lockedFor = await recordFailedAttempt("STAFF", email);
    if (lockedFor > 0) {
      throw new AppError("ACCOUNT_LOCKED", STAFF_LOGIN_MESSAGES.locked(lockedFor), { minutesLeft: lockedFor });
    }
    throw new AppError("INVALID_CREDENTIALS", STAFF_LOGIN_MESSAGES.invalidCredentials);
  }
  await clearAttempts("STAFF", email);
  return toStaffUser(row);
}

export async function findStaff(id: number): Promise<StaffUser | null> {
  const [rows] = await pool.execute<StaffRow[]>("SELECT id, full_name, email FROM staff WHERE id = ?", [id]);
  return rows[0] ? toStaffUser(rows[0]) : null;
}
