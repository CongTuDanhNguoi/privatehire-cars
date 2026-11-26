// Shared vehicle & driver availability query (SCRUM-26, BD-02 60-min window, BD-03 UK->UTC, BD-04 staff pricing).
import type { RowDataPacket } from "mysql2/promise";
import { quoteFare, type FareQuote } from "../../../app/src/data/pricing";
import { pool } from "../db.js";
import { VEHICLES } from "../validation/bookings.js";
import type { AvailabilityQuery } from "../validation/fleet.js";
import { londonToUtc } from "./customerEnquiryService.js";
import { listDrivers, listVehicles, type DriverRecord, type VehicleRecord } from "./fleetService.js";

export const SIMULATED_JOURNEY_MINUTES = 60;

export type UnavailableReason = "INACTIVE" | "CATEGORY_MISMATCH" | "INSUFFICIENT_CAPACITY" | "BOOKED_OVERLAP";

export interface UnavailableVehicle extends VehicleRecord {
  reason: UnavailableReason;
  reasonDetail: string;
}

export interface UnavailableDriver extends DriverRecord {
  reason: UnavailableReason;
  reasonDetail: string;
}

export interface AvailabilityResult {
  journeyDate: string;
  journeyTime: string;
  journeyStartUtc: string;
  journeyEndUtc: string;
  durationMinutes: number;
  passengerCount: number;
  vehicleSize: "standard" | "seven-seater" | null;
  vehicles: {
    available: VehicleRecord[];
    unavailable: UnavailableVehicle[];
  };
  drivers: {
    available: DriverRecord[];
    unavailable: UnavailableDriver[];
  };
  staffQuotes: {
    standard: FareQuote;
    "seven-seater": FareQuote;
  };
}

interface OverlapRow extends RowDataPacket {
  assigned_vehicle_id: number | null;
  assigned_driver_id: number | null;
}

export async function checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
  const startUtc = londonToUtc(query.journeyDate, query.journeyTime);
  const endUtc = new Date(startUtc.getTime() + SIMULATED_JOURNEY_MINUTES * 60_000);

  const [allVehicles, allDrivers, [overlapRows]] = await Promise.all([
    listVehicles(),
    listDrivers(),
    pool.execute<OverlapRow[]>(
      `SELECT assigned_vehicle_id, assigned_driver_id
       FROM bookings
       WHERE journey_status <> 'CANCELLED'
         AND (assigned_vehicle_id IS NOT NULL OR assigned_driver_id IS NOT NULL)
         AND journey_datetime < ?
         AND DATE_ADD(journey_datetime, INTERVAL ? MINUTE) > ?`,
      [endUtc, SIMULATED_JOURNEY_MINUTES, startUtc],
    ),
  ]);

  const busyVehicleIds = new Set<number>();
  const busyDriverIds = new Set<number>();
  for (const row of overlapRows) {
    if (row.assigned_vehicle_id !== null) busyVehicleIds.add(row.assigned_vehicle_id);
    if (row.assigned_driver_id !== null) busyDriverIds.add(row.assigned_driver_id);
  }

  const availableVehicles: VehicleRecord[] = [];
  const unavailableVehicles: UnavailableVehicle[] = [];

  for (const v of allVehicles) {
    if (v.status !== "ACTIVE") {
      unavailableVehicles.push({ ...v, reason: "INACTIVE", reasonDetail: "Vehicle is inactive." });
    } else if (query.vehicleSize && v.vehicleCategory !== query.vehicleSize) {
      unavailableVehicles.push({
        ...v,
        reason: "CATEGORY_MISMATCH",
        reasonDetail: `Vehicle category is ${v.vehicleCategory}, requested ${query.vehicleSize}.`,
      });
    } else if (v.passengerCapacity < query.passengerCount) {
      unavailableVehicles.push({
        ...v,
        reason: "INSUFFICIENT_CAPACITY",
        reasonDetail: `Capacity (${v.passengerCapacity}) is below requested ${query.passengerCount} passengers.`,
      });
    } else if (busyVehicleIds.has(v.id)) {
      unavailableVehicles.push({
        ...v,
        reason: "BOOKED_OVERLAP",
        reasonDetail: "Vehicle is already booked in this 60-minute window.",
      });
    } else {
      availableVehicles.push(v);
    }
  }

  const availableDrivers: DriverRecord[] = [];
  const unavailableDrivers: UnavailableDriver[] = [];

  for (const d of allDrivers) {
    if (d.status !== "ACTIVE") {
      unavailableDrivers.push({ ...d, reason: "INACTIVE", reasonDetail: "Driver is inactive." });
    } else if (busyDriverIds.has(d.id)) {
      unavailableDrivers.push({
        ...d,
        reason: "BOOKED_OVERLAP",
        reasonDetail: "Driver is already assigned in this 60-minute window.",
      });
    } else {
      availableDrivers.push(d);
    }
  }

  // BD-04: Staff-assisted bookings do NOT receive the 15% online-only discount.
  const standardQuote = quoteFare(VEHICLES.standard.label, { applyOnlineDiscount: false })!;
  const sevenSeaterQuote = quoteFare(VEHICLES["seven-seater"].label, { applyOnlineDiscount: false })!;

  return {
    journeyDate: query.journeyDate,
    journeyTime: query.journeyTime,
    journeyStartUtc: startUtc.toISOString(),
    journeyEndUtc: endUtc.toISOString(),
    durationMinutes: SIMULATED_JOURNEY_MINUTES,
    passengerCount: query.passengerCount,
    vehicleSize: query.vehicleSize ?? null,
    vehicles: {
      available: availableVehicles,
      unavailable: unavailableVehicles,
    },
    drivers: {
      available: availableDrivers,
      unavailable: unavailableDrivers,
    },
    staffQuotes: {
      standard: standardQuote,
      "seven-seater": sevenSeaterQuote,
    },
  };
}
