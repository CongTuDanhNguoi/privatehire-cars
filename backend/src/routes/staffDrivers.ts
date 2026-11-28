// /api/staff/drivers/* (SCRUM-61)
import { Router } from "express";
import { AppError } from "../errors.js";
import { requireStaff } from "../middleware/requireStaff.js";
import { createDriver, getDriverById, listDrivers, updateDriverStatus } from "../services/fleetService.js";
import { parseInput } from "../validation/auth.js";
import { parseId } from "../validation/enquiries.js";
import { CreateDriverBody, UpdateResourceStatusBody } from "../validation/fleet.js";

export const staffDriversRouter = Router();
staffDriversRouter.use(requireStaff);

staffDriversRouter.get("/", async (_req, res) => {
  res.json({ drivers: await listDrivers() });
});

staffDriversRouter.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("NOT_FOUND", "Driver record not found.");
  res.json({ driver: await getDriverById(id) });
});

staffDriversRouter.post("/", async (req, res) => {
  const body = parseInput(CreateDriverBody, req.body);
  res.status(201).json({ driver: await createDriver(body) });
});

staffDriversRouter.patch("/:id/status", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("NOT_FOUND", "Driver record not found.");
  const { status } = parseInput(UpdateResourceStatusBody, req.body);
  res.json({ driver: await updateDriverStatus(id, status) });
});
