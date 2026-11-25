// Protects staff customer profile and booking-history endpoints until caller verification is granted.
import type { RequestHandler } from "express";
import { AppError } from "../errors.js";
import { callerVerificationStore } from "../services/callerVerificationService.js";
import { parseId } from "../validation/enquiries.js";

export function createRequireVerifiedCaller(
  store: Pick<typeof callerVerificationStore, "hasVerifiedCaller"> = callerVerificationStore,
): RequestHandler {
  return async (req, res, next) => {
    const staffId = res.locals.staffId;
    const sessionIssuedAt = res.locals.sessionIssuedAt;
    if (!staffId || !sessionIssuedAt) {
      throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
    }

    const customerId = parseId(req.params.id);
    if (!customerId) {
      throw new AppError("NOT_FOUND", "Customer account not found.");
    }

    const verified = await store.hasVerifiedCaller(staffId, customerId, sessionIssuedAt);
    if (!verified) {
      throw new AppError(
        "CALLER_NOT_VERIFIED",
        "Caller verification is required before accessing this customer account.",
      );
    }

    next();
  };
}

export const requireVerifiedCaller = createRequireVerifiedCaller();
