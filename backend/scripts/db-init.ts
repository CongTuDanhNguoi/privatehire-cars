// npm run db:init
// Safe to run on every start (used by Docker): creates the database if missing, and applies the schema + seed
// ONLY when it has no tables yet. Existing data is never touched. Use `npm run db:reset` to start over.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { BE_ROOT, connect, dbName } from "./connect.js";
import { seedDatabase } from "./seed.js";
import { normalizeSearchPhone } from "../src/validation/customerSearch.js";

const name = dbName();

// MySQL may still be starting (Docker): retry the first connection for up to ~60 s.
async function connectWithRetry() {
  for (let attempt = 1; ; attempt++) {
    try {
      return await connect();
    } catch (err) {
      if (attempt >= 30) throw err;
      console.log(`Waiting for MySQL... (${attempt})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const conn = await connectWithRetry().catch((err: unknown) => {
  console.error("Cannot connect to MySQL:", err instanceof Error ? err.message : err);
  process.exit(1);
});

// P0-18 upgrade for databases created before email verification existed: adds the column + table.
// Accounts that already exist are marked verified, so nobody who could log in before is locked out.
async function upgradeEmailVerification() {
  const [cols] = await conn.query<RowDataPacket[]>(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = 'customers' AND column_name = 'email_verified_at'",
    [name],
  );
  if (cols.length > 0) return;
  await conn.query("ALTER TABLE customers ADD COLUMN email_verified_at DATETIME NULL");
  await conn.query("UPDATE customers SET email_verified_at = UTC_TIMESTAMP()");
  await conn.query(`CREATE TABLE IF NOT EXISTS email_verifications (
      customer_id  INT UNSIGNED PRIMARY KEY,
      code_hash    CHAR(64) NOT NULL,
      expires_at   DATETIME NOT NULL,
      attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
      last_sent_at DATETIME NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log("Upgraded: email verification (existing customers marked as verified).");
}

// SCRUM-106 additive upgrade: adds customers.phone_normalized + index and backfills existing rows.
async function upgradeCustomerPhoneNormalized() {
  const [cols] = await conn.query<RowDataPacket[]>(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = 'customers' AND column_name = 'phone_normalized'",
    [name],
  );
  if (cols.length > 0) return;
  await conn.query("ALTER TABLE customers ADD COLUMN phone_normalized VARCHAR(30) NULL AFTER phone");
  await conn.query("CREATE INDEX idx_customers_phone_norm ON customers (phone_normalized)");
  const [customers] = await conn.query<RowDataPacket[]>("SELECT id, phone FROM customers WHERE phone IS NOT NULL");
  for (const row of customers) {
    const norm = normalizeSearchPhone(String(row.phone));
    if (norm) {
      await conn.execute("UPDATE customers SET phone_normalized = ? WHERE id = ?", [norm, row.id]);
    }
  }
  console.log("Upgraded: customers.phone_normalized added and backfilled.");
}

// SCRUM-107 additive upgrade: creates caller_verifications table if missing.
async function upgradeCallerVerifications() {
  await conn.query(`CREATE TABLE IF NOT EXISTS caller_verifications (
      staff_id         INT UNSIGNED PRIMARY KEY,
      customer_id      INT UNSIGNED NULL,
      phone_normalized VARCHAR(30) NOT NULL,
      session_iat_ms   BIGINT UNSIGNED NOT NULL,
      code_hash        CHAR(64) NULL,
      expires_at       DATETIME NULL,
      attempts         TINYINT UNSIGNED NOT NULL DEFAULT 0,
      invalidated_at   DATETIME NULL,
      verified_at      DATETIME NULL,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id)    REFERENCES staff(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

// SCRUM-109 Slice 1 additive upgrade: creates vehicles, drivers, and booking assignment/journey_status columns.
async function upgradeFleetAndAvailability() {
  await conn.query(`CREATE TABLE IF NOT EXISTS vehicles (
      id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      registration_number     VARCHAR(20) NOT NULL,
      registration_normalized VARCHAR(20) NOT NULL UNIQUE,
      make                    VARCHAR(60) NOT NULL,
      model                   VARCHAR(60) NOT NULL,
      colour                  VARCHAR(40) NOT NULL,
      passenger_capacity      TINYINT UNSIGNED NOT NULL,
      status                  ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'INACTIVE',
      created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await conn.query(`CREATE TABLE IF NOT EXISTS drivers (
      id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      full_name          VARCHAR(100) NOT NULL,
      phone              VARCHAR(30)  NOT NULL,
      phone_normalized   VARCHAR(30)  NOT NULL,
      email              VARCHAR(254) NOT NULL,
      licence_number     VARCHAR(40)  NOT NULL,
      licence_normalized VARCHAR(40)  NOT NULL UNIQUE,
      status             ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'INACTIVE',
      created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const [cols] = await conn.query<RowDataPacket[]>(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = 'bookings' AND column_name = 'journey_status'",
    [name],
  );
  if (cols.length === 0) {
    await conn.query(`ALTER TABLE bookings
      ADD COLUMN journey_status ENUM('CONFIRMED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'CONFIRMED' AFTER status,
      ADD COLUMN assigned_vehicle_id INT UNSIGNED NULL AFTER journey_status,
      ADD COLUMN assigned_driver_id INT UNSIGNED NULL AFTER assigned_vehicle_id`);
  }
}

try {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.changeUser({ database: name });
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?",
    [name],
  );
  if (Number(rows[0].n) > 0) {
    console.log(`Database "${name}" already has ${rows[0].n} tables — keeping existing data.`);
    await upgradeEmailVerification();
    await upgradeCustomerPhoneNormalized();
    await upgradeCallerVerifications();
    await upgradeFleetAndAvailability();
  } else {
    const schema = await readFile(path.join(BE_ROOT, "sql", "001_schema.sql"), "utf8");
    await conn.query(schema);
    await conn.beginTransaction();
    await seedDatabase(conn);
    await conn.commit();
    console.log(`Database "${name}" created (Admin account only, no mock data).`);
  }
} catch (err) {
  console.error("db:init failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await conn.end();
}
