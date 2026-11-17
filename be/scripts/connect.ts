// Shared MySQL connection helper for the database scripts (db-reset, seed).
// Reads be/.env, connects in UTC so DATETIME values are stored as UTC.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

export const BE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(BE_ROOT, ".env"), quiet: true });

export function dbName(): string {
  const name = process.env.DB_NAME || "privatehire";
  // The name is interpolated into CREATE/DROP DATABASE, so only allow a safe identifier.
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("DB_NAME may only contain letters, digits and underscores.");
  return name;
}

export async function connect(options: { database?: string } = {}): Promise<mysql.Connection> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "",
    database: options.database,
    multipleStatements: true,
    timezone: "Z",
    charset: "utf8mb4_unicode_ci",
  });
  await conn.query("SET time_zone = '+00:00'");
  return conn;
}

// Date -> 'YYYY-MM-DD HH:MM:SS' in UTC (MySQL DATETIME literal).
export function toSqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
