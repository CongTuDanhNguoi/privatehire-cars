// /api/staff/customers/* (SCRUM-106 + SCRUM-107: search, simulated caller OTP, protected account & booking history)
import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors.js";
import { requireStaff } from "../middleware/requireStaff.js";
import { requireVerifiedCaller } from "../middleware/requireVerifiedCaller.js";
import {
  beginVerifiedNewCustomerCreation,
  callerVerificationStore,
  getVerifiedNewCustomerEntry,
  sendExistingCustomerOtp,
  sendNewCustomerOtp,
  verifyExistingCustomerOtp,
  verifyNewCustomerOtp,
} from "../services/callerVerificationService.js";
import {
  getVerifiedCustomerProfile,
  listVerifiedCustomerBookings,
  searchCustomersByPhone,
} from "../services/staffCustomerService.js";
import { parseInput } from "../validation/auth.js";
import { parseId } from "../validation/enquiries.js";

const VerifyOtpBody = z.object({ code: z.string().default("") });
const NewCustomerPhoneBody = z.object({ phone: z.string().default("") });
const VerifyNewCustomerOtpBody = z.object({ phone: z.string().default(""), code: z.string().default("") });

export const staffCustomersRouter = Router();
staffCustomersRouter.use(requireStaff);

staffCustomersRouter.get("/search", async (req, res) => {
  const rawPhone = typeof req.query.phone === "string" ? req.query.phone : "";
  const customers = await searchCustomersByPhone(rawPhone);
  res.json({ customers });
});

staffCustomersRouter.post("/session/clear", async (_req, res) => {
  await callerVerificationStore.clearVerification(res.locals.staffId!);
  res.status(204).end();
});

staffCustomersRouter.post("/new/otp/send", async (req, res) => {
  const { phone } = parseInput(NewCustomerPhoneBody, req.body);
  res.json(await sendNewCustomerOtp(res.locals.staffId!, phone, res.locals.sessionIssuedAt!));
});

staffCustomersRouter.post("/new/otp/verify", async (req, res) => {
  const { phone, code } = parseInput(VerifyNewCustomerOtpBody, req.body);
  res.json(await verifyNewCustomerOtp(res.locals.staffId!, phone, res.locals.sessionIssuedAt!, code));
});

staffCustomersRouter.post("/new/begin", async (req, res) => {
  const { phone } = parseInput(NewCustomerPhoneBody, req.body);
  res.json(await beginVerifiedNewCustomerCreation(res.locals.staffId!, phone, res.locals.sessionIssuedAt!));
});

staffCustomersRouter.get("/new/entry", async (_req, res) => {
  res.json(await getVerifiedNewCustomerEntry(res.locals.staffId!, res.locals.sessionIssuedAt!));
});

staffCustomersRouter.post("/:id/otp/send", async (req, res) => {
  const customerId = parseId(req.params.id);
  if (!customerId) throw new AppError("NOT_FOUND", "Customer account not found.");
  res.json(await sendExistingCustomerOtp(res.locals.staffId!, customerId, res.locals.sessionIssuedAt!));
});

staffCustomersRouter.post("/:id/otp/verify", async (req, res) => {
  const customerId = parseId(req.params.id);
  if (!customerId) throw new AppError("NOT_FOUND", "Customer account not found.");
  const { code } = parseInput(VerifyOtpBody, req.body);
  res.json(await verifyExistingCustomerOtp(res.locals.staffId!, customerId, res.locals.sessionIssuedAt!, code));
});

staffCustomersRouter.get("/:id", requireVerifiedCaller, async (req, res) => {
  const customerId = parseId(req.params.id)!;
  res.json({ customer: await getVerifiedCustomerProfile(customerId) });
});

staffCustomersRouter.get("/:id/bookings", requireVerifiedCaller, async (req, res) => {
  const customerId = parseId(req.params.id)!;
  res.json({ bookings: await listVerifiedCustomerBookings(customerId) });
});
