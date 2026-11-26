// Live isolated MySQL + Express integration test for SCRUM-106 (DB-106-1 through DB-106-8).
// Safety guard: refuses to run unless DB_HOST=127.0.0.1, DB_PORT=3308, DB_NAME=privatehire_test.
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import mysql from "mysql2/promise";

const BE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assertIsolatedTestEnv() {
  if (
    process.env.DB_HOST !== "127.0.0.1" ||
    process.env.DB_PORT !== "3308" ||
    process.env.DB_NAME !== "privatehire_test"
  ) {
    throw new Error(
      `SAFETY STOP: Refusing to run live DB tests outside isolated 127.0.0.1:3308/privatehire_test (got ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`,
    );
  }
}

assertIsolatedTestEnv();

async function openTestConn() {
  return mysql.createConnection({
    host: "127.0.0.1",
    port: 3308,
    user: process.env.DB_USER || "phc_test",
    password: process.env.DB_PASSWORD || "",
    database: "privatehire_test",
    multipleStatements: true,
    timezone: "Z",
  });
}

function runTsx(scriptRelPath: string, args: string[] = []) {
  const res = spawnSync(
    process.execPath,
    ["--import", "tsx", path.join(BE_ROOT, scriptRelPath), ...args],
    {
      cwd: BE_ROOT,
      env: process.env,
      encoding: "utf8",
    },
  );
  if (res.status !== 0) {
    throw new Error(`${scriptRelPath} failed (${res.status}):\n${res.stdout}\n${res.stderr}`);
  }
  return res.stdout;
}

