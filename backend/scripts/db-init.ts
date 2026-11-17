// npm run db:init
// Safe to run on every start (used by Docker): creates the database if missing, and applies the schema + seed
// ONLY when it has no tables yet. Existing data is never touched. Use `npm run db:reset` to start over.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { BE_ROOT, connect, dbName } from "./connect.js";
import { seedDatabase } from "./seed.js";

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
  } else {
    const schema = await readFile(path.join(BE_ROOT, "sql", "001_schema.sql"), "utf8");
    await conn.query(schema);
    await conn.beginTransaction();
    await seedDatabase(conn);
    await conn.commit();
    console.log(`Database "${name}" created and seeded with demo data.`);
  }
} catch (err) {
  console.error("db:init failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await conn.end();
}
