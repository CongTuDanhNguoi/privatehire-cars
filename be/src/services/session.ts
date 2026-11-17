// Login sessions: a signed JWT ({ sub, kind }) stored in an httpOnly cookie.
// Staff and customers use separate cookies, so one kind of session can never act as the other.
import type { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type SessionKind = "staff" | "customer";

export const SESSION_COOKIE: Record<SessionKind, string> = {
  staff: "phc_staff",
  customer: "phc_customer",
};

interface SessionPayload {
  kind: SessionKind;
  sub: string;
  iat: number;
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  // Demo runs on http://localhost; set `secure: true` when served over HTTPS.
  secure: false,
});

export function startSession(res: Response, kind: SessionKind, id: number): Date {
  const token = jwt.sign({ kind }, config.jwtSecret, {
    subject: String(id),
    expiresIn: Math.round(config.sessionHours * 3600),
  });
  res.cookie(SESSION_COOKIE[kind], token, { ...cookieOptions(), maxAge: config.sessionHours * 3_600_000 });
  return new Date();
}

export function endSession(res: Response, kind: SessionKind): void {
  res.clearCookie(SESSION_COOKIE[kind], cookieOptions());
}

// Returns the signed-in account id for this kind of session, or null when missing/invalid/expired.
export function readSession(req: Request, kind: SessionKind): { id: number; issuedAt: Date } | null {
  const token: unknown = req.cookies?.[SESSION_COOKIE[kind]];
  if (typeof token !== "string" || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as Partial<SessionPayload>;
    const id = Number(payload.sub);
    if (payload.kind !== kind || !Number.isInteger(id) || id <= 0 || typeof payload.iat !== "number") return null;
    return { id, issuedAt: new Date(payload.iat * 1000) };
  } catch {
    return null;
  }
}
