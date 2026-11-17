// Protects /api/staff/* routes: requires a valid phc_staff cookie.
import type { RequestHandler } from "express";
import { AppError } from "../errors.js";
import { readSession } from "../services/session.js";

export const requireStaff: RequestHandler = (req, res, next) => {
  const session = readSession(req, "staff");
  if (!session) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  res.locals.staffId = session.id;
  next();
};
