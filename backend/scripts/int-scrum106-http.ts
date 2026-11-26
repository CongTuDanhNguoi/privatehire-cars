// Non-destructive Express HTTP integration tests for SCRUM-106 (no live MySQL DB required).
// Stubs pool.execute in-memory to verify real Express routing, JWT staff cookies, validation,
// 401/400/403 responses, data isolation, and logout/clear invalidation over HTTP.
// Run with: npx tsx --test scripts/int-scrum106-http.ts
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { config } from "../src/config.js";
import { pool } from "../src/db.js";
import { createApp } from "../src/app.js";
import { callerVerificationStore } from "../src/services/callerVerificationService.js";

const MOCK_CUSTOMERS = [
  {
    id: 1,
    full_name: "Alex Morgan",
    email: "alex.morgan@example.com",
    phone: "+44 7911 123456",
    phone_normalized: "07911123456",
    home_address: "221B Baker St, London",
    card_last4: "4242",
  },
  {
    id: 2,
    full_name: "Sam Taylor",
    email: "sam.taylor@example.com",
    phone: "07700 900123",
    phone_normalized: "07700900123",
    home_address: "10 Downing St, London",
    card_last4: "1111",
  },
  {
    id: 3,
    full_name: "Jamie Taylor",
    email: "jamie.taylor@example.com",
    phone: "+44 7700 900123",
    phone_normalized: "07700900123",
    home_address: "12 Downing St, London",
    card_last4: "2222",
  },
];

let server: Server;
let baseUrl = "";
const originalExecute = pool.execute.bind(pool);

function makeStaffCookie(staffId = 1): string {
  const token = jwt.sign({ kind: "staff" }, config.jwtSecret, {
    subject: String(staffId),
    expiresIn: 3600,
  });
  return `phc_staff=${token}`;
}

describe("SCRUM-106 Express HTTP integration (mocked DB pool)", () => {
  before(async () => {
    // Stub pool.execute so tests never touch a real database.
    (pool as unknown as { execute: (sql: string, params?: unknown[]) => Promise<[unknown[], unknown]> }).execute = async (
      sql: string,
      params: unknown[] = [],
    ) => {
      if (sql.includes("FROM customers") && sql.includes("WHERE phone_normalized = ?")) {
        const target = String(params[0] ?? "");
        return [MOCK_CUSTOMERS.filter((c) => c.phone_normalized === target), []];
      }
      if (sql.includes("FROM customers") && sql.includes("WHERE id = ?")) {
        const id = Number(params[0]);
        return [MOCK_CUSTOMERS.filter((c) => c.id === id), []];
      }
      return [[], []];
    };

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    (pool as unknown as { execute: typeof originalExecute }).execute = originalExecute;
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("rejects unauthenticated search with 401", async () => {
    const res = await fetch(`${baseUrl}/staff/customers/search?phone=07911123456`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });

  it("rejects invalid phone input with 400 VALIDATION_ERROR", async () => {
    const res = await fetch(`${baseUrl}/staff/customers/search?phone=abc`, {
      headers: { Cookie: makeStaffCookie(1) },
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.error.fields?.phone);
  });

  it("matches equivalent UK formats (+44, 0044, 0) and hides protected fields", async () => {
    const cookie = makeStaffCookie(1);
    for (const q of ["+44 7911 123456", "0044 7911-123-456", "07911 123456"]) {
      const res = await fetch(`${baseUrl}/staff/customers/search?phone=${encodeURIComponent(q)}`, {
        headers: { Cookie: cookie },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { customers: Array<Record<string, unknown>> };
      assert.equal(body.customers.length, 1);
      assert.equal(body.customers[0].id, 1);
      assert.equal(body.customers[0].fullName, "Alex Morgan");
      assert.equal(body.customers[0].maskedEmail, "al***@example.com");
      assert.equal("homeAddress" in body.customers[0], false);
      assert.equal("cardLast4" in body.customers[0], false);
      assert.equal("email" in body.customers[0], false);
    }
  });

  it("handles zero and multiple matching customer accounts", async () => {
    const cookie = makeStaffCookie(1);

    const zeroRes = await fetch(`${baseUrl}/staff/customers/search?phone=07999999999`, {
      headers: { Cookie: cookie },
    });
    assert.equal(zeroRes.status, 200);
    const zeroBody = (await zeroRes.json()) as { customers: unknown[] };
    assert.equal(zeroBody.customers.length, 0);

    const multiRes = await fetch(`${baseUrl}/staff/customers/search?phone=${encodeURIComponent("+44 7700 900123")}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(multiRes.status, 200);
    const multiBody = (await multiRes.json()) as { customers: Array<{ id: number }> };
    assert.equal(multiBody.customers.length, 2);
    assert.deepEqual(
      multiBody.customers.map((c) => c.id),
      [2, 3],
    );
  });

  it("returns 403 CALLER_NOT_VERIFIED for unverified profile and booking-history requests", async () => {
    const cookie = makeStaffCookie(1);
    await callerVerificationStore.clearVerification(1);

    const profileRes = await fetch(`${baseUrl}/staff/customers/1`, { headers: { Cookie: cookie } });
    assert.equal(profileRes.status, 403);
    assert.equal(((await profileRes.json()) as { error: { code: string } }).error.code, "CALLER_NOT_VERIFIED");

    const bookingsRes = await fetch(`${baseUrl}/staff/customers/1/bookings`, { headers: { Cookie: cookie } });
    assert.equal(bookingsRes.status, 403);
    assert.equal(((await bookingsRes.json()) as { error: { code: string } }).error.code, "CALLER_NOT_VERIFIED");
  });

  it("clears caller verification on session/clear and staff logout", async () => {
    const cookie = makeStaffCookie(1);
    const decoded = jwt.decode(cookie.replace("phc_staff=", "")) as { iat: number };
    const issuedAt = new Date(decoded.iat * 1000);

    await callerVerificationStore.grantVerification(1, 1, issuedAt);
    assert.equal(await callerVerificationStore.hasVerifiedCaller(1, 1, issuedAt), true);

    const clearRes = await fetch(`${baseUrl}/staff/customers/session/clear`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(clearRes.status, 204);
    assert.equal(await callerVerificationStore.hasVerifiedCaller(1, 1, issuedAt), false);

    await callerVerificationStore.grantVerification(1, 1, issuedAt);
    const logoutRes = await fetch(`${baseUrl}/staff/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(logoutRes.status, 204);
    assert.equal(await callerVerificationStore.hasVerifiedCaller(1, 1, issuedAt), false);
  });
});
