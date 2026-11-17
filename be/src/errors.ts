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
  | "NOT_FOUND"
  | "CONFLICT"
  | "EMAIL_SEND_FAILED"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_SEND_FAILED: 502,
  INTERNAL_ERROR: 500,
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly extra: { fields?: FieldErrors; minutesLeft?: number } = {},
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
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
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
