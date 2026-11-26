// Live isolated MySQL + Express integration tests for SCRUM-109 Slice 1 (SCRUM-60, SCRUM-61, SCRUM-26).
// Safety guard: refuses to run unless DB_HOST=127.0.0.1, DB_PORT=3308, DB_NAME=privatehire_test.
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import mysql from "mysql2/promise";
import { pool } from "../src/db.js";
import { createApp } from "../src/app.js";

const BE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "3308" ||
  process.env.DB_NAME !== "privatehire_test"
) {
  throw new Error("SAFETY STOP: Refusing to run live-slice1 outside 127.0.0.1:3308/privatehire_test");
}

function runTsx(scriptRelPath: string, args: string[] = []) {
  const res = spawnSync(process.execPath, ["--import", "tsx", path.join(BE_ROOT, scriptRelPath), ...args], {
    cwd: BE_ROOT,
    env: process.env,
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`${scriptRelPath} failed:\n${res.stdout}\n${res.stderr}`);
}

let conn: mysql.Connection;
let server: import("node:http").Server;
let baseUrl = "";
let staffCookie = "";

describe("SCRUM-109 Slice 1 Live MySQL Integration (Vehicles, Drivers, Availability)", () => {
  before(async () => {
    conn = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3308,
      user: process.env.DB_USER || "phc_test",
      password: process.env.DB_PASSWORD || "",
      database: "privatehire_test",
      multipleStatements: true,
      timezone: "Z",
    });

    runTsx("scripts/db-init.ts");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("TRUNCATE TABLE bookings; TRUNCATE TABLE vehicles; TRUNCATE TABLE drivers; TRUNCATE TABLE customers; TRUNCATE TABLE staff;");
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    runTsx("scripts/seed.ts", ["--demo"]);

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as import("node:net").AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });

    const loginRes = await fetch(`${baseUrl}/staff/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gmail.com", password: "123456" }),
    });
    assert.equal(loginRes.status, 200);
    staffCookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await conn.end();
    await pool.end();
  });

  it("requires staff auth and rejects invalid vehicle/driver inputs", async () => {
    assert.equal((await fetch(`${baseUrl}/staff/vehicles`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/staff/drivers`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-01&journeyTime=14:00&passengerCount=2`)).status, 401);

    const badVeh = await fetch(`${baseUrl}/staff/vehicles`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: "", make: "Toyota", model: "Prius", colour: "Black", passengerCapacity: 0 }),
    });
    assert.equal(badVeh.status, 400);

    const badDrv = await fetch(`${baseUrl}/staff/drivers`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Sam", phone: "abc", email: "bad", licenceNumber: "" }),
    });
    assert.equal(badDrv.status, 400);
  });

  it("persists vehicles & drivers as INACTIVE, rejects case/space duplicates, and supports activation", async () => {
    const v1Res = await fetch(`${baseUrl}/staff/vehicles`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: "AB12 CDE", make: "Toyota", model: "Prius", colour: "Black", passengerCapacity: 4 }),
    });
    assert.equal(v1Res.status, 201);
    const { vehicle: v1 } = (await v1Res.json()) as { vehicle: { id: number; status: string } };
    assert.equal(v1.status, "INACTIVE");

    // Duplicate registration ignoring case & spaces -> 409
    const vDup = await fetch(`${baseUrl}/staff/vehicles`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: " ab12cde ", make: "Toyota", model: "Prius", colour: "Black", passengerCapacity: 4 }),
    });
    assert.equal(vDup.status, 409);

    // 8-seat minibus allowed
    const v2Res = await fetch(`${baseUrl}/staff/vehicles`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: "XY99 MPV", make: "Ford", model: "Tourneo", colour: "Silver", passengerCapacity: 8 }),
    });
    assert.equal(v2Res.status, 201);
    const { vehicle: v2 } = (await v2Res.json()) as { vehicle: { id: number } };

    const d1Res = await fetch(`${baseUrl}/staff/drivers`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Sam Reid", phone: "+44 7700 900111", email: "sam.reid@example.com", licenceNumber: "REID 901234" }),
    });
    assert.equal(d1Res.status, 201);
    const { driver: d1 } = (await d1Res.json()) as { driver: { id: number; status: string } };
    assert.equal(d1.status, "INACTIVE");

    // Duplicate licence ignoring case & spaces -> 409
    const dDup = await fetch(`${baseUrl}/staff/drivers`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Sam Two", phone: "07700 900222", email: "sam2@example.com", licenceNumber: "reid901234" }),
    });
    assert.equal(dDup.status, 409);

    // INACTIVE resources are unavailable in availability query
    const availBefore = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-01&journeyTime=14:00&passengerCount=3&vehicleSize=standard`, {
      headers: { Cookie: staffCookie },
    });
    assert.equal(availBefore.status, 200);
    const bBody = (await availBefore.json()) as {
      vehicles: { available: unknown[]; unavailable: Array<{ id: number; reason: string }> };
      drivers: { available: unknown[]; unavailable: Array<{ id: number; reason: string }> };
      staffQuotes: { standard: { totalPence: number; discountPence: number }; "seven-seater": { totalPence: number; discountPence: number } };
    };
    assert.equal(bBody.vehicles.available.length, 0);
    assert.equal(bBody.drivers.available.length, 0);
    assert.ok(bBody.vehicles.unavailable.every((v) => v.reason === "INACTIVE"));
    assert.equal(bBody.staffQuotes.standard.discountPence, 0);
    assert.equal(bBody.staffQuotes.standard.totalPence, 9500);
    assert.equal(bBody.staffQuotes["seven-seater"].totalPence, 13500);

    // Activate v1, v2, d1
    for (const pathUrl of [`/staff/vehicles/${v1.id}/status`, `/staff/vehicles/${v2.id}/status`, `/staff/drivers/${d1.id}/status`]) {
      const act = await fetch(`${baseUrl}${pathUrl}`, {
        method: "PATCH",
        headers: { Cookie: staffCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      assert.equal(act.status, 200);
    }

    // For seven-seater (5 passengers): v1 (4 seats) is INSUFFICIENT_CAPACITY, v2 (8 seats) is available
    const avail7 = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-01&journeyTime=14:00&passengerCount=5&vehicleSize=seven-seater`, {
      headers: { Cookie: staffCookie },
    });
    const a7Body = (await avail7.json()) as {
      vehicles: { available: Array<{ id: number }>; unavailable: Array<{ id: number; reason: string }> };
      drivers: { available: Array<{ id: number }> };
    };
    assert.deepEqual(a7Body.vehicles.available.map((v) => v.id), [v2.id]);
    assert.deepEqual(a7Body.vehicles.unavailable.map((v) => [v.id, v.reason]), [[v1.id, "INSUFFICIENT_CAPACITY"]]);
    assert.deepEqual(a7Body.drivers.available.map((d) => d.id), [d1.id]);

    // Insert a CONFIRMED booking at 2026-12-01 14:00 UTC assigned to v2 & d1
    const [custRows] = await conn.query<mysql.RowDataPacket[]>("SELECT id FROM customers LIMIT 1");
    await conn.execute(
      `INSERT INTO bookings (booking_ref, customer_id, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size, journey_status, assigned_vehicle_id, assigned_driver_id)
       VALUES ('PHC-99001', ?, 'Airport Transfer', 'A', 'B', '2026-12-01 14:00:00', 5, 'Seven-Seater', 'CONFIRMED', ?, ?)`,
      [custRows[0].id, v2.id, d1.id],
    );

    // 14:30 overlaps 14:00-15:00 -> BOOKED_OVERLAP
    const overlapRes = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-01&journeyTime=14:30&passengerCount=5&vehicleSize=seven-seater`, {
      headers: { Cookie: staffCookie },
    });
    const ovBody = (await overlapRes.json()) as {
      vehicles: { unavailable: Array<{ id: number; reason: string }> };
      drivers: { unavailable: Array<{ id: number; reason: string }> };
    };
    assert.ok(ovBody.vehicles.unavailable.some((v) => v.id === v2.id && v.reason === "BOOKED_OVERLAP"));
    assert.ok(ovBody.drivers.unavailable.some((d) => d.id === d1.id && d.reason === "BOOKED_OVERLAP"));

    // 15:00 exact boundary -> NOT overlapping -> available again
    const freeRes = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-01&journeyTime=15:00&passengerCount=5&vehicleSize=seven-seater`, {
      headers: { Cookie: staffCookie },
    });
    const freeBody = (await freeRes.json()) as {
      vehicles: { available: Array<{ id: number }> };
      drivers: { available: Array<{ id: number }> };
    };
    assert.ok(freeBody.vehicles.available.some((v) => v.id === v2.id));
    assert.ok(freeBody.drivers.available.some((d) => d.id === d1.id));

    // CANCELLED booking does NOT block availability in 14:00-15:00 window
    await conn.execute(
      `INSERT INTO bookings (booking_ref, customer_id, service_name, pickup_location, destination, journey_datetime, passenger_count, vehicle_size, journey_status, assigned_vehicle_id, assigned_driver_id)
       VALUES ('PHC-99002', ?, 'Local Travel', 'A', 'B', '2026-12-02 10:00:00', 2, 'Standard Car', 'CANCELLED', ?, ?)`,
      [custRows[0].id, v1.id, d1.id],
    );
    const cancelledWindow = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-02&journeyTime=10:30&passengerCount=2&vehicleSize=standard`, {
      headers: { Cookie: staffCookie },
    });
    const cwBody = (await cancelledWindow.json()) as {
      vehicles: { available: Array<{ id: number }> };
      drivers: { available: Array<{ id: number }> };
    };
    assert.ok(cwBody.vehicles.available.some((v) => v.id === v1.id));
    assert.ok(cwBody.drivers.available.some((d) => d.id === d1.id));

    // Europe/London BST (summer UTC+1) vs GMT (winter UTC+0) conversion
    const bstRes = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-07-15&journeyTime=14:00&passengerCount=2&vehicleSize=standard`, {
      headers: { Cookie: staffCookie },
    });
    const bstBody = (await bstRes.json()) as { journeyStartUtc: string; journeyEndUtc: string };
    assert.equal(bstBody.journeyStartUtc, "2026-07-15T13:00:00.000Z");
    assert.equal(bstBody.journeyEndUtc, "2026-07-15T14:00:00.000Z");

    const gmtRes = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-01&journeyTime=14:00&passengerCount=2&vehicleSize=standard`, {
      headers: { Cookie: staffCookie },
    });
    const gmtBody = (await gmtRes.json()) as { journeyStartUtc: string; journeyEndUtc: string };
    assert.equal(gmtBody.journeyStartUtc, "2026-12-01T14:00:00.000Z");
    assert.equal(gmtBody.journeyEndUtc, "2026-12-01T15:00:00.000Z");

    // ACTIVE -> INACTIVE deactivation makes resources unavailable again
    assert.equal(
      (
        await fetch(`${baseUrl}/staff/vehicles/${v1.id}/status`, {
          method: "PATCH",
          headers: { Cookie: staffCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "INACTIVE" }),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/staff/drivers/${d1.id}/status`, {
          method: "PATCH",
          headers: { Cookie: staffCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "INACTIVE" }),
        })
      ).status,
      200,
    );
    const afterDeact = await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-02&journeyTime=10:30&passengerCount=2&vehicleSize=standard`, {
      headers: { Cookie: staffCookie },
    });
    const adBody = (await afterDeact.json()) as {
      vehicles: { unavailable: Array<{ id: number; reason: string }> };
      drivers: { unavailable: Array<{ id: number; reason: string }> };
    };
    assert.ok(adBody.vehicles.unavailable.some((v) => v.id === v1.id && v.reason === "INACTIVE"));
    assert.ok(adBody.drivers.unavailable.some((d) => d.id === d1.id && d.reason === "INACTIVE"));

    // Invalid status payload -> 400
    assert.equal(
      (
        await fetch(`${baseUrl}/staff/vehicles/${v1.id}/status`, {
          method: "PATCH",
          headers: { Cookie: staffCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      ).status,
      400,
    );
  });

  it("preserves existing customer checkout & SCRUM-25 search regressions, and rejects customer cookies on staff fleet routes", async () => {
    const custLogin = await fetch(`${baseUrl}/customer/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alex.morgan@example.com", password: "Password123" }),
    });
    assert.equal(custLogin.status, 200);
    const custCookie = (custLogin.headers.get("set-cookie") ?? "").split(";")[0];

    // Customer cookie cannot access staff fleet/availability endpoints
    assert.equal((await fetch(`${baseUrl}/staff/vehicles`, { headers: { Cookie: custCookie } })).status, 401);
    assert.equal((await fetch(`${baseUrl}/staff/drivers`, { headers: { Cookie: custCookie } })).status, 401);
    assert.equal(
      (await fetch(`${baseUrl}/staff/availability?journeyDate=2026-12-01&journeyTime=14:00&passengerCount=2`, { headers: { Cookie: custCookie } })).status,
      401,
    );

    const checkoutRes = await fetch(`${baseUrl}/customer/bookings/PHC-24051`, {
      headers: { Cookie: custCookie },
    });
    assert.equal(checkoutRes.status, 200);
    const checkoutBody = (await checkoutRes.json()) as { booking: { fare: { discountPence: number; totalPence: number } } };
    assert.equal(checkoutBody.booking.fare.discountPence, 2025);
    assert.equal(checkoutBody.booking.fare.totalPence, 11475);

    const searchRes = await fetch(`${baseUrl}/staff/customers/search?phone=07911123456`, {
      headers: { Cookie: staffCookie },
    });
    assert.equal(searchRes.status, 200);
  });
});
