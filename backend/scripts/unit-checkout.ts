// Kiểm tra nhanh các hàm dùng chung cho luồng thanh toán (giá + số điện thoại nhận thông báo).
// Chạy: npx tsx scripts/unit-checkout.ts
import assert from "node:assert/strict";
import { formatGbp, quoteFare } from "../../app/src/data/pricing";
import { normalizePhone, validateNotifyPhone } from "../../app/src/validation/checkoutValidation";
import { validateEnquiry, validateEnquiryContact } from "../../app/src/validation/enquiryValidation";

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

// Enquiry (SCRUM-95): contact errors use the drawn messages; a planned trip replaces the saved booking.
assert.deepEqual(validateEnquiryContact({ type: "TRIP", bookingId: null, subject: "", message: "", contactName: "", contactEmail: "x", category: "" }), {
  contactName: "Full name is required",
  contactEmail: "Please enter a valid email address (e.g. name@example.com)",
  category: "Please select an enquiry category",
});
const plannedTrip = { pickupLocation: "Manchester Piccadilly, M1 2PB", destination: "Manchester Airport T2, M90 4FP", journeyDate: "2027-07-10", journeyTime: "09:00", passengerCount: 3, vehicleSize: "Seven-Seater" };
assert.deepEqual(validateEnquiry({ type: "TRIP", bookingId: null, subject: "Route Planning & Waiting Time", message: "A message that is long enough.", tripSnapshot: plannedTrip }), {});
assert.ok(validateEnquiry({ type: "TRIP", bookingId: null, subject: "Route Planning", message: "A message that is long enough." }).bookingId);

console.log("unit-checkout: all PASS");
