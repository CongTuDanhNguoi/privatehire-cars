// Starts the API server (npm run dev / npm start).
import { createApp } from "./app.js";
import { config } from "./config.js";
import { pingDatabase, pool } from "./db.js";

const server = createApp().listen(config.port, async () => {
  console.log(`PrivateHire API listening on http://localhost:${config.port}`);
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
