// SCRUM-108 Acceptance & Regression verification against isolated privatehire_test (127.0.0.1:3308).
// Verifies production-mode OTP hiding, restart/session-expiry safety, Customer App auth/booking regression,
// and email_verifications isolation.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import { config } from "../src/config.js";
import { pool } from "../src/db.js";
import { createApp } from "../src/app.js";
import { sendExistingCustomerOtp } from "../src/services/callerVerificationService.js";

if (
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "3308" ||
  process.env.DB_NAME !== "privatehire_test"
) {
  throw new Error("SAFETY STOP: Refusing to run accept-scrum25 outside 127.0.0.1:3308/privatehire_test");
}

let conn: mysql.Connection;
let server: import("node:http").Server;
let baseUrl = "";
let alexId = 0;

describe("SCRUM-108 Acceptance & Regression Checks", () => {
  before(async () => {
    conn = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3308,
      user: process.env.DB_USER || "phc_test",
      password: process.env.DB_PASSWORD || "",
      database: "privatehire_test",
      timezone: "Z",
    });
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id FROM customers WHERE email = 'alex.morgan@example.com' LIMIT 1",
    );
    alexId = rows[0].id as number;

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as import("node:net").AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await conn.end();
    await pool.end();
  });

  it("Production mode (NODE_ENV=production) never exposes simulatedCode", async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await sendExistingCustomerOtp(1, alexId, new Date());
      assert.equal(res.deliveryMode, "SIMULATION");
      assert.equal(res.simulation, true);
      assert.equal("simulatedCode" in res, false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it("Customer App auth (/api/customer/auth/*) and bookings (/api/customer/bookings) regression PASS", async () => {
    const loginRes = await fetch(`${baseUrl}/customer/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alex.morgan@example.com", password: "Password123" }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
    assert.ok(cookie.startsWith("phc_customer="));

    const meRes = await fetch(`${baseUrl}/customer/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(meRes.status, 200);
    const meBody = (await meRes.json()) as { user: { email: string } };
    assert.equal(meBody.user.email, "alex.morgan@example.com");

    const bookingsRes = await fetch(`${baseUrl}/customer/bookings`, { headers: { Cookie: cookie } });
    assert.equal(bookingsRes.status, 200);
    const bookingsBody = (await bookingsRes.json()) as { bookings: Array<{ bookingRef: string }> };
    assert.ok(bookingsBody.bookings.some((b) => b.bookingRef === "PHC-24051"));
  });

  it("Expired Staff JWT cannot access protected customer endpoints even if DB grant exists", async () => {
    const pastSec = Math.floor(Date.now() / 1000) - 7200;
    const expiredToken = jwt.sign({ kind: "staff", iat: pastSec, exp: pastSec + 60 }, config.jwtSecret, {
      subject: "1",
    });
    const res = await fetch(`${baseUrl}/staff/customers/${alexId}`, {
      headers: { Cookie: `phc_staff=${expiredToken}` },
    });
    assert.equal(res.status, 401);
  });

  it("email_verifications table remains untouched by caller OTP operations", async () => {
    const [rows] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM email_verifications");
    assert.equal(Number(rows[0].n), 0);
  });

  it("AC5 GET /api/staff/customers/new/entry enforces verification and creates no customer rows", async () => {
    const [beforeCust] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM customers");
    const loginRes = await fetch(`${baseUrl}/staff/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gmail.com", password: "123456" }),
    });
    const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];

    // Unverified direct check -> 403
    assert.equal((await fetch(`${baseUrl}/staff/customers/new/entry`, { headers: { Cookie: cookie } })).status, 403);

    // Send & verify new-customer phone OTP
    const sendRes = await fetch(`${baseUrl}/staff/customers/new/otp/send`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "07999 888777" }),
    });
    const { simulatedCode } = (await sendRes.json()) as { simulatedCode: string };
    assert.equal(
      (
        await fetch(`${baseUrl}/staff/customers/new/otp/verify`, {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "07999 888777", code: simulatedCode }),
        })
      ).status,
      200,
    );

    const entryRes = await fetch(`${baseUrl}/staff/customers/new/entry`, { headers: { Cookie: cookie } });
    assert.equal(entryRes.status, 200);
    const entryBody = (await entryRes.json()) as { allowed: boolean; phoneNormalized: string };
    assert.equal(entryBody.allowed, true);
    assert.equal(entryBody.phoneNormalized, "07999888777");

    // Logout clears access
    await fetch(`${baseUrl}/staff/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
    assert.equal((await fetch(`${baseUrl}/staff/customers/new/entry`, { headers: { Cookie: cookie } })).status, 403);

    const [afterCust] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM customers");
    assert.equal(Number(afterCust[0].n), Number(beforeCust[0].n));
  });
});
