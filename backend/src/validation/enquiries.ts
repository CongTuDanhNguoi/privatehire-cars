// Request schemas for enquiry routes. zod checks shape/types; field rules live in shared validators.
import { z } from "zod";

const text = z.string().default("");

export const CreateEnquiryBody = z.object({
  type: z.string().default(""),
  bookingId: z.union([z.number(), z.null()]).optional().default(null),
  subject: text,
  message: text,
});

export const ListEnquiriesQuery = z.object({
  type: z.enum(["ALL", "GENERAL", "TRIP"]).default("ALL"),
  status: z.enum(["ALL", "AWAITING", "RESOLVED"]).default("ALL"),
  q: z.string().trim().max(100).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListEnquiriesQuery = z.infer<typeof ListEnquiriesQuery>;

export const UpdateStatusBody = z.object({ status: z.enum(["AWAITING", "RESOLVED"]) });

export const SendResponseBody = z.object({
  clientRequestId: z.uuid(),
  subject: text,
  body: text,
});

// Route ids: anything that is not a positive integer is treated as "not found".
export function parseId(raw: unknown): number | null {
  const id = Number(raw);
  return typeof raw === "string" && /^\d+$/.test(raw) && Number.isSafeInteger(id) && id > 0 ? id : null;
}
