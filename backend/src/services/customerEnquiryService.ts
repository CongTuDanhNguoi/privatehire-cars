// Customer side: own bookings, sending an enquiry, listing own enquiries.
// A customer can only ever read or reference their own bookings and enquiries.
import { randomInt } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { validationError } from "../errors.js";
import { ENQUIRY_MESSAGES, validateEnquiry, type EnquiryForm } from "../../../app/src/validation/enquiryValidation";
import { enquiryCode } from "../validation/reply.js";
import { VEHICLES, type CreateBookingBody } from "../validation/bookings.js";
import { validateEnquiryContact } from "../../../app/src/validation/enquiryValidation";
import { normalizePhone } from "../../../app/src/validation/checkoutValidation";

// Databases created before SCRUM-95 (e.g. production) get the enquiry contact columns on first use.
let enquiryColumnsReady: Promise<unknown> | null = null;
export const ensureEnquiryContactColumns = () =>
  (enquiryColumnsReady ??= (async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enquiries' AND COLUMN_NAME = 'category'",
    );
    if (Number(rows[0].n) === 0) {
      await pool.query(`ALTER TABLE enquiries
        ADD COLUMN contact_name VARCHAR(100) NULL,
        ADD COLUMN contact_email VARCHAR(254) NULL,
        ADD COLUMN contact_phone VARCHAR(30) NULL,
        ADD COLUMN category VARCHAR(80) NULL,
        ADD COLUMN trip_snapshot JSON NULL`);
    }
  })().catch((err) => {
    enquiryColumnsReady = null;
    throw err;
  }));

export interface Booking {
  id: number;
  bookingRef: string;
  serviceName: string;
  pickupLocation: string;
  destination: string;
  journeyDateTime: Date;
  passengerCount: number;
  vehicleSize: string;
}

interface BookingRow extends RowDataPacket {
  id: number;
  booking_ref: string;
  service_name: string;
  pickup_location: string;
  destination: string;
  journey_datetime: Date;
  passenger_count: number;
  vehicle_size: string;
}

export const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  bookingRef: r.booking_ref,
  serviceName: r.service_name,
  pickupLocation: r.pickup_location,
  destination: r.destination,
  journeyDateTime: r.journey_datetime,
  passengerCount: r.passenger_count,
  vehicleSize: r.vehicle_size,
});

export async function listCustomerBookings(customerId: number): Promise<Booking[]> {
  const [rows] = await pool.execute<BookingRow[]>(
    `SELECT id, booking_ref, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size
     FROM bookings WHERE customer_id = ? ORDER BY journey_datetime ASC`,
    [customerId],
  );
  return rows.map(toBooking);
}

// Journey date/time is UK local time; the DB stores UTC. Works across GMT/BST changes.
function londonToUtc(date: string, time: string): Date {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const offsetMs = (d: Date) => {
    const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - d.getTime();
  };
  const naive = Date.parse(`${date}T${time}:00Z`);
  const guess = naive - offsetMs(new Date(naive));
  return new Date(naive - offsetMs(new Date(guess)));
}

// Saves the trip the customer just checked (vehicle available). Saving the same trip again returns
// the existing one, so revisiting the Availability screen never creates duplicates.
export async function createCustomerBooking(customerId: number, b: CreateBookingBody): Promise<{ booking: Booking; created: boolean }> {
  if (new Date(`${b.journeyDate}T00:00:00Z`).toISOString().slice(0, 10) !== b.journeyDate) {
    throw validationError({ journeyDate: "Invalid value." });
  }
  const at = londonToUtc(b.journeyDate, b.journeyTime);
  const vehicle = VEHICLES[b.vehicleSize].label;
  const values = [customerId, b.serviceName, b.pickupLocation, b.destination, at, b.passengerCount, vehicle];
  const select = `SELECT id, booking_ref, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size
     FROM bookings WHERE customer_id = ? AND service_name = ? AND pickup_location = ? AND destination = ?
       AND journey_datetime = ? AND passenger_count = ? AND vehicle_size = ? LIMIT 1`;

  const [existing] = await pool.execute<BookingRow[]>(select, values);
  if (existing.length > 0) return { booking: toBooking(existing[0]), created: false };

  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = `PHC-${randomInt(10000, 100000)}`;
    try {
      const [r] = await pool.execute<ResultSetHeader>(
        `INSERT INTO bookings (booking_ref, customer_id, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ref, ...values],
      );
      const [rows] = await pool.execute<BookingRow[]>(
        `SELECT id, booking_ref, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size
         FROM bookings WHERE id = ?`,
        [r.insertId],
      );
      return { booking: toBooking(rows[0]), created: true };
    } catch (err) {
      // Booking ref already taken → try another one.
      if ((err as { code?: string }).code !== "ER_DUP_ENTRY") throw err;
    }
  }
  throw new Error("Could not generate a unique booking reference.");
}

export async function createEnquiry(customerId: number, form: EnquiryForm) {
  await ensureEnquiryContactColumns();
  const hasContact = form.contactName !== undefined || form.contactEmail !== undefined || form.category !== undefined;
  const errors = { ...validateEnquiry(form), ...(hasContact ? validateEnquiryContact(form) : {}) };
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const type = form.type as "GENERAL" | "TRIP";
  // GENERAL enquiries are never linked to a booking. TRIP ones use the customer's own saved booking, or a planned trip.
  const bookingId = type === "TRIP" && form.bookingId ? form.bookingId : null;
  if (bookingId !== null) {
    const [own] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM bookings WHERE id = ? AND customer_id = ?", [
      bookingId,
      customerId,
    ]);
    if (own.length === 0) throw validationError({ bookingId: ENQUIRY_MESSAGES.bookingRequired });
  }

  const [r] = await pool.execute<ResultSetHeader>(
    `INSERT INTO enquiries (customer_id, type, booking_id, subject, message, contact_name, contact_email, contact_phone, category, trip_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      type,
      bookingId,
      form.subject.trim(),
      form.message.trim(),
      form.contactName?.trim() || null,
      form.contactEmail?.trim() || null,
      form.contactPhone?.trim() ? normalizePhone(form.contactPhone) : null,
      form.category?.trim() || null,
      type === "TRIP" && bookingId === null && form.tripSnapshot ? JSON.stringify(form.tripSnapshot) : null,
    ],
  );
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT status, created_at FROM enquiries WHERE id = ?", [r.insertId]);
  return { id: r.insertId, code: enquiryCode(r.insertId), status: rows[0].status as string, createdAt: rows[0].created_at as Date };
}

export async function listCustomerEnquiries(customerId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, type, subject, status, created_at FROM enquiries WHERE customer_id = ? ORDER BY created_at DESC, id DESC",
    [customerId],
  );
  return rows.map((r) => ({
    id: r.id as number,
    code: enquiryCode(r.id),
    type: r.type as string,
    subject: r.subject as string,
    status: r.status as string,
    createdAt: r.created_at as Date,
  }));
}
