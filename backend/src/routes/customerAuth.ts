// /api/customer/auth/*
import { Router } from "express";
import { AppError } from "../errors.js";
import { LOGIN_MESSAGES } from "../../../app/src/validation/loginValidation";
import { loginRateLimit } from "../middleware/loginRateLimit.js";
import { requireCustomer } from "../middleware/requireCustomer.js";
import {
  authenticateCustomer,
  findCustomerUser,
  isCustomerEmailRegistered,
  registerCustomer,
} from "../services/customerAuthService.js";
import {
  issueVerificationCode,
  resendVerificationCode,
  verifyEmailCode,
} from "../services/emailVerificationService.js";
import { requestPasswordReset, resetPassword, verifyResetCode } from "../services/passwordResetService.js";
import { endSession, startSession } from "../services/session.js";
import { EmailQuery, LoginBody, RegisterBody, ResetPasswordBody, VerifyEmailBody, parseInput } from "../validation/auth.js";

export const customerAuthRouter = Router();

customerAuthRouter.post("/register", async (req, res) => {
  // SCRUM-12 / P0-17: registering does NOT sign the customer in.
  // P0-18: the account starts unverified and a 6-digit code is emailed to the customer.
  const { id, user } = await registerCustomer(parseInput(RegisterBody, req.body));
  const verification = await issueVerificationCode({ id, ...user }, { enforceCooldown: false });
  res.status(201).json({ user, verification });
});

customerAuthRouter.post("/verify-email", async (req, res) => {
  const { email, code } = parseInput(VerifyEmailBody, req.body);
  const user = await verifyEmailCode(email, code);
  res.json({ user, verified: true });
});

customerAuthRouter.post("/resend-code", async (req, res) => {
  const { email } = parseInput(EmailQuery, req.body);
  res.json({ verification: await resendVerificationCode(email) });
});

customerAuthRouter.post("/login", loginRateLimit("CUSTOMER", LOGIN_MESSAGES.locked), async (req, res) => {
  const { id, user } = await authenticateCustomer(parseInput(LoginBody, req.body));
  const loggedInAt = startSession(res, "customer", id);
  res.json({ user: { ...user, loggedInAt: loggedInAt.toISOString() } });
});

customerAuthRouter.post("/logout", (_req, res) => {
  endSession(res, "customer");
  res.status(204).end();
});

customerAuthRouter.get("/me", requireCustomer, async (_req, res) => {
  const user = await findCustomerUser(res.locals.customerId!);
  if (!user) {
    endSession(res, "customer");
    throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  }
  res.json({ user: { ...user, loggedInAt: res.locals.sessionIssuedAt!.toISOString() } });
});

// ---------- Forgot password (SCRUM-65): email → 4-digit code → new password ----------
customerAuthRouter.post("/forgot-password", async (req, res) => {
  const { email } = parseInput(EmailQuery, req.body);
  res.json({ reset: await requestPasswordReset(email) });
});

customerAuthRouter.post("/verify-reset-code", async (req, res) => {
  const { email, code } = parseInput(VerifyEmailBody, req.body);
  res.json(await verifyResetCode(email, code));
});

customerAuthRouter.post("/reset-password", async (req, res) => {
  await resetPassword(parseInput(ResetPasswordBody, req.body));
  res.json({ ok: true });
});

customerAuthRouter.get("/email-exists", async (req, res) => {
  const { email } = parseInput(EmailQuery, req.query);
  res.json({ exists: await isCustomerEmailRegistered(email) });
});
