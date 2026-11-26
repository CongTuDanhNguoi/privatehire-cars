// /api/staff/vehicles/* (SCRUM-60)
import { Router } from "express";
import { AppError } from "../errors.js";
import { requireStaff } from "../middleware/requireStaff.js";
import { createVehicle, getVehicleById, listVehicles, updateVehicleStatus } from "../services/fleetService.js";
import { parseInput } from "../validation/auth.js";
import { parseId } from "../validation/enquiries.js";
import { CreateVehicleBody, UpdateResourceStatusBody } from "../validation/fleet.js";

export const staffVehiclesRouter = Router();
staffVehiclesRouter.use(requireStaff);

staffVehiclesRouter.get("/", async (_req, res) => {
  res.json({ vehicles: await listVehicles() });
});

staffVehiclesRouter.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("NOT_FOUND", "Vehicle record not found.");
  res.json({ vehicle: await getVehicleById(id) });
});

staffVehiclesRouter.post("/", async (req, res) => {
  const body = parseInput(CreateVehicleBody, req.body);
  res.status(201).json({ vehicle: await createVehicle(body) });
});

staffVehiclesRouter.patch("/:id/status", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("NOT_FOUND", "Vehicle record not found.");
  const { status } = parseInput(UpdateResourceStatusBody, req.body);
  res.json({ vehicle: await updateVehicleStatus(id, status) });
});
