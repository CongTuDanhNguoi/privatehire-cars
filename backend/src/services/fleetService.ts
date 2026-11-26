// Fleet resource management: Vehicles (SCRUM-60) and Drivers (SCRUM-61).
// BD-01/01.1: New vehicles and drivers default to INACTIVE; authorized staff activate manually.
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db.js";
import { AppError } from "../errors.js";
import {
  normalizeDriverPhone,
  normalizeLicenceNumber,
  normalizeRegistration,
  type CreateDriverBody,
  type CreateVehicleBody,
  type ResourceStatus,
} from "../validation/fleet.js";

export interface VehicleRecord {
  id: number;
  registrationNumber: string;
  make: string;
  model: string;
  colour: string;
  passengerCapacity: number;
  status: ResourceStatus;
  createdAt: string;
}

export interface DriverRecord {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  licenceNumber: string;
  status: ResourceStatus;
  createdAt: string;
}

interface VehicleRow extends RowDataPacket {
  id: number;
  registration_number: string;
  make: string;
  model: string;
  colour: string;
  passenger_capacity: number;
  status: ResourceStatus;
  created_at: Date;
}

interface DriverRow extends RowDataPacket {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  licence_number: string;
  status: ResourceStatus;
  created_at: Date;
}

const toVehicle = (r: VehicleRow): VehicleRecord => ({
  id: r.id,
  registrationNumber: r.registration_number,
  make: r.make,
  model: r.model,
  colour: r.colour,
  passengerCapacity: r.passenger_capacity,
  status: r.status,
  createdAt: r.created_at.toISOString(),
});

const toDriver = (r: DriverRow): DriverRecord => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  email: r.email,
  licenceNumber: r.licence_number,
  status: r.status,
  createdAt: r.created_at.toISOString(),
});

export async function listVehicles(): Promise<VehicleRecord[]> {
  const [rows] = await pool.execute<VehicleRow[]>(
    `SELECT id, registration_number, make, model, colour, passenger_capacity, status, created_at
     FROM vehicles ORDER BY id DESC`,
  );
  return rows.map(toVehicle);
}

export async function getVehicleById(id: number): Promise<VehicleRecord> {
  const [rows] = await pool.execute<VehicleRow[]>(
    `SELECT id, registration_number, make, model, colour, passenger_capacity, status, created_at
     FROM vehicles WHERE id = ? LIMIT 1`,
    [id],
  );
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Vehicle record not found.");
  return toVehicle(rows[0]);
}

export async function createVehicle(input: CreateVehicleBody): Promise<VehicleRecord> {
  const regNorm = normalizeRegistration(input.registrationNumber);
  const dupError = () =>
    new AppError("CONFLICT", "A vehicle with this registration number already exists.", {
      fields: { registrationNumber: "This registration number is already recorded." },
    });

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO vehicles (registration_number, registration_normalized, make, model, colour, passenger_capacity, status)
       VALUES (?, ?, ?, ?, ?, ?, 'INACTIVE')`,
      [input.registrationNumber.trim(), regNorm, input.make.trim(), input.model.trim(), input.colour.trim(), input.passengerCapacity],
    );
    return await getVehicleById(res.insertId);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") throw dupError();
    throw err;
  }
}

export async function updateVehicleStatus(id: number, status: ResourceStatus): Promise<VehicleRecord> {
  const [res] = await pool.execute<ResultSetHeader>("UPDATE vehicles SET status = ? WHERE id = ?", [status, id]);
  if (res.affectedRows === 0) throw new AppError("NOT_FOUND", "Vehicle record not found.");
  return await getVehicleById(id);
}

export async function listDrivers(): Promise<DriverRecord[]> {
  const [rows] = await pool.execute<DriverRow[]>(
    `SELECT id, full_name, phone, email, licence_number, status, created_at
     FROM drivers ORDER BY id DESC`,
  );
  return rows.map(toDriver);
}

export async function getDriverById(id: number): Promise<DriverRecord> {
  const [rows] = await pool.execute<DriverRow[]>(
    `SELECT id, full_name, phone, email, licence_number, status, created_at
     FROM drivers WHERE id = ? LIMIT 1`,
    [id],
  );
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Driver record not found.");
  return toDriver(rows[0]);
}

export async function createDriver(input: CreateDriverBody): Promise<DriverRecord> {
  const licNorm = normalizeLicenceNumber(input.licenceNumber);
  const phoneNorm = normalizeDriverPhone(input.phone);
  const dupError = () =>
    new AppError("CONFLICT", "A driver with this licence number already exists.", {
      fields: { licenceNumber: "This driver licence number is already recorded." },
    });

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO drivers (full_name, phone, phone_normalized, email, licence_number, licence_normalized, status)
       VALUES (?, ?, ?, ?, ?, ?, 'INACTIVE')`,
      [input.fullName.trim(), input.phone.trim(), phoneNorm, input.email.trim().toLowerCase(), input.licenceNumber.trim(), licNorm],
    );
    return await getDriverById(res.insertId);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") throw dupError();
    throw err;
  }
}

export async function updateDriverStatus(id: number, status: ResourceStatus): Promise<DriverRecord> {
  const [res] = await pool.execute<ResultSetHeader>("UPDATE drivers SET status = ? WHERE id = ?", [status, id]);
  if (res.affectedRows === 0) throw new AppError("NOT_FOUND", "Driver record not found.");
  return await getDriverById(id);
}
