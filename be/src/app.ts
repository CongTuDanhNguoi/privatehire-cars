// Builds the Express app: middleware, routes, error handling.
import cookieParser from "cookie-parser";
import express from "express";
import { pingDatabase } from "./db.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { customerAuthRouter } from "./routes/customerAuth.js";
import { staffAuthRouter } from "./routes/staffAuth.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_req, res) => {
    const dbUp = await pingDatabase();
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "error", database: dbUp ? "up" : "down" });
  });

  app.use("/api/customer/auth", customerAuthRouter);
  app.use("/api/staff/auth", staffAuthRouter);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);
  return app;
}
