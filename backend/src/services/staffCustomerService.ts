// Staff customer lookup and protected account/booking-history queries (SCRUM-106 Phase 1).
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { AppError, validationError } from "../errors.js";
import { normalizeSearchPhone, validateSearchPhone } from "../validation/customerSearch.js";

export interface CustomerSearchCandidate {
  id: number;
  fullName: string;
  phone: string | null;
  maskedEmail: string;
}

export interface VerifiedCustomerProfile {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  homeAddress: string | null;
  cardLast4: string | null;
}

export interface StaffCustomerBooking {
  id: number;
  bookingRef: string;
  serviceName: string;
  pickupLocation: string;
  destination: string;
  journeyDateTime: string;
  vehicleSize: string;
  status: "SAVED" | "PAID";
}

interface CandidateRow extends RowDataPacket {
  id: number;
  full_name: string;
  phone: string | null;
  email: string;
}

interface ProfileRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  home_address: string | null;
  card_last4: string | null;
}

interface BookingRow extends RowDataPacket {
  id: number;
  booking_ref: string;
  service_name: string;
  pickup_location: string;
  destination: string;
  journey_datetime: Date;
  vehicle_size: string;
  status: "SAVED" | "PAID";
}

/**
 * Masks an email address for pre-verification candidate disambiguation (e.g. a***@example.com).
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Searches customers by normalized telephone number.
 * Returns minimal candidate fields only; never grants caller verification.
 */
export async function searchCustomersByPhone(rawPhone: string): Promise<CustomerSearchCandidate[]> {
  const phoneError = validateSearchPhone(rawPhone);
  if (phoneError) throw validationError({ phone: phoneError }, phoneError);

  const normalized = normalizeSearchPhone(rawPhone);
  // Support both the indexed phone_normalized column and legacy rows where phone_normalized is null.
  const [rows] = await pool.execute<CandidateRow[]>(
    `SELECT id, full_name, phone, email
     FROM customers
     WHERE phone_normalized = ?
     ORDER BY full_name ASC, id ASC`,
    [normalized],
  );

  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    maskedEmail: maskEmail(r.email),
  }));
}

export async function getVerifiedCustomerProfile(customerId: number): Promise<VerifiedCustomerProfile> {
  const [rows] = await pool.execute<ProfileRow[]>(
    `SELECT id, full_name, email, phone, home_address, card_last4
     FROM customers
     WHERE id = ?
     LIMIT 1`,
    [customerId],
  );
  const row = rows[0];
  if (!row) throw new AppError("NOT_FOUND", "Customer account not found.");
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    homeAddress: row.home_address,
    cardLast4: row.card_last4,
  };
}

export async function listVerifiedCustomerBookings(customerId: number): Promise<StaffCustomerBooking[]> {
  const [rows] = await pool.execute<BookingRow[]>(
    `SELECT id, booking_ref, service_name, pickup_location, destination, journey_datetime, vehicle_size, status
     FROM bookings
     WHERE customer_id = ?
     ORDER BY journey_datetime DESC, id DESC`,
    [customerId],
  );
  return rows.map((r) => ({
    id: r.id,
    bookingRef: r.booking_ref,
    serviceName: r.service_name,
    pickupLocation: r.pickup_location,
    destination: r.destination,
    journeyDateTime: r.journey_datetime.toISOString(),
    vehicleSize: r.vehicle_size,
    status: r.status,
  }));
}
