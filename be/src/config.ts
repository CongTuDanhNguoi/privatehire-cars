// Reads and validates environment variables (be/.env). The server refuses to start on invalid config.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const BE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(BE_ROOT, ".env"), quiet: true });

const PLACEHOLDER_SECRET = "change-me-to-a-long-random-string";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DB_HOST: z.string().min(1).default("localhost"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/, "may only contain letters, digits and underscores").default("privatehire"),
  JWT_SECRET: z
    .string()
    .min(32, "must be at least 32 characters")
    .refine((v) => v !== PLACEHOLDER_SECRET, "still has the example value — set a long random string"),
  SESSION_HOURS: z.coerce.number().positive().max(24 * 30).default(8),
});

function loadConfig() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    // Never print values: some of them are secrets.
    console.error(`Invalid configuration in be/.env:\n${problems}`);
    process.exit(1);
  }
  const env = parsed.data;
  return {
    port: env.PORT,
    db: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    },
    jwtSecret: env.JWT_SECRET,
    sessionHours: env.SESSION_HOURS,
  } as const;
}

export const config = loadConfig();
