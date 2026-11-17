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

  EMAIL_PROVIDER: z.enum(["MOCK", "EMAILJS"]).default("MOCK"),
  EMAIL_TEST_MODE: z.enum(["true", "false"]).default("true"),
  EMAIL_TEST_RECIPIENT: z.string().trim().default(""),
  EMAIL_REPLY_TO: z.string().trim().default("support@privatehire.test"),
  EMAILJS_SERVICE_ID: z.string().trim().default(""),
  EMAILJS_TEMPLATE_ID: z.string().trim().default(""),
  EMAILJS_PUBLIC_KEY: z.string().trim().default(""),
  EMAILJS_PRIVATE_KEY: z.string().trim().default(""),
  MOCK_EMAIL_FAIL: z.enum(["never", "always", "next"]).default("never"),
});

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v);

function loadConfig() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    // Never print values: some of them are secrets.
    console.error(`Invalid configuration in be/.env:\n${problems}`);
    process.exit(1);
  }
  const env = parsed.data;

  // Email rules (plan §7.5 + decision P0-6).
  const emailProblems: string[] = [];
  if (env.EMAIL_PROVIDER === "EMAILJS") {
    for (const key of ["EMAILJS_SERVICE_ID", "EMAILJS_TEMPLATE_ID", "EMAILJS_PUBLIC_KEY", "EMAILJS_PRIVATE_KEY"] as const) {
      if (!env[key]) emailProblems.push(`  - ${key}: required when EMAIL_PROVIDER=EMAILJS`);
    }
    if (env.EMAIL_TEST_MODE === "true" && !looksLikeEmail(env.EMAIL_TEST_RECIPIENT)) {
      emailProblems.push("  - EMAIL_TEST_RECIPIENT: a valid email is required when EMAIL_TEST_MODE=true");
    }
  }
  if (env.EMAIL_TEST_RECIPIENT && !looksLikeEmail(env.EMAIL_TEST_RECIPIENT)) {
    emailProblems.push("  - EMAIL_TEST_RECIPIENT: not a valid email address");
  }
  if (!looksLikeEmail(env.EMAIL_REPLY_TO)) emailProblems.push("  - EMAIL_REPLY_TO: not a valid email address");
  if (emailProblems.length > 0) {
    console.error(`Invalid email configuration in be/.env:\n${emailProblems.join("\n")}`);
    process.exit(1);
  }
  // With the MOCK provider nothing is really sent, so test mode without a recipient simply has no effect (P0-6).
  const testMode = env.EMAIL_TEST_MODE === "true" && env.EMAIL_TEST_RECIPIENT !== "";

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
    email: {
      provider: env.EMAIL_PROVIDER,
      testMode,
      testRecipient: testMode ? env.EMAIL_TEST_RECIPIENT : null,
      replyTo: env.EMAIL_REPLY_TO,
      emailjs: {
        serviceId: env.EMAILJS_SERVICE_ID,
        templateId: env.EMAILJS_TEMPLATE_ID,
        publicKey: env.EMAILJS_PUBLIC_KEY,
        privateKey: env.EMAILJS_PRIVATE_KEY,
      },
      mockFail: env.MOCK_EMAIL_FAIL,
    },
  } as const;
}

export const config = loadConfig();