describe("SCRUM-106 Live Isolated MySQL & API Integration", () => {
  it("DB-106-2 & DB-106-3: additive phone_normalized migration, backfill, and idempotency", async () => {
    const conn = await openTestConn();
    try {
      // Establish a valid pre-upgrade schema (without phone_normalized / idx_customers_phone_norm)
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      await conn.query("DROP TABLE IF EXISTS caller_verifications, login_attempts, enquiry_status_history, enquiry_responses, enquiries, bookings, password_resets, email_verifications, customers, staff");
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");

      await conn.query(`
        CREATE TABLE staff (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          full_name VARCHAR(100) NOT NULL,
          email VARCHAR(254) NOT NULL UNIQUE,
          password_hash VARCHAR(100) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        CREATE TABLE customers (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          full_name VARCHAR(100) NOT NULL,
          email VARCHAR(254) NOT NULL UNIQUE,
          phone VARCHAR(30) NULL,
          home_address VARCHAR(255) NULL,
          card_last4 CHAR(4) NULL,
          password_hash VARCHAR(100) NOT NULL,
          email_verified_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(
        `INSERT INTO customers (full_name, email, phone, password_hash, email_verified_at) VALUES
         ('Fictional One', 'f1@test.invalid', '+44 7911 123456', 'hash1', UTC_TIMESTAMP()),
         ('Fictional Two', 'f2@test.invalid', '0044 7700-900123', 'hash2', UTC_TIMESTAMP()),
         ('Fictional Three', 'f3@test.invalid', '07700 (900) 123', 'hash3', UTC_TIMESTAMP()),
         ('Fictional Null', 'f4@test.invalid', NULL, 'hash4', UTC_TIMESTAMP())`,
      );

      // Run db-init.ts -> should apply upgradeCustomerPhoneNormalized()
      const out1 = runTsx("scripts/db-init.ts");
      assert.match(out1, /Upgraded: customers\.phone_normalized added and backfilled\./);

      const [rows1] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT email, phone_normalized FROM customers ORDER BY id ASC",
      );
      assert.deepEqual(
        rows1.map((r) => [r.email, r.phone_normalized]),
        [
          ["f1@test.invalid", "07911123456"],
          ["f2@test.invalid", "07700900123"],
          ["f3@test.invalid", "07700900123"],
          ["f4@test.invalid", null],
        ],
      );

      // DB-106-3: Idempotency re-run
      const out2 = runTsx("scripts/db-init.ts");
      assert.match(out2, /keeping existing data/);
      assert.doesNotMatch(out2, /Upgraded: customers\.phone_normalized/);
    } finally {
      await conn.end();
    }
  });

  it("DB-106-1: fresh db:init on empty privatehire_test creates schema & seeds demo data", async () => {
    const conn = await openTestConn();
    try {
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      await conn.query("DROP TABLE IF EXISTS caller_verifications, login_attempts, enquiry_status_history, enquiry_responses, enquiries, bookings, password_resets, email_verifications, customers, staff");
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");

      const out = runTsx("scripts/db-init.ts");
      assert.match(out, /created/);

      // db-init already seeded the Admin staff row; clear staff before running seed.ts --demo on privatehire_test
      await conn.query("DELETE FROM staff");
      runTsx("scripts/seed.ts", ["--demo"]);
      await conn.query(
        `INSERT INTO customers (full_name, email, phone, phone_normalized, home_address, card_last4, password_hash, email_verified_at)
         VALUES ('Emily Duplicate', 'emily.dup@example.com', '07700 900123', '07700900123', '99 Test Rd', '9999', 'hash', UTC_TIMESTAMP())`,
      );

      const [cols] = await conn.query<mysql.RowDataPacket[]>(
        "SHOW COLUMNS FROM customers LIKE 'phone_normalized'",
      );
      assert.equal(cols.length, 1);
      const [idx] = await conn.query<mysql.RowDataPacket[]>(
        "SHOW INDEX FROM customers WHERE Key_name = 'idx_customers_phone_norm'",
      );
      assert.equal(idx.length, 1);
    } finally {
      await conn.end();
    }
  });

  it("DB-106-4 through DB-106-8: live Express + MySQL API integration & regressions", async () => {
    const { createApp } = await import("../src/app.js");
    const { pool } = await import("../src/db.js");
    const app = createApp();
    let server: import("node:http").Server;
    let baseUrl = "";

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as import("node:net").AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });

    try {
      // DB-106-6a: Unauthenticated -> 401
      const unauth = await fetch(`${baseUrl}/staff/customers/search?phone=07911123456`);
      assert.equal(unauth.status, 401);

      // DB-106-8a: Staff login
      const loginRes = await fetch(`${baseUrl}/staff/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@gmail.com", password: "123456" }),
      });
      assert.equal(loginRes.status, 200);
      const setCookie = loginRes.headers.get("set-cookie") ?? "";
      const cookie = setCookie.split(";")[0];
      assert.ok(cookie.startsWith("phc_staff="));

      // DB-106-6b: Invalid phone -> 400
      const badRes = await fetch(`${baseUrl}/staff/customers/search?phone=not-a-phone`, {
        headers: { Cookie: cookie },
      });
      assert.equal(badRes.status, 400);

      // DB-106-4: Equivalent UK formats match Alex Morgan in MySQL
      for (const q of ["+44 7911 123456", "0044 7911-123-456", "07911 (123) 456"]) {
        const res = await fetch(`${baseUrl}/staff/customers/search?phone=${encodeURIComponent(q)}`, {
          headers: { Cookie: cookie },
        });
        assert.equal(res.status, 200);
        const body = (await res.json()) as { customers: Array<Record<string, unknown>> };
        assert.equal(body.customers.length, 1);
        assert.equal(body.customers[0].fullName, "Alex Morgan");
        assert.equal("homeAddress" in body.customers[0], false);
        assert.equal("cardLast4" in body.customers[0], false);
        assert.equal("email" in body.customers[0], false);
      }

      // DB-106-5: Zero and multiple matches
      const zeroRes = await fetch(`${baseUrl}/staff/customers/search?phone=07999999999`, {
        headers: { Cookie: cookie },
      });
      assert.equal(zeroRes.status, 200);
      assert.equal(((await zeroRes.json()) as { customers: unknown[] }).customers.length, 0);

      const multiRes = await fetch(`${baseUrl}/staff/customers/search?phone=${encodeURIComponent("+44 7700 900123")}`, {
        headers: { Cookie: cookie },
      });
      assert.equal(multiRes.status, 200);
      const multiBody = (await multiRes.json()) as { customers: Array<{ id: number; fullName: string }> };
      assert.equal(multiBody.customers.length, 2);

      // DB-106-7: Protected profile & booking-history -> 403
      const targetId = multiBody.customers[0].id;
      const profRes = await fetch(`${baseUrl}/staff/customers/${targetId}`, { headers: { Cookie: cookie } });
      assert.equal(profRes.status, 403);
      const bookRes = await fetch(`${baseUrl}/staff/customers/${targetId}/bookings`, { headers: { Cookie: cookie } });
      assert.equal(bookRes.status, 403);

      // DB-106-8b: Existing Staff /me and Enquiry Management regression
      const meRes = await fetch(`${baseUrl}/staff/auth/me`, { headers: { Cookie: cookie } });
      assert.equal(meRes.status, 200);
      const enqRes = await fetch(`${baseUrl}/staff/enquiries`, { headers: { Cookie: cookie } });
      assert.equal(enqRes.status, 200);
      const enqBody = (await enqRes.json()) as { items: unknown[] };
      assert.ok(enqBody.items.length > 0);
    } finally {
      await new Promise<void>((resolve, reject) => server!.close((err) => (err ? reject(err) : resolve())));
      await pool.end();
    }
  });
});
