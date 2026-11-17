// MySQL connection pool. Every connection runs in UTC so DATETIME columns are stored and read as UTC.
import mysql from "mysql2/promise";
import { config } from "./config.js";

export const pool = mysql.createPool({
  ...config.db,
  connectionLimit: 10,
  timezone: "Z",
  charset: "utf8mb4_unicode_ci",
  // DATETIME columns come back as JS Date objects (interpreted as UTC because of `timezone: "Z"`).
  dateStrings: false,
});

pool.pool.on("connection", (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
