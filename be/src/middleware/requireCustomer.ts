// Protects /api/customer/* routes (except register / login / email-exists): requires a valid phc_customer cookie.
import type { RequestHandler } from "express";
import { AppError } from "../errors.js";
import { readSession } from "../services/session.js";

export const requireCustomer: RequestHandler = (req, res, next) => {
  const session = readSession(req, "customer");
  if (!session) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  res.locals.customerId = session.id;
  res.locals.sessionIssuedAt = session.issuedAt;
  next();
};
