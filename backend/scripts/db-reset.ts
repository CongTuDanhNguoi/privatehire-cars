// npm run db:reset
// Drops and recreates the database, applies sql/001_schema.sql, seeds demo data, then prints row counts.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { BE_ROOT, connect, dbName } from "./connect.js";
import { seedDatabase } from "./seed.js";

const TABLES = ["staff", "customers", "bookings", "enquiries", "enquiry_responses", "enquiry_status_history", "login_attempts", "email_verifications"];

const name = dbName();
const conn = await connect().catch((err: unknown) => {
  console.error(
    "Cannot connect to MySQL:",
    err instanceof Error ? err.message : err,
    "\nCheck that MySQL is running and DB_HOST / DB_PORT / DB_USER / DB_PASSWORD in backend/.env are correct.",
  );
  process.exit(1);
});
try {
  console.log(`Resetting database "${name}"...`);
  await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await conn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.changeUser({ database: name });

  const schema = await readFile(path.join(BE_ROOT, "sql", "001_schema.sql"), "utf8");
  await conn.query(schema);
  console.log("Schema applied.");

  await conn.beginTransaction();
  await seedDatabase(conn);
  await conn.commit();
  console.log("Seed complete.\n");

  for (const table of TABLES) {
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${table}\``);
    console.log(`  ${table.padEnd(24)} ${rows[0].n}`);
  }
  const [failed] = await conn.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM enquiry_responses WHERE send_status = 'FAILED'",
  );
  console.log(`  ${"responses FAILED".padEnd(24)} ${failed[0].n}`);
} catch (err) {
  console.error("\ndb:reset failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await conn.end();
}
