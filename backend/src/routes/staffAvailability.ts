// /api/staff/availability (SCRUM-26)
import { Router } from "express";
import { requireStaff } from "../middleware/requireStaff.js";
import { checkAvailability } from "../services/availabilityService.js";
import { parseInput } from "../validation/auth.js";
import { AvailabilityQuery } from "../validation/fleet.js";

export const staffAvailabilityRouter = Router();
staffAvailabilityRouter.use(requireStaff);

staffAvailabilityRouter.get("/", async (req, res) => {
  const query = parseInput(AvailabilityQuery, req.query);
  res.json(await checkAvailability(query));
});
