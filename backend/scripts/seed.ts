// Seeds the database. By default ONLY the Admin staff account (no mock customers / bookings / enquiries).
// With { demo: true } (`npm run db:reset -- --demo`) it also adds the mock data the automated tests and demos use:
// 3 customers, 4 bookings, 7 enquiries, 3 responses (1 FAILED).
// Passwords are hashed with bcrypt (cost 10) at run time — no plain-text passwords in SQL.
// Can also run alone on an empty schema: `npx tsx scripts/seed.ts [--demo]`.
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import type { Connection, ResultSetHeader } from "mysql2/promise";
import { connect, dbName, toSqlDateTime } from "./connect.js";

const BCRYPT_COST = 10;

// Only one staff account (demo login for the Staff Portal).
const STAFF = [{ fullName: "Admin", email: "admin@gmail.com", password: "123456" }] as const;

// The first customer must match the existing demo account of the customer app.
const CUSTOMERS = [
  { key: "alex", fullName: "Alex Morgan", email: "alex.morgan@example.com", password: "Password123", phone: "+44 7911 123456", homeAddress: "221B Baker St, London NW1 6XE", cardLast4: "4242" },
  { key: "emily", fullName: "Emily Clarke", email: "emily.clarke@example.com", password: "Password123", phone: "+44 7700 900123", homeAddress: "14 Deansgate, Manchester M3 2BA", cardLast4: "1881" },
  { key: "daniel", fullName: "Daniel Brooks", email: "daniel.brooks@example.com", password: "Password123", phone: "+44 7700 900456", homeAddress: "3 Quay Street, Manchester M3 3HN", cardLast4: "0005" },
] as const;
type CustomerKey = (typeof CUSTOMERS)[number]["key"];

// Journey times are UK local time; late Nov / early Dec is GMT (= UTC), so they are stored as-is.
const BOOKINGS = [
  { ref: "PHC-24051", customer: "alex", service: "Airport Transfer", pickup: "Manchester Piccadilly Station, M1 2PB", destination: "Manchester Airport Terminal 2, M90 4FF", at: "2026-11-25 14:30:00", passengers: 5, vehicle: "Seven-Seater" },
  { ref: "PHC-24052", customer: "alex", service: "Local Travel", pickup: "The Lowry Hotel, M3 5LH", destination: "MediaCityUK, Salford Quays, M50 2EQ", at: "2026-12-02 09:00:00", passengers: 2, vehicle: "Saloon 4-Seat" },
  { ref: "PHC-24053", customer: "emily", service: "Long-Distance", pickup: "Spinningfields, Manchester M3 3AQ", destination: "Etihad Stadium, M11 3FF", at: "2026-11-28 18:15:00", passengers: 3, vehicle: "Saloon 4-Seat" },
  { ref: "PHC-24054", customer: "daniel", service: "Driver & Car Daily Hire", pickup: "Manchester Airport Terminal 1, M90 3PY", destination: "The Lowry Hotel, M3 5LH", at: "2026-12-05 08:00:00", passengers: 6, vehicle: "Seven-Seater" },
] as const satisfies ReadonlyArray<{ customer: CustomerKey } & Record<string, unknown>>;

interface SeedResponse {
  staff: 0; // index into STAFF
  body: string;
  status: "SENT" | "FAILED";
  minutesAfter: number; // sent this many minutes after the enquiry was created
}

interface SeedEnquiry {
  customer: CustomerKey;
  type: "GENERAL" | "TRIP";
  bookingRef?: string;
  subject: string;
  message: string;
  status: "AWAITING" | "RESOLVED";
  hoursAgo: number; // created this many hours before the seed runs (spread over the last 7 days)
  response?: SeedResponse;
}

const ENQUIRIES: SeedEnquiry[] = [
  {
    customer: "alex", type: "TRIP", bookingRef: "PHC-24051", status: "AWAITING", hoursAgo: 5,
    subject: "Extra luggage for airport transfer",
    message: "Hi, we are travelling as a family of five and will have two extra large suitcases plus a pushchair. Will the Seven-Seater have enough boot space for everything? If not, could you suggest a bigger vehicle for the same booking?",
  },
  {
    customer: "alex", type: "GENERAL", status: "AWAITING", hoursAgo: 30,
    subject: "Do you provide child seats?",
    message: "I will be travelling with my two-year-old son in the coming weeks. Do your drivers provide child seats, and is there an extra charge for them? I would like to know before I book my next ride.",
  },
  {
    customer: "emily", type: "TRIP", bookingRef: "PHC-24053", status: "AWAITING", hoursAgo: 52,
    subject: "Can I change the pickup time?",
    message: "The match at the Etihad has been moved, so I need to be picked up at 17:30 instead of 18:15. Could you please update the pickup time on my booking? The pickup location and number of passengers stay the same.",
  },
  {
    customer: "emily", type: "GENERAL", status: "RESOLVED", hoursAgo: 76,
    subject: "Invoice for company expenses",
    message: "My company reimburses my business travel. Can you send me a VAT invoice for my rides each month, addressed to my employer? Please let me know what details you need from me.",
    response: {
      staff: 0, status: "SENT", minutesAfter: 95,
      body: "Hi Emily,\n\nThank you for getting in touch. We can send a monthly VAT invoice addressed to your employer. Please reply with your company's registered name, address and VAT number, and we will add them to your account.\n\nKind regards,\nPrivateHire Cars Customer Support",
    },
  },
  {
    customer: "daniel", type: "TRIP", bookingRef: "PHC-24054", status: "AWAITING", hoursAgo: 100,
    subject: "Driver waiting time at the airport",
    message: "My flight lands at Terminal 1 and I am worried it might be delayed. How long will the driver wait for me after landing, and will I be charged for any extra waiting time?",
  },
  {
    customer: "daniel", type: "GENERAL", status: "RESOLVED", hoursAgo: 130,
    subject: "Accessibility for wheelchair users",
    message: "My father uses a folding wheelchair. Are your vehicles able to carry a wheelchair, and can the driver help him get in and out of the car? We would like to book a trip for him next month.",
    response: {
      staff: 0, status: "SENT", minutesAfter: 240,
      body: "Hi Daniel,\n\nYes, all of our vehicles can carry a folding wheelchair, and our drivers are happy to help your father in and out of the car. Please mention it in the booking notes so we can allow a little extra time.\n\nBest wishes,\nPrivateHire Cars Customer Support",
    },
  },
  {
    customer: "alex", type: "GENERAL", status: "AWAITING", hoursAgo: 160,
    subject: "Payment methods accepted",
    message: "Which payment methods do you accept? I would prefer to pay with Apple Pay or a company credit card rather than the card I registered with.",
    response: {
      staff: 0, status: "FAILED", minutesAfter: 60,
      body: "Hi Alex,\n\nWe accept all major credit and debit cards, Apple Pay and Google Pay. You can add a company card under Profile > Payment Details at any time.\n\nKind regards,\nPrivateHire Cars Customer Support",
    },
  },
];

