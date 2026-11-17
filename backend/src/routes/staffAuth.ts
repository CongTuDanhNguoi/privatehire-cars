// /api/staff/auth/*
import { Router } from "express";
import { AppError } from "../errors.js";
import { loginRateLimit } from "../middleware/loginRateLimit.js";
import { requireStaff } from "../middleware/requireStaff.js";
import { authenticateStaff, findStaff } from "../services/staffAuthService.js";
import { endSession, startSession } from "../services/session.js";
import { LoginBody, STAFF_LOGIN_MESSAGES, parseInput } from "../validation/auth.js";

export const staffAuthRouter = Router();

staffAuthRouter.post("/login", loginRateLimit("STAFF", STAFF_LOGIN_MESSAGES.locked), async (req, res) => {
  const staff = await authenticateStaff(parseInput(LoginBody, req.body));
  startSession(res, "staff", staff.id);
  res.json({ staff });
});

staffAuthRouter.post("/logout", (_req, res) => {
  endSession(res, "staff");
  res.status(204).end();
});

staffAuthRouter.get("/me", requireStaff, async (_req, res) => {
  const staff = await findStaff(res.locals.staffId!);
  if (!staff) {
    endSession(res, "staff");
    throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  }
  res.json({ staff });
});
