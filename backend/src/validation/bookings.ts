// Request schema for saving a trip (POST /api/customer/bookings).
// The app saves a trip automatically once a vehicle is available — the customer then reviews the price and pays (SCRUM-72…90).
import { z } from "zod";

// Same titles as app/src/data/services.ts (what Staff Portal shows).
export const SERVICE_NAMES = [
  "Local Travel",
  "Long-Distance",
  "Airport Transfer",
  "Hotel Transfer",
  "Airport Meet & Greet",
  "Driver & Car Daily Hire",
] as const;

// App vehicle keys → label stored in bookings.vehicle_size, with the seat limit of each.
export const VEHICLES = {
  standard: { label: "Standard Car", maxPassengers: 4 },
  "seven-seater": { label: "Seven-Seater", maxPassengers: 6 },
} as const;

const place = z.string().trim().min(1).max(255);

export const CreateBookingBody = z
  .object({
    serviceName: z.enum(SERVICE_NAMES),
    pickupLocation: place,
    destination: place,
    journeyDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/), // YYYY-MM-DD
    journeyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // HH:mm (UK time)
    passengerCount: z.number().int().min(1),
    vehicleSize: z.enum(["standard", "seven-seater"]),
  })
  .refine((b) => b.passengerCount <= VEHICLES[b.vehicleSize].maxPassengers, { path: ["passengerCount"] });
export type CreateBookingBody = z.infer<typeof CreateBookingBody>;
