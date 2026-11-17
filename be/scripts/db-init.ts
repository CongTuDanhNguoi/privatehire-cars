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

try {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.changeUser({ database: name });
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?",
    [name],
  );
  if (Number(rows[0].n) > 0) {
    console.log(`Database "${name}" already has ${rows[0].n} tables — keeping existing data.`);
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
