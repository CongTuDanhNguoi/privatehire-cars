// /api/dev/* — helpers for automated tests. Never mounted when NODE_ENV=production.
// Only returns codes that were NOT really emailed (MOCK provider or reserved test domains like example.com),
// so it can never reveal a code sent to a real inbox.
import { Router } from "express";
import { AppError } from "../errors.js";
import { mockCodes } from "../services/emailVerificationService.js";
import { normalizeEmail } from "../services/loginAttempts.js";
import { EmailQuery, parseInput } from "../validation/auth.js";

export const devRouter = Router();

// The last verification code that was "sent" without a real email to this address.
devRouter.get("/last-verification-code", (req, res) => {
  const { email } = parseInput(EmailQuery, req.query);
  const code = mockCodes.get(normalizeEmail(email));
  if (!code) throw new AppError("NOT_FOUND", "No verification code was sent to this email.");
  res.json({ code });
});
