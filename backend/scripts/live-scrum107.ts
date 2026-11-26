// Live isolated MySQL + Express integration tests for SCRUM-107 (scenarios 1-16).
// Safety guard: refuses to run unless DB_HOST=127.0.0.1, DB_PORT=3308, DB_NAME=privatehire_test.
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import { config } from "../src/config.js";
import { pool } from "../src/db.js";
import { createApp } from "../src/app.js";

const BE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "3308" ||
  process.env.DB_NAME !== "privatehire_test"
) {
  throw new Error("SAFETY STOP: Refusing to run live-scrum107 outside 127.0.0.1:3308/privatehire_test");
}

function runTsx(scriptRelPath: string, args: string[] = []) {
  const res = spawnSync(process.execPath, ["--import", "tsx", path.join(BE_ROOT, scriptRelPath), ...args], {
    cwd: BE_ROOT,
    env: process.env,
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`${scriptRelPath} failed:\n${res.stdout}\n${res.stderr}`);
}

let server: import("node:http").Server;
let baseUrl = "";
let conn: mysql.Connection;
let staffCookie = "";
let alexId = 0;
let emilyId = 0;
let zeroBookingCustomerId = 0;

function makeStaffCookieWithIat(staffId: number, iatOffsetSeconds: number): string {
  const nowSec = Math.floor(Date.now() / 1000) + iatOffsetSeconds;
  const token = jwt.sign({ kind: "staff", iat: nowSec, exp: nowSec + 3600 }, config.jwtSecret, {
    subject: String(staffId),
  });
  return `phc_staff=${token}`;
}

describe("SCRUM-107 Live MySQL & Express API Integration (scenarios 1-16)", () => {
  before(async () => {
    conn = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3308,
      user: process.env.DB_USER || "phc_test",
      password: process.env.DB_PASSWORD || "",
      database: "privatehire_test",
      multipleStatements: true,
      timezone: "Z",
    });

    // Apply additive upgradeCallerVerifications via db-init.ts and ensure clean demo seed
    runTsx("scripts/db-init.ts");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("TRUNCATE TABLE caller_verifications; TRUNCATE TABLE enquiry_status_history; TRUNCATE TABLE enquiry_responses; TRUNCATE TABLE enquiries; TRUNCATE TABLE bookings; TRUNCATE TABLE customers; TRUNCATE TABLE staff;");
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    runTsx("scripts/seed.ts", ["--demo"]);

    // Insert a fictional customer with zero bookings for scenario 12
    const [ins] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO customers (full_name, email, phone, phone_normalized, home_address, card_last4, password_hash, email_verified_at)
       VALUES ('Zero Bookings', 'zero.bookings@example.com', '07700 900777', '07700900777', '1 Empty St', '0000', 'hash', UTC_TIMESTAMP())`,
    );
    zeroBookingCustomerId = ins.insertId;

    const [custRows] = await conn.query<mysql.RowDataPacket[]>("SELECT id, email FROM customers");
    alexId = custRows.find((r) => r.email === "alex.morgan@example.com")!.id as number;
    emilyId = custRows.find((r) => r.email === "emily.clarke@example.com")!.id as number;

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as import("node:net").AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });

    const loginRes = await fetch(`${baseUrl}/staff/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gmail.com", password: "123456" }),
    });
    assert.equal(loginRes.status, 200);
    staffCookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await conn.end();
    await pool.end();
  });

  it("1, 10, 11: Correct OTP unlocks profile & only that customer's bookings", async () => {
    // 10: Unverified booking-history returns 403
    const preBookings = await fetch(`${baseUrl}/staff/customers/${alexId}/bookings`, {
      headers: { Cookie: staffCookie },
    });
    assert.equal(preBookings.status, 403);

    const sendRes = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    assert.equal(sendRes.status, 200);
    const otpInfo = (await sendRes.json()) as { simulation: boolean; simulatedCode: string; expiresInMinutes: number };
    assert.equal(otpInfo.simulation, true);
    assert.equal(otpInfo.expiresInMinutes, 5);
    assert.match(otpInfo.simulatedCode, /^\d{6}$/);

    // Verify plaintext OTP is NOT stored in caller_verifications
    const [dbRows] = await conn.query<mysql.RowDataPacket[]>("SELECT code_hash FROM caller_verifications WHERE staff_id = 1");
    assert.notEqual(dbRows[0].code_hash, otpInfo.simulatedCode);
    assert.equal(String(dbRows[0].code_hash).length, 64);

    // 1: Correct OTP
    const verifyRes = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: otpInfo.simulatedCode }),
    });
    assert.equal(verifyRes.status, 200);

    const profRes = await fetch(`${baseUrl}/staff/customers/${alexId}`, { headers: { Cookie: staffCookie } });
    assert.equal(profRes.status, 200);
    const profBody = (await profRes.json()) as { customer: { fullName: string } };
    assert.equal(profBody.customer.fullName, "Alex Morgan");

    // 11: Only Alex's bookings (PHC-24051, PHC-24052)
    const bookRes = await fetch(`${baseUrl}/staff/customers/${alexId}/bookings`, { headers: { Cookie: staffCookie } });
    assert.equal(bookRes.status, 200);
    const bookBody = (await bookRes.json()) as { bookings: Array<{ bookingRef: string; status: string }> };
    assert.deepEqual(
      bookBody.bookings.map((b) => b.bookingRef).sort(),
      ["PHC-24051", "PHC-24052"],
    );
    assert.ok(bookBody.bookings.every((b) => b.status === "SAVED" || b.status === "PAID"));
  });

  it("2 & 4: Incorrect OTP decrements attempts and 3rd wrong attempt exhausts/invalidates OTP", async () => {
    const sendRes = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    const { simulatedCode } = (await sendRes.json()) as { simulatedCode: string };
    const wrongCode = simulatedCode === "000000" ? "999999" : "000000";

    for (const expectedLeft of [2, 1]) {
      const r = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
        method: "POST",
        headers: { Cookie: staffCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ code: wrongCode }),
      });
      assert.equal(r.status, 400);
      const body = (await r.json()) as { error: { code: string; attemptsRemaining: number } };
      assert.equal(body.error.code, "CALLER_OTP_INCORRECT");
      assert.equal(body.error.attemptsRemaining, expectedLeft);
    }

    // 3rd wrong attempt -> exhausted
    const r3 = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: wrongCode }),
    });
    assert.equal(r3.status, 400);
    assert.equal(((await r3.json()) as { error: { code: string } }).error.code, "CALLER_OTP_EXHAUSTED");

    // Even correct code is now rejected
    const rAfter = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: simulatedCode }),
    });
    assert.equal(rAfter.status, 400);
  });

  it("3: Five-minute expiration boundary rejects expired OTP", async () => {
    const sendRes = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    const { simulatedCode } = (await sendRes.json()) as { simulatedCode: string };

    // Move expires_at 1 second into the past
    await conn.execute("UPDATE caller_verifications SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE staff_id = 1");

    const verifyRes = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: simulatedCode }),
    });
    assert.equal(verifyRes.status, 400);
    assert.equal(((await verifyRes.json()) as { error: { code: string } }).error.code, "CALLER_OTP_EXPIRED");
  });

  it("5 & 6: Resend invalidates old OTP, and OTP cannot verify another customer", async () => {
    const s1 = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    const { simulatedCode: oldCode } = (await s1.json()) as { simulatedCode: string };

    const s2 = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    const { simulatedCode: newCode } = (await s2.json()) as { simulatedCode: string };

    // 6: Cannot verify Emily using Alex's OTP
    const wrongCust = await fetch(`${baseUrl}/staff/customers/${emilyId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode }),
    });
    assert.equal(wrongCust.status, 400);
    assert.equal(((await wrongCust.json()) as { error: { code: string } }).error.code, "CALLER_OTP_INVALID");

    // 5: Old code fails if different from newCode; newCode succeeds
    if (oldCode !== newCode) {
      const oldTry = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
        method: "POST",
        headers: { Cookie: staffCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ code: oldCode }),
      });
      assert.equal(oldTry.status, 400);
    }

    const newTry = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode }),
    });
    assert.equal(newTry.status, 200);
  });

  it("7, 8, 9: Another Staff session cannot reuse verification; switching & logout clear verification", async () => {
    // 7: Different staff session iat cannot access Alex
    const otherSessionCookie = makeStaffCookieWithIat(1, 50);
    const otherProf = await fetch(`${baseUrl}/staff/customers/${alexId}`, { headers: { Cookie: otherSessionCookie } });
    assert.equal(otherProf.status, 403);

    // 9: Switching customer (sending OTP for Emily) clears Alex's verification
    await fetch(`${baseUrl}/staff/customers/${emilyId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    const alexAfterSwitch = await fetch(`${baseUrl}/staff/customers/${alexId}`, { headers: { Cookie: staffCookie } });
    assert.equal(alexAfterSwitch.status, 403);

    // 8: Logout clears verification
    const s = await fetch(`${baseUrl}/staff/customers/${alexId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    const { simulatedCode } = (await s.json()) as { simulatedCode: string };
    await fetch(`${baseUrl}/staff/customers/${alexId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: simulatedCode }),
    });
    assert.equal((await fetch(`${baseUrl}/staff/customers/${alexId}`, { headers: { Cookie: staffCookie } })).status, 200);

    const logoutRes = await fetch(`${baseUrl}/staff/auth/logout`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    assert.equal(logoutRes.status, 204);
    // Replaying old cookie after logout fails 403 because DB grant was deleted
    assert.equal((await fetch(`${baseUrl}/staff/customers/${alexId}`, { headers: { Cookie: staffCookie } })).status, 403);
  });

  it("12 & 13: Empty booking history returns [] and retrieval failure returns 500", async () => {
    const s = await fetch(`${baseUrl}/staff/customers/${zeroBookingCustomerId}/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie },
    });
    const { simulatedCode } = (await s.json()) as { simulatedCode: string };
    await fetch(`${baseUrl}/staff/customers/${zeroBookingCustomerId}/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ code: simulatedCode }),
    });

    // 12: Empty booking history
    const emptyRes = await fetch(`${baseUrl}/staff/customers/${zeroBookingCustomerId}/bookings`, {
      headers: { Cookie: staffCookie },
    });
    assert.equal(emptyRes.status, 200);
    assert.deepEqual(await emptyRes.json(), { bookings: [] });

    // 13: Retrieval failure (simulate DB error on bookings query)
    const origExecute = pool.execute.bind(pool);
    (pool as unknown as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute = async (
      sql: string,
      params?: unknown[],
    ) => {
      if (sql.includes("FROM bookings")) throw new Error("Simulated bookings DB failure");
      return origExecute(sql, params as never);
    };
    try {
      const errRes = await fetch(`${baseUrl}/staff/customers/${zeroBookingCustomerId}/bookings`, {
        headers: { Cookie: staffCookie },
      });
      assert.equal(errRes.status, 500);
    } finally {
      (pool as unknown as { execute: typeof origExecute }).execute = origExecute;
    }
  });

  it("14, 15, 16: New-customer verified entry, blocked unverified entry, and Enquiry regression", async () => {
    const newPhone = "07988 112233";

    // 15: Begin without verification -> 403
    const blockedBegin = await fetch(`${baseUrl}/staff/customers/new/begin`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newPhone }),
    });
    assert.equal(blockedBegin.status, 403);

    // Send & fail verification -> still blocked
    const sendNew = await fetch(`${baseUrl}/staff/customers/new/otp/send`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newPhone }),
    });
    const { simulatedCode } = (await sendNew.json()) as { simulatedCode: string };
    const badVerify = await fetch(`${baseUrl}/staff/customers/new/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newPhone, code: simulatedCode === "000000" ? "111111" : "000000" }),
    });
    assert.equal(badVerify.status, 400);
    assert.equal(
      (
        await fetch(`${baseUrl}/staff/customers/new/begin`, {
          method: "POST",
          headers: { Cookie: staffCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ phone: newPhone }),
        })
      ).status,
      403,
    );

    // 14: Correct verification unlocks Begin Account Creation
    const goodVerify = await fetch(`${baseUrl}/staff/customers/new/otp/verify`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newPhone, code: simulatedCode }),
    });
    assert.equal(goodVerify.status, 200);
    const allowedBegin = await fetch(`${baseUrl}/staff/customers/new/begin`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newPhone }),
    });
    assert.equal(allowedBegin.status, 200);
    assert.equal(((await allowedBegin.json()) as { allowed: boolean }).allowed, true);

    // 16: Existing Enquiry Management regression
    const enqRes = await fetch(`${baseUrl}/staff/enquiries`, { headers: { Cookie: staffCookie } });
    assert.equal(enqRes.status, 200);
    assert.ok(((await enqRes.json()) as { items: unknown[] }).items.length > 0);
  });
});
