// Non-destructive unit tests for SCRUM-107 caller OTP validation.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CALLER_OTP_LENGTH,
  CALLER_OTP_MAX_ATTEMPTS,
  CALLER_OTP_MESSAGES,
  CALLER_OTP_TTL_MINUTES,
  normalizeCallerOtp,
  validateCallerOtp,
} from "../src/validation/callerOtp.js";

describe("SCRUM-107 caller OTP policy & validation", () => {
  it("enforces approved OTP policy constants (6 digits, 5 min, 3 attempts)", () => {
    assert.equal(CALLER_OTP_LENGTH, 6);
    assert.equal(CALLER_OTP_TTL_MINUTES, 5);
    assert.equal(CALLER_OTP_MAX_ATTEMPTS, 3);
  });

  it("normalizes spaces/hyphens and validates 6 numeric digits", () => {
    assert.equal(normalizeCallerOtp("123 456"), "123456");
    assert.equal(normalizeCallerOtp("12-34-56"), "123456");
    assert.equal(validateCallerOtp("123 456"), "");
    assert.equal(validateCallerOtp(""), CALLER_OTP_MESSAGES.required);
    assert.equal(validateCallerOtp("12345"), CALLER_OTP_MESSAGES.format);
    assert.equal(validateCallerOtp("12ab56"), CALLER_OTP_MESSAGES.format);
  });
});
