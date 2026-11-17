// Starts the API server (npm run dev / npm start).
import { createApp } from "./app.js";
import { config } from "./config.js";
import { pingDatabase, pool } from "./db.js";
import { emailSettings } from "./email/index.js";

const server = createApp().listen(config.port, async () => {
  console.log(`PrivateHire API listening on http://localhost:${config.port}`);
  const { provider, testMode, testRecipient } = emailSettings;
  console.log(
    provider === "MOCK"
      ? `Email: MOCK provider — responses are saved but NO real email is sent (MOCK_EMAIL_FAIL=${config.email.mockFail}).`
      : `Email: EmailJS (real email)${testMode ? ` — TEST MODE, every email goes to ${testRecipient}` : " — sending to real customer addresses"}.`,
  );
  if (!(await pingDatabase())) {
    console.warn(
      "WARNING: cannot reach MySQL. Check that it is running and DB_* in be/.env are correct (GET /api/health shows the status).",
    );
  }
});

function shutdown() {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
