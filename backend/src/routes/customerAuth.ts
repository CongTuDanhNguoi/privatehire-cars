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
import { endSession, startSession } from "../services/session.js";
import { EmailQuery, LoginBody, RegisterBody, parseInput } from "../validation/auth.js";

export const customerAuthRouter = Router();

customerAuthRouter.post("/register", async (req, res) => {
  // SCRUM-12 / decision P0-17: registering does NOT sign the customer in — they log in afterwards.
  const { user } = await registerCustomer(parseInput(RegisterBody, req.body));
  res.status(201).json({ user });
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

customerAuthRouter.get("/email-exists", async (req, res) => {
  const { email } = parseInput(EmailQuery, req.query);
  res.json({ exists: await isCustomerEmailRegistered(email) });
});
