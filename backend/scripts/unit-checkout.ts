// Kiểm tra nhanh các hàm dùng chung cho luồng thanh toán (giá + số điện thoại nhận thông báo).
// Chạy: npx tsx scripts/unit-checkout.ts
import assert from "node:assert/strict";
import { formatGbp, quoteFare } from "../../app/src/data/pricing";
import { normalizePhone, validateNotifyPhone } from "../../app/src/validation/checkoutValidation";

const PHONE_FORMAT = "Check telephone number format (e.g. +44 7...).";

assert.deepEqual(quoteFare("Seven-Seater"), { basePence: 13500, discountPence: 2025, totalPence: 11475 });
assert.deepEqual(quoteFare("Standard Car"), { basePence: 9500, discountPence: 1425, totalPence: 8075 });
assert.equal(quoteFare("Bus"), null);
assert.equal(formatGbp(11475), "£114.75");

assert.equal(normalizePhone(" (+44) 7700-900-123 "), "+447700900123");
assert.equal(validateNotifyPhone(""), "Phone number is required.");
assert.equal(validateNotifyPhone("+44 7700 900123"), "");
assert.equal(validateNotifyPhone("07700 900123"), "");
assert.equal(validateNotifyPhone("(+44) 7700-900-123"), "");
assert.equal(validateNotifyPhone("+44 7700 ABC89"), PHONE_FORMAT);
assert.equal(validateNotifyPhone("12345"), PHONE_FORMAT);

console.log("unit-checkout: all PASS");
