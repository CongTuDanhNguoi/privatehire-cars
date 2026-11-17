// /api/staff/responses/:responseId/retry and /api/staff/email-settings
import { Router } from "express";
import { AppError } from "../errors.js";
import { emailSettings } from "../email/index.js";
import { requireStaff } from "../middleware/requireStaff.js";
import { retryResponse } from "../services/responseService.js";
import { parseId } from "../validation/enquiries.js";
import { replyWithOutcome } from "./staffEnquiries.js";

export const staffResponsesRouter = Router();
staffResponsesRouter.use(requireStaff);

staffResponsesRouter.post("/responses/:responseId/retry", async (req, res) => {
  const id = parseId(req.params.responseId);
  if (!id) throw new AppError("NOT_FOUND", "Response not found.");
  replyWithOutcome(res, await retryResponse(id), 200);
});

// Lets the portal show "Mock email service" / "Test mode" banners.
staffResponsesRouter.get("/email-settings", (_req, res) => {
  res.json(emailSettings);
});
