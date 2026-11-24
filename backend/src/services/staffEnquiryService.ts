// Staff side: inbox list (filter / search / sort / paginate / counts), enquiry detail, status changes.
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { AppError } from "../errors.js";
import type { ListEnquiriesQuery } from "../validation/enquiries.js";
import { enquiryCode } from "../validation/reply.js";
import { ensureEnquiryContactColumns, toBooking } from "./customerEnquiryService.js";

export type EnquiryStatus = "AWAITING" | "RESOLVED";

export const notFound = () => new AppError("NOT_FOUND", "Enquiry not found.");

// ---------- shared mappers ----------
export interface EnquiryDto {
  id: number;
  code: string;
  type: "GENERAL" | "TRIP";
  subject: string;
  message: string;
  status: EnquiryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const toEnquiry = (r: RowDataPacket): EnquiryDto => ({
  id: r.id,
  code: enquiryCode(r.id),
  type: r.type,
  subject: r.subject,
  message: r.message,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function getEnquiry(id: number, conn: PoolConnection | typeof pool = pool): Promise<EnquiryDto | null> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    "SELECT id, type, subject, message, status, created_at, updated_at FROM enquiries WHERE id = ?",
    [id],
  );
  return rows[0] ? toEnquiry(rows[0]) : null;
}

// ---------- list ----------
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

function buildFilters(q: ListEnquiriesQuery, use: { type: boolean; status: boolean }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (use.type && q.type !== "ALL") {
    where.push("e.type = ?");
    params.push(q.type);
  }
  if (use.status && q.status !== "ALL") {
    where.push("e.status = ?");
    params.push(q.status);
  }
  if (q.q) {
    const like = `%${escapeLike(q.q)}%`;
    const parts = ["c.full_name LIKE ?", "c.email LIKE ?", "e.subject LIKE ?"];
    params.push(like, like, like);
    // "ENQ-000007", "ENQ7", "000007" or "7" also match the enquiry id.
    const idMatch = /^(?:ENQ-?)?0*(\d{1,9})$/i.exec(q.q);
    if (idMatch) {
      parts.push("e.id = ?");
      params.push(Number(idMatch[1]));
    }
    where.push(`(${parts.join(" OR ")})`);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

const FROM = `FROM enquiries e
  JOIN customers c ON c.id = e.customer_id
  LEFT JOIN bookings b ON b.id = e.booking_id`;

export async function listEnquiries(q: ListEnquiriesQuery) {
  const all = buildFilters(q, { type: true, status: true });
  const order = q.sort === "oldest" ? "ASC" : "DESC";
  const offset = (q.page - 1) * q.pageSize;

  // Note: pool.query (not execute) because MySQL prepared statements do not accept LIMIT placeholders reliably;
  // values are still passed as parameters and escaped by the driver.
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.type, e.subject, e.status, e.created_at, e.updated_at,
            c.full_name, c.email, b.booking_ref,
            (SELECT COUNT(*) FROM enquiry_responses r WHERE r.enquiry_id = e.id) AS response_count,
            (SELECT r.send_status FROM enquiry_responses r WHERE r.enquiry_id = e.id
               ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS last_status
     ${FROM} ${all.sql}
     ORDER BY e.created_at ${order}, e.id ${order}
     LIMIT ? OFFSET ?`,
    [...all.params, q.pageSize, offset],
  );
  const [[{ total }]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total ${FROM} ${all.sql}`, all.params);

  // Facet counts: status counts ignore the status filter, type counts ignore the type filter,
  // so the tabs / summary always show how many items each choice would give.
  const byStatus = buildFilters(q, { type: true, status: false });
  const [statusRows] = await pool.query<RowDataPacket[]>(
    `SELECT e.status, COUNT(*) AS n ${FROM} ${byStatus.sql} GROUP BY e.status`,
    byStatus.params,
  );
  const byType = buildFilters(q, { type: false, status: true });
  const [typeRows] = await pool.query<RowDataPacket[]>(
    `SELECT e.type, COUNT(*) AS n ${FROM} ${byType.sql} GROUP BY e.type`,
    byType.params,
  );
  const count = (rows: RowDataPacket[], key: string, value: string) => Number(rows.find((r) => r[key] === value)?.n ?? 0);

  return {
    items: items.map((r) => ({
      id: r.id as number,
      code: enquiryCode(r.id),
      type: r.type as "GENERAL" | "TRIP",
      subject: r.subject as string,
      status: r.status as EnquiryStatus,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
      customer: { fullName: r.full_name as string, email: r.email as string },
      bookingRef: (r.booking_ref as string | null) ?? null,
      responseCount: Number(r.response_count),
      lastResponseStatus: r.last_status === "SENT" || r.last_status === "FAILED" ? (r.last_status as "SENT" | "FAILED") : null,
    })),
    page: q.page,
    pageSize: q.pageSize,
    total: Number(total),
    counts: {
      awaiting: count(statusRows, "status", "AWAITING"),
      resolved: count(statusRows, "status", "RESOLVED"),
      general: count(typeRows, "type", "GENERAL"),
      trip: count(typeRows, "type", "TRIP"),
    },
  };
}

// ---------- detail ----------
export async function getEnquiryDetail(id: number) {
  await ensureEnquiryContactColumns();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.type, e.subject, e.message, e.status, e.created_at, e.updated_at,
            e.contact_name, e.contact_email, e.contact_phone, e.category, e.trip_snapshot,
            c.id AS c_id, c.full_name AS c_name, c.email AS c_email, c.phone AS c_phone,
            b.id AS b_id
     FROM enquiries e JOIN customers c ON c.id = e.customer_id LEFT JOIN bookings b ON b.id = e.booking_id
     WHERE e.id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) throw notFound();

  let booking = null;
  if (row.b_id) {
    const [b] = await pool.execute<RowDataPacket[]>(
      `SELECT id, booking_ref, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size
       FROM bookings WHERE id = ?`,
      [row.b_id],
    );
    booking = b[0] ? toBooking(b[0] as Parameters<typeof toBooking>[0]) : null;
  }

  const [responses] = await pool.execute<RowDataPacket[]>(`${RESPONSE_SELECT} WHERE r.enquiry_id = ? ORDER BY r.created_at DESC, r.id DESC`, [id]);
  const [history] = await pool.execute<RowDataPacket[]>(
    `SELECT h.id, h.from_status, h.to_status, h.reason, h.changed_at, s.id AS s_id, s.full_name AS s_name
     FROM enquiry_status_history h LEFT JOIN staff s ON s.id = h.changed_by
     WHERE h.enquiry_id = ? ORDER BY h.changed_at DESC, h.id DESC`,
    [id],
  );

  const snapshot = row.trip_snapshot as unknown;
  return {
    enquiry: {
      ...toEnquiry(row),
      contactName: (row.contact_name as string | null) ?? null,
      contactEmail: (row.contact_email as string | null) ?? null,
      contactPhone: (row.contact_phone as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      tripSnapshot: snapshot == null ? null : typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot,
    },
    customer: { id: row.c_id as number, fullName: row.c_name as string, email: row.c_email as string, phone: (row.c_phone as string | null) ?? null },
    booking,
    responses: responses.map(toResponse),
    statusHistory: history.map((h) => ({
      id: h.id as number,
      fromStatus: h.from_status as EnquiryStatus,
      toStatus: h.to_status as EnquiryStatus,
      reason: h.reason as "MANUAL" | "AUTO_AFTER_RESPONSE",
      changedAt: h.changed_at as Date,
      changedBy: h.s_id ? { id: h.s_id as number, fullName: h.s_name as string } : null,
    })),
  };
}

// ---------- responses (shared with responseService) ----------
export const RESPONSE_SELECT = `SELECT r.id, r.enquiry_id, r.client_request_id, r.subject, r.body, r.intended_to, r.delivered_to,
       r.provider, r.test_mode, r.send_status, r.attempt_count, r.error_message, r.created_at, r.sent_at,
       s.id AS s_id, s.full_name AS s_name
  FROM enquiry_responses r JOIN staff s ON s.id = r.staff_id`;

export const toResponse = (r: RowDataPacket) => ({
  id: r.id as number,
  enquiryId: r.enquiry_id as number,
  clientRequestId: r.client_request_id as string,
  subject: r.subject as string,
  body: r.body as string,
  intendedTo: r.intended_to as string,
  deliveredTo: (r.delivered_to as string | null) ?? null,
  provider: r.provider as "EMAILJS" | "MOCK",
  testMode: Boolean(r.test_mode),
  sendStatus: r.send_status as "PENDING" | "SENT" | "FAILED",
  attemptCount: r.attempt_count as number,
  errorMessage: (r.error_message as string | null) ?? null,
  createdAt: r.created_at as Date,
  sentAt: (r.sent_at as Date | null) ?? null,
  staff: { id: r.s_id as number, fullName: r.s_name as string },
});

// ---------- status ----------
export async function updateEnquiryStatus(id: number, status: EnquiryStatus, staffId: number): Promise<EnquiryDto> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>("SELECT status FROM enquiries WHERE id = ? FOR UPDATE", [id]);
    if (!rows[0]) throw notFound();
    const current = rows[0].status as EnquiryStatus;
    if (current !== status) {
      await conn.execute("UPDATE enquiries SET status = ? WHERE id = ?", [status, id]);
      await conn.execute(
        "INSERT INTO enquiry_status_history (enquiry_id, from_status, to_status, changed_by, reason) VALUES (?, ?, ?, ?, 'MANUAL')",
        [id, current, status, staffId],
      );
    }
    const enquiry = await getEnquiry(id, conn);
    await conn.commit();
    return enquiry!;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
