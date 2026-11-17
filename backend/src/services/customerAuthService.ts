// Customer accounts: register, login, current user. Validation and messages match the customer app.
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { AppError, validationError } from "../errors.js";
import { DUPLICATE_EMAIL_MESSAGE, validateRegistration } from "../../../app/src/validation/registerValidation";
import { LOGIN_MESSAGES, validateLogin } from "../../../app/src/validation/loginValidation";
import type { LoginBody, RegisterBody } from "../validation/auth.js";
import { clearAttempts, normalizeEmail, recordFailedAttempt } from "./loginAttempts.js";
import { hashPassword, verifyPassword } from "./passwords.js";

export interface CustomerUser {
  email: string;
  fullName: string;
}

interface CustomerRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
}

export async function isCustomerEmailRegistered(rawEmail: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM customers WHERE email = ? LIMIT 1", [email]);
  return rows.length > 0;
}

// Decision P0-17 (team's SCRUM-12 fix): registering does NOT sign the customer in;
// Registration Complete sends them to "Go to Login".
export async function registerCustomer(form: RegisterBody): Promise<{ id: number; user: CustomerUser }> {
  const errors = validateRegistration(form);
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const duplicate = () => new AppError("CONFLICT", DUPLICATE_EMAIL_MESSAGE, { fields: { email: DUPLICATE_EMAIL_MESSAGE } });
  if (await isCustomerEmailRegistered(form.email)) throw duplicate();

  const user = { fullName: form.fullName.trim(), email: normalizeEmail(form.email) };
  let id: number;
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO customers (full_name, email, phone, home_address, card_last4, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.fullName,
        user.email,
        form.phone.trim(),
        form.homeAddress.trim(),
        // Never store the full card number, the CVV or the cardholder name — only the last 4 digits.
        form.cardNumber.replace(/\D/g, "").slice(-4),
        await hashPassword(form.password),
      ],
    );
    id = result.insertId;
  } catch (err) {
    // Two requests racing for the same email: the UNIQUE index decides.
    if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") throw duplicate();
    throw err;
  }
  return { id, user };
}

// Returns the customer id on success. Throws 400 / 401 / 423.
export async function authenticateCustomer(body: LoginBody): Promise<{ id: number; user: CustomerUser }> {
  const errors = validateLogin(body);
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const email = normalizeEmail(body.email);
  const [rows] = await pool.execute<CustomerRow[]>(
    "SELECT id, full_name, email, password_hash FROM customers WHERE email = ?",
    [email],
  );
  const row = rows[0];
  // Never reveal whether it was the email or the password that was wrong.
  if (!(await verifyPassword(body.password, row?.password_hash)) || !row) {
    const lockedFor = await recordFailedAttempt("CUSTOMER", email);
    if (lockedFor > 0) {
      throw new AppError("ACCOUNT_LOCKED", LOGIN_MESSAGES.locked(lockedFor), { minutesLeft: lockedFor });
    }
    throw new AppError("INVALID_CREDENTIALS", LOGIN_MESSAGES.invalidCredentials);
  }
  await clearAttempts("CUSTOMER", email);
  return { id: row.id, user: { email: row.email, fullName: row.full_name } };
}

export async function findCustomerUser(id: number): Promise<CustomerUser | null> {
  const [rows] = await pool.execute<CustomerRow[]>("SELECT full_name, email FROM customers WHERE id = ?", [id]);
  const row = rows[0];
  return row ? { email: row.email, fullName: row.full_name } : null;
}
