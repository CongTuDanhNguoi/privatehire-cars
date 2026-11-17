// /api/staff/enquiries/*
import { Router } from "express";
import { AppError } from "../errors.js";
import { requireStaff } from "../middleware/requireStaff.js";
import { SEND_FAILED_MESSAGE, sendResponse, type DeliveryOutcome } from "../services/responseService.js";
import { getEnquiryDetail, listEnquiries, notFound, updateEnquiryStatus } from "../services/staffEnquiryService.js";
import { parseInput } from "../validation/auth.js";
import { ListEnquiriesQuery, SendResponseBody, UpdateStatusBody, parseId } from "../validation/enquiries.js";

export const staffEnquiriesRouter = Router();
staffEnquiriesRouter.use(requireStaff);

// 201/200 when the email was sent; 502 EMAIL_SEND_FAILED (with the saved FAILED record) when it was not.
export function replyWithOutcome(res: import("express").Response, outcome: DeliveryOutcome, successStatus: number) {
  if (!outcome.sent) {
    throw new AppError("EMAIL_SEND_FAILED", SEND_FAILED_MESSAGE, { response: outcome.response });
  }
  res.status(successStatus).json({ response: outcome.response, enquiry: outcome.enquiry });
}

staffEnquiriesRouter.get("/", async (req, res) => {
  res.json(await listEnquiries(parseInput(ListEnquiriesQuery, req.query)));
});

staffEnquiriesRouter.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw notFound();
  res.json(await getEnquiryDetail(id));
});

staffEnquiriesRouter.patch("/:id/status", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw notFound();
  const { status } = parseInput(UpdateStatusBody, req.body);
  res.json({ enquiry: await updateEnquiryStatus(id, status, res.locals.staffId!) });
});

staffEnquiriesRouter.post("/:id/responses", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw notFound();
  const body = parseInput(SendResponseBody, req.body);
  const outcome = await sendResponse(id, res.locals.staffId!, body);
  replyWithOutcome(res, outcome, 201);
});
