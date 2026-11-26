// Shared validation and normalization for SCRUM-60 (Vehicles), SCRUM-61 (Drivers), and SCRUM-26 (Availability).
import { z } from "zod";
import { normalizeSearchPhone, validateSearchPhone } from "./customerSearch.js";
import { VEHICLES } from "./bookings.js";

export type ResourceStatus = "ACTIVE" | "INACTIVE";

export const normalizeRegistration = (value: string): string =>
  value.trim().replace(/\s+/g, "").toUpperCase();

export const normalizeLicenceNumber = (value: string): string =>
  value.trim().replace(/\s+/g, "").toUpperCase();

export const CreateVehicleBody = z.object({
  registrationNumber: z.string().trim().min(1, "Registration number is required.").max(20, "Registration number is too long."),
  make: z.string().trim().min(1, "Make is required.").max(60, "Make is too long."),
  model: z.string().trim().min(1, "Model is required.").max(60, "Model is too long."),
  colour: z.string().trim().min(1, "Colour is required.").max(40, "Colour is too long."),
  passengerCapacity: z.coerce
    .number()
    .int("Passenger capacity must be a positive whole number.")
    .min(1, "Passenger capacity must be at least 1.")
    .max(255, "Passenger capacity must be 255 or fewer."),
});
export type CreateVehicleBody = z.infer<typeof CreateVehicleBody>;

export const CreateDriverBody = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required.").max(100, "Full name is too long."),
    phone: z.string().trim().min(1, "Phone number is required.").max(30, "Phone number is too long."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email address is required.")
      .max(254, "Email address is too long.")
      .regex(/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/, "Enter a valid email address."),
    licenceNumber: z.string().trim().min(1, "Driver licence number is required.").max(40, "Driver licence number is too long."),
  })
  .superRefine((data, ctx) => {
    const phoneErr = validateSearchPhone(data.phone);
    if (phoneErr) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: phoneErr });
    }
  });
export type CreateDriverBody = z.infer<typeof CreateDriverBody>;

export const normalizeDriverPhone = normalizeSearchPhone;

export const UpdateResourceStatusBody = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const AvailabilityQuery = z
  .object({
    journeyDate: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Journey date must be YYYY-MM-DD."),
    journeyTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Journey time must be HH:mm (24-hour UK time)."),
    passengerCount: z.coerce
      .number()
      .int("Passenger count must be a positive whole number.")
      .min(1, "Passenger count must be at least 1."),
    vehicleSize: z.enum(["standard", "seven-seater"]).optional(),
  })
  .superRefine((q, ctx) => {
    if (new Date(`${q.journeyDate}T00:00:00Z`).toISOString().slice(0, 10) !== q.journeyDate) {
      ctx.addIssue({ code: "custom", path: ["journeyDate"], message: "Invalid calendar date." });
    }
    if (q.vehicleSize && q.passengerCount > VEHICLES[q.vehicleSize].maxPassengers) {
      ctx.addIssue({
        code: "custom",
        path: ["passengerCount"],
        message: `${VEHICLES[q.vehicleSize].label} allows up to ${VEHICLES[q.vehicleSize].maxPassengers} passengers.`,
      });
    }
  });
export type AvailabilityQuery = z.infer<typeof AvailabilityQuery>;