const enquiryCode = (id: number) => `ENQ-${String(id).padStart(6, "0")}`;

export async function seedDatabase(conn: Connection, { demo = false }: { demo?: boolean } = {}): Promise<void> {
  const now = Date.now();

  const staffIds: number[] = [];
  for (const s of STAFF) {
    const hash = await bcrypt.hash(s.password, BCRYPT_COST);
    const [r] = await conn.execute<ResultSetHeader>(
      "INSERT INTO staff (full_name, email, password_hash) VALUES (?, ?, ?)",
      [s.fullName, s.email.toLowerCase(), hash],
    );
    staffIds.push(r.insertId);
  }
  if (!demo) return; // real use: start empty, only the Admin account

  const customerIds = new Map<CustomerKey, { id: number; email: string }>();
  for (const c of CUSTOMERS) {
    const hash = await bcrypt.hash(c.password, BCRYPT_COST);
    const email = c.email.trim().toLowerCase();
    const [r] = await conn.execute<ResultSetHeader>(
      // Demo customers count as already verified.
      "INSERT INTO customers (full_name, email, phone, home_address, card_last4, password_hash, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())",
      [c.fullName, email, c.phone, c.homeAddress, c.cardLast4, hash],
    );
    customerIds.set(c.key, { id: r.insertId, email });
  }

  const bookingIds = new Map<string, number>();
  for (const b of BOOKINGS) {
    const [r] = await conn.execute<ResultSetHeader>(
      `INSERT INTO bookings (booking_ref, customer_id, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.ref, customerIds.get(b.customer)!.id, b.service, b.pickup, b.destination, b.at, b.passengers, b.vehicle],
    );
    bookingIds.set(b.ref, r.insertId);
  }

  // Oldest first so ENQ ids grow with time, like real data.
  const ordered = [...ENQUIRIES].sort((a, b) => b.hoursAgo - a.hoursAgo);
  for (const e of ordered) {
    const customer = customerIds.get(e.customer)!;
    const bookingId = e.type === "TRIP" ? bookingIds.get(e.bookingRef!)! : null;
    const createdAt = new Date(now - e.hoursAgo * 3_600_000);
    const respondedAt = e.response ? new Date(createdAt.getTime() + e.response.minutesAfter * 60_000) : null;
    const updatedAt = respondedAt ?? createdAt;

    const [r] = await conn.execute<ResultSetHeader>(
      `INSERT INTO enquiries (customer_id, type, booking_id, subject, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer.id, e.type, bookingId, e.subject, e.message, e.status, toSqlDateTime(createdAt), toSqlDateTime(updatedAt)],
    );
    const enquiryId = r.insertId;

    if (e.response && respondedAt) {
      const sent = e.response.status === "SENT";
      await conn.execute(
        `INSERT INTO enquiry_responses
           (enquiry_id, staff_id, client_request_id, subject, body, intended_to, delivered_to, provider, test_mode,
            send_status, attempt_count, error_message, created_at, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'MOCK', FALSE, ?, 1, ?, ?, ?)`,
        [
          enquiryId, staffIds[e.response.staff], randomUUID(),
          `Re: [${enquiryCode(enquiryId)}] ${e.subject}`, e.response.body,
          customer.email, customer.email,
          e.response.status,
          sent ? null : "Mock email service: simulated delivery failure.",
          toSqlDateTime(respondedAt), sent ? toSqlDateTime(respondedAt) : null,
        ],
      );
      if (sent && e.status === "RESOLVED") {
        await conn.execute(
          `INSERT INTO enquiry_status_history (enquiry_id, from_status, to_status, changed_by, reason, changed_at)
           VALUES (?, 'AWAITING', 'RESOLVED', NULL, 'AUTO_AFTER_RESPONSE', ?)`,
          [enquiryId, toSqlDateTime(respondedAt)],
        );
      }
    }
  }
}

// Allow running this file on its own against an already-created, empty schema.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const conn = await connect({ database: dbName() });
  try {
    await seedDatabase(conn, { demo: process.argv.includes("--demo") });
    console.log("Seed complete.");
  } finally {
    await conn.end();
  }
}
