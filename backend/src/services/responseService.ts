// Staff replies by email (plan §7.4). Order matters:
//  1 validate · 2 duplicate clientRequestId → return the existing record, never send twice
//  3 save as PENDING · 4 send (10 s timeout), attempt_count + 1
//  5 success → SENT, and AWAITING enquiry → RESOLVED (+ history AUTO_AFTER_RESPONSE), in one transaction
//  6 failure → FAILED with a short error, enquiry status unchanged
//  7 retry re-uses the same record and repeats 4–6.
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { AppError, validationError } from "../errors.js";
import { deliveryAddressFor, emailSettings, sendEmail } from "../email/index.js";
import { validateEmail } from "../../../app/src/validation/rules";
import { REPLY_MESSAGES, enquiryCode, validateReply } from "../validation/reply.js";
import { RESPONSE_SELECT, getEnquiry, notFound, toResponse, type EnquiryDto } from "./staffEnquiryService.js";

type ResponseDto = ReturnType<typeof toResponse>;
export type DeliveryOutcome = { sent: boolean; response: ResponseDto; enquiry: EnquiryDto };

export const SEND_FAILED_MESSAGE = "Email could not be sent. Your response was saved as Failed — you can retry.";

async function loadResponse(id: number): Promise<ResponseDto | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(`${RESPONSE_SELECT} WHERE r.id = ?`, [id]);
  return rows[0] ? toResponse(rows[0]) : null;
}

async function outcomeFor(responseId: number): Promise<DeliveryOutcome> {
  const response = (await loadResponse(responseId))!;
  const enquiry = (await getEnquiry(response.enquiryId))!;
  return { sent: response.sendStatus === "SENT", response, enquiry };
}

// Steps 4–6 for one response record (already marked PENDING).
async function deliver(responseId: number): Promise<DeliveryOutcome> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.subject, r.body, r.enquiry_id, c.full_name, c.email
     FROM enquiry_responses r JOIN enquiries e ON e.id = r.enquiry_id JOIN customers c ON c.id = e.customer_id
     WHERE r.id = ?`,
    [responseId],
  );
  const row = rows[0];
  await pool.execute("UPDATE enquiry_responses SET attempt_count = attempt_count + 1 WHERE id = ?", [responseId]);

  const result = await sendEmail({
    customerEmail: row.email,
    customerName: row.full_name,
    subject: row.subject,
    body: row.body,
    enquiryCode: enquiryCode(row.enquiry_id),
  });

  if (!result.ok) {
    await pool.execute("UPDATE enquiry_responses SET send_status = 'FAILED', error_message = ? WHERE id = ?", [
      result.error,
      responseId,
    ]);
    return outcomeFor(responseId);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "UPDATE enquiry_responses SET send_status = 'SENT', sent_at = UTC_TIMESTAMP(), error_message = NULL WHERE id = ?",
      [responseId],
    );
    const [enq] = await conn.execute<RowDataPacket[]>("SELECT status FROM enquiries WHERE id = ? FOR UPDATE", [row.enquiry_id]);
    if (enq[0]?.status === "AWAITING") {
      await conn.execute("UPDATE enquiries SET status = 'RESOLVED' WHERE id = ?", [row.enquiry_id]);
      await conn.execute(
        `INSERT INTO enquiry_status_history (enquiry_id, from_status, to_status, changed_by, reason)
         VALUES (?, 'AWAITING', 'RESOLVED', NULL, 'AUTO_AFTER_RESPONSE')`,
        [row.enquiry_id],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return outcomeFor(responseId);
}

async function findByClientRequestId(clientRequestId: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, enquiry_id, send_status FROM enquiry_responses WHERE client_request_id = ?",
    [clientRequestId],
  );
  return rows[0] as { id: number; enquiry_id: number; send_status: string } | undefined;
}

// An existing record for the same clientRequestId (double click / network retry): report it, do not send again.
async function existingOutcome(existing: { id: number; enquiry_id: number; send_status: string }, enquiryId: number) {
  if (existing.enquiry_id !== enquiryId) {
    throw new AppError("CONFLICT", "This request id was already used for a different enquiry.");
  }
  if (existing.send_status === "PENDING") {
    throw new AppError("CONFLICT", "This response is already being sent. Please wait a moment.");
  }
  return outcomeFor(existing.id);
}

export async function sendResponse(
  enquiryId: number,
  staffId: number,
  input: { clientRequestId: string; subject: string; body: string },
): Promise<DeliveryOutcome> {
  // 1. validate
  const errors = validateReply(input);
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT c.email FROM enquiries e JOIN customers c ON c.id = e.customer_id WHERE e.id = ?",
    [enquiryId],
  );
  if (!rows[0]) throw notFound();
  const customerEmail = String(rows[0].email ?? "");

  // 2. same clientRequestId already saved → return it
  const existing = await findByClientRequestId(input.clientRequestId);
  if (existing) return existingOutcome(existing, enquiryId);

  if (validateEmail(customerEmail)) throw new AppError("VALIDATION_ERROR", REPLY_MESSAGES.invalidCustomerEmail);

  // 3. save as PENDING
  let responseId: number;
  try {
    const [r] = await pool.execute<ResultSetHeader>(
      `INSERT INTO enquiry_responses
         (enquiry_id, staff_id, client_request_id, subject, body, intended_to, delivered_to, provider, test_mode, send_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        enquiryId,
        staffId,
        input.clientRequestId,
        input.subject.trim(),
        input.body.trim(),
        customerEmail,
        deliveryAddressFor(customerEmail),
        emailSettings.provider,
        emailSettings.testMode,
      ],
    );
    responseId = r.insertId;
  } catch (err) {
    // Two identical requests at the same moment: the UNIQUE index lets only one through.
    if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") {
      const dup = await findByClientRequestId(input.clientRequestId);
      if (dup) return existingOutcome(dup, enquiryId);
    }
    throw err;
  }

  // 4–6
  return deliver(responseId);
}

export async function retryResponse(responseId: number): Promise<DeliveryOutcome> {
  // Claim the record atomically so two retries cannot send twice. Current email settings are applied.
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.send_status, c.email FROM enquiry_responses r
     JOIN enquiries e ON e.id = r.enquiry_id JOIN customers c ON c.id = e.customer_id WHERE r.id = ?`,
    [responseId],
  );
  if (!rows[0]) throw new AppError("NOT_FOUND", "Response not found.");
  const customerEmail = String(rows[0].email);

  const [claim] = await pool.execute<ResultSetHeader>(
    `UPDATE enquiry_responses SET send_status = 'PENDING', provider = ?, test_mode = ?, delivered_to = ?
     WHERE id = ? AND send_status = 'FAILED'`,
    [emailSettings.provider, emailSettings.testMode, deliveryAddressFor(customerEmail), responseId],
  );
  if (claim.affectedRows === 0) {
    throw new AppError("CONFLICT", "Only responses that failed to send can be retried.");
  }
  return deliver(responseId);
}
