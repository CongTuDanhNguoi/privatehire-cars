// One error shape for every API failure:
//   { "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { ... } } }
// Stack traces are logged on the server only, never sent to the client.
import type { ErrorRequestHandler, RequestHandler } from "express";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "FORBIDDEN"
  | "CALLER_NOT_VERIFIED"
  | "CALLER_OTP_INCORRECT"
  | "CALLER_OTP_EXPIRED"
  | "CALLER_OTP_EXHAUSTED"
  | "CALLER_OTP_INVALID"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EMAIL_SEND_FAILED"
  | "EMAIL_NOT_VERIFIED"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  FORBIDDEN: 403,
  CALLER_NOT_VERIFIED: 403,
  CALLER_OTP_INCORRECT: 400,
  CALLER_OTP_EXPIRED: 400,
  CALLER_OTP_EXHAUSTED: 400,
  CALLER_OTP_INVALID: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_SEND_FAILED: 502,
  EMAIL_NOT_VERIFIED: 403,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    // `response` is only used by EMAIL_SEND_FAILED (the saved FAILED response record).
    readonly extra: {
      fields?: FieldErrors;
      minutesLeft?: number;
      retryAfterSeconds?: number;
      attemptsRemaining?: number;
      email?: string;
      response?: unknown;
    } = {},
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const validationError = (fields: FieldErrors, message = "Please correct the highlighted fields.") =>
  new AppError("VALIDATION_ERROR", message, { fields });

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

// Unknown /api/* routes.
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("NOT_FOUND", "The requested resource was not found."));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const { response, ...extra } = err.extra;
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...extra },
      ...(response !== undefined ? { response } : {}),
    });
    return;
  }
  // Malformed JSON body (thrown by express.json()).
  if (err && typeof err === "object" && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." } });
    return;
  }
  console.error("[unhandled error]", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE } });
};
