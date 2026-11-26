// Non-destructive unit tests for SCRUM-106 Phase 1 (phone normalization, validation, and caller-verification store).
// Run with: npx tsx --test scripts/unit-scrum106.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_SEARCH_MESSAGES,
  normalizeSearchPhone,
  validateSearchPhone,
} from "../src/validation/customerSearch.js";
import { InMemoryCallerVerificationStore } from "../src/services/callerVerificationService.js";

describe("SCRUM-106 telephone normalization & validation", () => {
  it("normalizes UK +44, 0044, and domestic 0 formats identically", () => {
    assert.equal(normalizeSearchPhone("+44 7911 123456"), "07911123456");
    assert.equal(normalizeSearchPhone("0044 7911-123-456"), "07911123456");
    assert.equal(normalizeSearchPhone("07911 (123) 456"), "07911123456");
    assert.equal(normalizeSearchPhone("+44 (0) 7911 123456"), "07911123456");
  });

  it("rejects empty and malformed telephone inputs", () => {
    assert.equal(validateSearchPhone(""), CUSTOMER_SEARCH_MESSAGES.phoneRequired);
    assert.equal(validateSearchPhone("   "), CUSTOMER_SEARCH_MESSAGES.phoneRequired);
    assert.equal(validateSearchPhone("+44 7700 ABC89"), CUSTOMER_SEARCH_MESSAGES.phoneFormat);
    assert.equal(validateSearchPhone("12345"), CUSTOMER_SEARCH_MESSAGES.phoneFormat);
  });

  it("accepts valid UK and international numbers", () => {
    assert.equal(validateSearchPhone("+44 7911 123456"), "");
    assert.equal(validateSearchPhone("00447700900123"), "");
    assert.equal(validateSearchPhone("07911123456"), "");
  });
});

describe("SCRUM-106 caller verification store (access control)", () => {
  it("denies access by default and binds grants to customer and staff session", async () => {
    const store = new InMemoryCallerVerificationStore();
    const session1 = new Date("2026-11-25T10:00:00Z");
    const session2 = new Date("2026-11-25T11:00:00Z");

    assert.equal(await store.hasVerifiedCaller(1, 10, session1), false);

    await store.grantVerification(1, 10, session1);
    assert.equal(await store.hasVerifiedCaller(1, 10, session1), true);
    assert.equal(await store.hasVerifiedCaller(1, 11, session1), false);
    assert.equal(await store.hasVerifiedCaller(2, 10, session1), false);
    assert.equal(await store.hasVerifiedCaller(1, 10, session2), false);
  });

  it("invalidates previous customer when switching or clearing", async () => {
    const store = new InMemoryCallerVerificationStore();
    const session = new Date("2026-11-25T10:00:00Z");

    await store.grantVerification(1, 10, session);
    await store.grantVerification(1, 11, session);
    assert.equal(await store.hasVerifiedCaller(1, 10, session), false);
    assert.equal(await store.hasVerifiedCaller(1, 11, session), true);

    await store.clearVerification(1);
    assert.equal(await store.hasVerifiedCaller(1, 11, session), false);
  });
});
