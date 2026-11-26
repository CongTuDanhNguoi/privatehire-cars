// Non-destructive unit tests for SCRUM-109 Slice 1 (pricing, vehicle/driver/availability validation).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quoteFare } from "../../app/src/data/pricing.js";
import {
  AvailabilityQuery,
  CreateDriverBody,
  CreateVehicleBody,
  normalizeLicenceNumber,
  normalizeRegistration,
} from "../src/validation/fleet.js";

describe("Slice 1 pricing & validation", () => {
  it("keeps 15% online discount by default and removes discount for staff channels", () => {
    assert.deepEqual(quoteFare("Standard Car"), { basePence: 9500, discountPence: 1425, totalPence: 8075 });
    assert.deepEqual(quoteFare("Seven-Seater"), { basePence: 13500, discountPence: 2025, totalPence: 11475 });

    assert.deepEqual(quoteFare("Standard Car", { applyOnlineDiscount: false }), {
      basePence: 9500,
      discountPence: 0,
      totalPence: 9500,
    });
    assert.deepEqual(quoteFare("Seven-Seater", { applyOnlineDiscount: false }), {
      basePence: 13500,
      discountPence: 0,
      totalPence: 13500,
    });
  });

  it("validates vehicle fields and allows any positive whole integer capacity", () => {
    const ok = CreateVehicleBody.safeParse({
      registrationNumber: " ab12 cde ",
      make: "Ford",
      model: "Tourneo",
      colour: "Silver",
      passengerCapacity: 8,
    });
    assert.equal(ok.success, true);
    assert.equal(normalizeRegistration(" ab12 cde "), "AB12CDE");

    for (const badCap of [0, -2, 4.5]) {
      const bad = CreateVehicleBody.safeParse({
        registrationNumber: "AB12 CDE",
        make: "Ford",
        model: "Tourneo",
        colour: "Silver",
        passengerCapacity: badCap,
      });
      assert.equal(bad.success, false);
    }
  });

  it("validates driver fields and normalizes licence numbers", () => {
    const ok = CreateDriverBody.safeParse({
      fullName: "Sam Reid",
      phone: "+44 7700 900111",
      email: "SAM.REID@EXAMPLE.COM",
      licenceNumber: " reid 901234 ",
    });
    assert.equal(ok.success, true);
    assert.equal(normalizeLicenceNumber(" reid 901234 "), "REID901234");

    const bad = CreateDriverBody.safeParse({
      fullName: "Sam Reid",
      phone: "not-a-phone",
      email: "bad-email",
      licenceNumber: "",
    });
    assert.equal(bad.success, false);
  });

  it("validates availability query date, time, and passenger capacity", () => {
    assert.equal(
      AvailabilityQuery.safeParse({
        journeyDate: "2026-12-01",
        journeyTime: "14:30",
        passengerCount: 4,
        vehicleSize: "standard",
      }).success,
      true,
    );
    assert.equal(
      AvailabilityQuery.safeParse({
        journeyDate: "2026-02-30",
        journeyTime: "14:30",
        passengerCount: 2,
      }).success,
      false,
    );
    assert.equal(
      AvailabilityQuery.safeParse({
        journeyDate: "2026-12-01",
        journeyTime: "14:30",
        passengerCount: 5,
        vehicleSize: "standard",
      }).success,
      false,
    );
  });
});
