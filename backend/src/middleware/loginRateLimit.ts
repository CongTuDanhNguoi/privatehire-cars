// Rejects a login request early (423) while the email is locked after too many failed attempts.
import type { RequestHandler } from "express";
import { AppError } from "../errors.js";
import { lockedMinutesLeft, type LoginScope } from "../services/loginAttempts.js";

export function loginRateLimit(scope: LoginScope, lockedMessage: (minutes: number) => string): RequestHandler {
  return async (req, _res, next) => {
    const email: unknown = req.body?.email;
    if (typeof email === "string" && email.trim()) {
      const minutesLeft = await lockedMinutesLeft(scope, email);
      if (minutesLeft > 0) throw new AppError("ACCOUNT_LOCKED", lockedMessage(minutesLeft), { minutesLeft });
    }
    next();
  };
}
