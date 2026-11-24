// npm run smoke
// End-to-end API smoke test (plan Phase 2–3 criteria). It:
//   1. resets the database (npm run db:reset)  ⚠️ wipes all data
//   2. starts its own API server on port 4100 with EMAIL_PROVIDER=MOCK (restarting it to switch MOCK_EMAIL_FAIL)
//   3. checks auth, customer enquiries, staff inbox/detail/status, sending, duplicate protection and retry.
// MySQL must be running and backend/.env must have the right DB_* values. Does not touch a server on port 4000.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const BE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4100;
const BASE = `http://localhost:${PORT}/api`;

let passed = 0;
let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? `  →  ${detail}` : ""}`);
  }
}

// ---------- server control ----------
let server = null;
async function startServer(mockFail) {
  await stopServer();
  server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: BE_ROOT,
    env: { ...process.env, PORT: String(PORT), EMAIL_PROVIDER: "MOCK", MOCK_EMAIL_FAIL: mockFail },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("API server did not start");
}
async function stopServer() {
  if (!server) return;
  const s = server;
  server = null;
  await new Promise((resolve) => {
    s.once("exit", resolve);
    s.kill();
  });
}

// ---------- tiny HTTP client with a cookie per "browser" ----------
function client() {
  const jar = new Map();
  return async function call(method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (v) jar.set(k, v);
      else jar.delete(k);
    }
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };
}

// ---------- run ----------
console.log("Resetting database...");
const reset = spawnSync(process.execPath, ["--import", "tsx", "scripts/db-reset.ts", "--demo"], { cwd: BE_ROOT, encoding: "utf8" });
if (reset.status !== 0) {
  console.error(reset.stdout, reset.stderr);
  process.exit(1);
}

try {
  await startServer("never");

  // ===== Customer =====
  const alex = client();
  const emily = client();
  let r = await alex("POST", "/customer/auth/login", { email: "alex.morgan@example.com", password: "Password123" });
  check("customer login (Alex)", r.status === 200);
  await emily("POST", "/customer/auth/login", { email: "emily.clarke@example.com", password: "Password123" });

  r = await alex("GET", "/customer/bookings");
  const alexRefs = r.json.bookings.map((b) => b.bookingRef).sort().join(",");
  check("customer sees only own bookings", alexRefs === "PHC-24051,PHC-24052", alexRefs);
  const alexBooking = r.json.bookings.find((b) => b.bookingRef === "PHC-24051");
  const emilyBooking = (await emily("GET", "/customer/bookings")).json.bookings[0];

  // Trip saved automatically from the Availability screen (UK time → stored as UTC).
  const trip = { serviceName: "Hotel Transfer", pickupLocation: "The Lowry Hotel, M3 5LH", destination: "Manchester Airport Terminal 2, M90 4FF", journeyDate: "2027-07-10", journeyTime: "09:00", passengerCount: 3, vehicleSize: "standard" };
  r = await alex("POST", "/customer/bookings", trip);
  check(
    "save trip → 201 PHC-ref, BST 09:00 stored as 08:00Z, Standard Car",
    r.status === 201 && /^PHC-\d{5}$/.test(r.json.booking.bookingRef) && r.json.booking.journeyDateTime === "2027-07-10T08:00:00.000Z" && r.json.booking.vehicleSize === "Standard Car",
    JSON.stringify(r.json),
  );
  const savedTripId = r.json.booking?.id;
  r = await alex("POST", "/customer/bookings", trip);
  check("save same trip again → 200, no duplicate", r.status === 200 && r.json.booking.id === savedTripId, JSON.stringify(r.json));
  r = await alex("POST", "/customer/bookings", { ...trip, journeyDate: "2027-12-01", journeyTime: "14:30" });
  check("GMT 14:30 stored as 14:30Z", r.status === 201 && r.json.booking.journeyDateTime === "2027-12-01T14:30:00.000Z", JSON.stringify(r.json));
  r = await alex("POST", "/customer/bookings", { ...trip, passengerCount: 5 });
  check("save trip: 5 passengers in Standard Car → 400", r.status === 400 && r.json.error.fields?.passengerCount, JSON.stringify(r.json));
  r = await alex("POST", "/customer/bookings", { ...trip, journeyDate: "2027-02-30" });
  check("save trip: impossible date → 400", r.status === 400 && r.json.error.fields?.journeyDate, JSON.stringify(r.json));
  r = await client()("POST", "/customer/bookings", trip);
  check("save trip without cookie → 401", r.status === 401);
  r = await emily("GET", "/customer/bookings");
  check("saved trip not visible to another customer", !r.json.bookings.some((b) => b.id === savedTripId));

  r = await alex("POST", "/customer/enquiries", { type: "TRIP", bookingId: emilyBooking.id, subject: "Someone else's trip", message: "This booking belongs to another customer, it must be rejected." });
  check("TRIP enquiry with another customer's booking → 400", r.status === 400 && r.json.error.fields?.bookingId === "Choose the trip this enquiry is about.", JSON.stringify(r.json));

  r = await alex("POST", "/customer/enquiries", {});
  check(
    "empty enquiry → 400 with type/subject/message errors",
    r.status === 400 && r.json.error.fields.type === "Choose an enquiry type." && r.json.error.fields.subject === "Subject is required." && r.json.error.fields.message === "Message is required.",
    JSON.stringify(r.json),
  );

  r = await alex("POST", "/customer/enquiries", { type: "TRIP", bookingId: null, subject: "Hi", message: "too short" });
  check(
    "TRIP without trip + short subject/message → 400",
    r.status === 400 && r.json.error.fields.bookingId && r.json.error.fields.subject === "Subject must be between 5 and 120 characters." && r.json.error.fields.message === "Please describe your enquiry in at least 20 characters.",
    JSON.stringify(r.json),
  );

  r = await alex("POST", "/customer/enquiries", { type: "TRIP", bookingId: alexBooking.id, subject: "Flight number for pickup", message: "My flight number is BA1234, please let the driver know so he can track it." });
  check("create TRIP enquiry → 201 ENQ-000008 AWAITING", r.status === 201 && r.json.enquiry.code === "ENQ-000008" && r.json.enquiry.status === "AWAITING", JSON.stringify(r.json));
  const tripId = r.json.enquiry.id;

  r = await alex("POST", "/customer/enquiries", { type: "GENERAL", bookingId: alexBooking.id, subject: "Pet friendly rides", message: "Can I bring my small dog in a carrier on a Local Travel ride?" });
  check("create GENERAL enquiry → 201", r.status === 201);
  const generalId = r.json.enquiry.id;

  r = await alex("GET", "/customer/enquiries");
  const alexCodes = r.json.enquiries.map((e) => e.code);
  check("customer lists only own enquiries (Alex: 5)", r.status === 200 && alexCodes.length === 5 && alexCodes[0] === "ENQ-000009", alexCodes.join(","));

  r = await client()("GET", "/customer/enquiries");
  check("customer enquiries without cookie → 401", r.status === 401);

  // ===== Staff =====
  const staff = client();
  r = await staff("POST", "/staff/auth/login", { email: "admin@gmail.com", password: "123456" });
  check("staff login (Admin)", r.status === 200);

  r = await alex("GET", "/staff/enquiries");
  check("customer cookie on staff API → 401", r.status === 401);

  r = await staff("GET", "/staff/email-settings");
  check("email-settings reports MOCK", r.status === 200 && r.json.provider === "MOCK", JSON.stringify(r.json));

  r = await staff("GET", "/staff/enquiries");
  check(
    "list all → 9 items, counts awaiting 7 / resolved 2 / general 5 / trip 4",
    r.json.total === 9 && r.json.items.length === 9 && r.json.counts.awaiting === 7 && r.json.counts.resolved === 2 && r.json.counts.general === 5 && r.json.counts.trip === 4,
    JSON.stringify({ total: r.json.total, counts: r.json.counts }),
  );
  check("newest first: ENQ-000009 on top", r.json.items[0].code === "ENQ-000009");
  const failedItem = r.json.items.find((i) => i.code === "ENQ-000001");
  check("summary shows replies + last FAILED", failedItem.responseCount === 1 && failedItem.lastResponseStatus === "FAILED", JSON.stringify(failedItem));
  const tripItem = r.json.items.find((i) => i.id === tripId);
  check("summary has customer + bookingRef", tripItem.customer.fullName === "Alex Morgan" && tripItem.bookingRef === "PHC-24051");

  r = await staff("GET", "/staff/enquiries?type=TRIP");
  check("filter type=TRIP → 4", r.json.total === 4 && r.json.items.every((i) => i.type === "TRIP"));
  r = await staff("GET", "/staff/enquiries?status=AWAITING&type=GENERAL");
  check("filter AWAITING + GENERAL → 3", r.json.total === 3 && r.json.counts.trip === 4, JSON.stringify({ total: r.json.total, counts: r.json.counts }));
  r = await staff("GET", "/staff/enquiries?q=child%20seat");
  check('search "child seat" → 1', r.json.total === 1 && r.json.items[0].subject === "Do you provide child seats?");
  r = await staff("GET", "/staff/enquiries?q=ENQ-000004");
  check('search "ENQ-000004" → that enquiry', r.json.total === 1 && r.json.items[0].code === "ENQ-000004");
  r = await staff("GET", "/staff/enquiries?q=emily.clarke");
  check('search customer email "emily.clarke" → 2', r.json.total === 2);
  r = await staff("GET", "/staff/enquiries?q=100%25");
  check('search "100%" treats % literally → 0', r.json.total === 0);
  r = await staff("GET", "/staff/enquiries?pageSize=4&page=3");
  check("pagination pageSize=4 page=3 → 1 item, total 9", r.json.items.length === 1 && r.json.total === 9 && r.json.page === 3);
  r = await staff("GET", "/staff/enquiries?sort=oldest&pageSize=1");
  check("sort=oldest → ENQ-000001 first", r.json.items[0].code === "ENQ-000001");
  r = await staff("GET", "/staff/enquiries?type=OTHER");
  check("invalid filter → 400", r.status === 400);
  r = await staff("GET", "/staff/enquiries?pageSize=51");
  check("pageSize > 50 → 400", r.status === 400);

  r = await staff("GET", `/staff/enquiries/${tripId}`);
  check(
    "detail TRIP: customer + message + booking PHC-24051",
    r.status === 200 && r.json.customer.email === "alex.morgan@example.com" && r.json.booking?.bookingRef === "PHC-24051" && r.json.enquiry.message.includes("BA1234"),
    JSON.stringify(r.json.booking),
  );
  r = await staff("GET", `/staff/enquiries/${generalId}`);
  check("detail GENERAL: booking is null (bookingId ignored)", r.json.booking === null);
  r = await staff("GET", "/staff/enquiries/9999");
  check("detail unknown id → 404", r.status === 404 && r.json.error.code === "NOT_FOUND");
  r = await staff("GET", "/staff/enquiries/abc");
  check("detail id 'abc' → 404", r.status === 404);

  // --- send response ---
  r = await staff("POST", `/staff/enquiries/${tripId}/responses`, { clientRequestId: randomUUID(), subject: " ", body: "" });
  check(
    "send empty reply → 400 Subject/Message required",
    r.status === 400 && r.json.error.fields.subject === "Subject is required." && r.json.error.fields.body === "Message is required.",
    JSON.stringify(r.json),
  );
  r = await staff("POST", `/staff/enquiries/${tripId}/responses`, { clientRequestId: "not-a-uuid", subject: "Re: test", body: "Hello there, thanks." });
  check("send with invalid clientRequestId → 400", r.status === 400);

  const reqId = randomUUID();
  const reply = { clientRequestId: reqId, subject: "Re: [ENQ-000008] Flight number for pickup", body: "Hi Alex,\n\nThanks — we have added BA1234 to your booking.\n\nPrivateHire Cars" };
  r = await staff("POST", `/staff/enquiries/${tripId}/responses`, reply);
  check(
    "send reply → 201 SENT, enquiry auto RESOLVED",
    r.status === 201 && r.json.response.sendStatus === "SENT" && r.json.response.attemptCount === 1 && r.json.enquiry.status === "RESOLVED",
    JSON.stringify(r.json),
  );
  const sentResponseId = r.json.response.id;

  r = await staff("POST", `/staff/enquiries/${tripId}/responses`, reply);
  check("same clientRequestId again → same record, not re-sent", r.status === 201 && r.json.response.id === sentResponseId && r.json.response.attemptCount === 1);

  r = await staff("GET", `/staff/enquiries/${tripId}`);
  check("history: exactly 1 response", r.json.responses.length === 1);
  check(
    "status history: AWAITING → RESOLVED AUTO_AFTER_RESPONSE",
    r.json.statusHistory.length === 1 && r.json.statusHistory[0].reason === "AUTO_AFTER_RESPONSE" && r.json.statusHistory[0].changedBy === null,
    JSON.stringify(r.json.statusHistory),
  );

  r = await staff("POST", `/staff/responses/${sentResponseId}/retry`);
  check("retry a SENT response → 409", r.status === 409 && r.json.error.code === "CONFLICT");

  // --- manual status ---
  r = await staff("PATCH", `/staff/enquiries/${tripId}/status`, { status: "AWAITING" });
  check("manual RESOLVED → AWAITING", r.status === 200 && r.json.enquiry.status === "AWAITING");
  r = await staff("PATCH", `/staff/enquiries/${tripId}/status`, { status: "AWAITING" });
  check("same status again → 200", r.status === 200);
  r = await staff("GET", `/staff/enquiries/${tripId}`);
  check(
    "manual change recorded once (MANUAL by Admin)",
    r.json.statusHistory.length === 2 && r.json.statusHistory[0].reason === "MANUAL" && r.json.statusHistory[0].changedBy?.fullName === "Admin",
    JSON.stringify(r.json.statusHistory),
  );
  r = await staff("PATCH", `/staff/enquiries/${tripId}/status`, { status: "CLOSED" });
  check("invalid status → 400", r.status === 400);

  // --- failure + retry (MOCK_EMAIL_FAIL=always, then never) ---
  await startServer("always");
  const staff2 = client();
  await staff2("POST", "/staff/auth/login", { email: "admin@gmail.com", password: "123456" });
  r = await staff2("POST", `/staff/enquiries/${generalId}/responses`, { clientRequestId: randomUUID(), subject: "Re: Pet friendly rides", body: "Yes, small pets in a carrier are welcome." });
  check(
    "MOCK_EMAIL_FAIL=always → 502 EMAIL_SEND_FAILED, response FAILED saved",
    r.status === 502 && r.json.error.code === "EMAIL_SEND_FAILED" && r.json.response?.sendStatus === "FAILED" && !!r.json.response.errorMessage,
    JSON.stringify(r.json),
  );
  const failedId = r.json.response.id;
  r = await staff2("GET", `/staff/enquiries/${generalId}`);
  check("enquiry stays AWAITING after failed send", r.json.enquiry.status === "AWAITING" && r.json.statusHistory.length === 0);
  r = await staff2("POST", `/staff/responses/${failedId}/retry`);
  check("retry while still failing → 502, attempt 2", r.status === 502 && r.json.response.attemptCount === 2);

  await startServer("never");
  const staff3 = client();
  await staff3("POST", "/staff/auth/login", { email: "admin@gmail.com", password: "123456" });
  r = await staff3("POST", `/staff/responses/${failedId}/retry`);
  check(
    "MOCK_EMAIL_FAIL=never → retry 200 SENT, same record, enquiry RESOLVED",
    r.status === 200 && r.json.response.id === failedId && r.json.response.sendStatus === "SENT" && r.json.response.attemptCount === 3 && r.json.enquiry.status === "RESOLVED",
    JSON.stringify(r.json),
  );
  r = await staff3("GET", `/staff/enquiries/${generalId}`);
  check("still 1 response record after retries", r.json.responses.length === 1);

  r = await staff3("GET", "/staff/enquiries?q=ENQ-000001");
  const seedFailed = (await staff3("GET", `/staff/enquiries/${r.json.items[0].id}`)).json.responses[0];
  r = await staff3("POST", `/staff/responses/${seedFailed.id}/retry`);
  check("retry seeded FAILED response (ENQ-000001) → SENT", r.status === 200 && r.json.response.sendStatus === "SENT");

  // ===== Email verification (P0-18) =====
  const form = (email) => ({
    fullName: "Olivia Test", email, homeAddress: "1 Test Street", phone: "07911 123456",
    cardholderName: "Olivia Test", cardNumber: "4242 4242 4242 4242", expiry: "12/30", cvv: "123",
    password: "Password123", confirmPassword: "Password123",
  });
  const otpEmail = "otp.user@example.com";
  const newbie = client();
  const devCode = async (email) => (await newbie("GET", `/dev/last-verification-code?email=${encodeURIComponent(email)}`)).json?.code;
  r = await newbie("POST", "/customer/auth/register", form(otpEmail));
  check(
    "register → 201 + verification code emailed (no session)",
    r.status === 201 && r.json.verification?.emailSent === true && r.json.verification.resendInSeconds === 60,
    JSON.stringify(r.json),
  );
  const code1 = await devCode(otpEmail);
  check("mock code is 6 digits", /^\d{6}$/.test(code1 ?? ""), String(code1));
  r = await newbie("POST", "/customer/auth/login", { email: otpEmail, password: "Password123" });
  check("login before verifying → 403 EMAIL_NOT_VERIFIED", r.status === 403 && r.json.error.code === "EMAIL_NOT_VERIFIED", JSON.stringify(r.json));
  r = await newbie("POST", "/customer/auth/login", { email: otpEmail, password: "Wrong1234" });
  check("unverified + wrong password → 401 (no hint)", r.status === 401 && r.json.error.code === "INVALID_CREDENTIALS");
  r = await newbie("POST", "/customer/auth/resend-code", { email: otpEmail });
  check("resend within 60 s → 429 with retryAfterSeconds", r.status === 429 && r.json.error.retryAfterSeconds > 0, JSON.stringify(r.json));
  r = await newbie("POST", "/customer/auth/verify-email", { email: otpEmail, code: "12a" });
  check("verify bad format → 400", r.status === 400 && r.json.error.fields?.code === "The code must be 6 digits.", JSON.stringify(r.json));
  const wrong = String((Number(code1) + 1) % 1_000_000).padStart(6, "0");
  r = await newbie("POST", "/customer/auth/verify-email", { email: otpEmail, code: wrong });
  check("verify wrong code → 400, 4 attempts left", r.status === 400 && r.json.error.fields?.code === "The code is incorrect. 4 attempts left.", JSON.stringify(r.json));
  r = await newbie("POST", "/customer/auth/verify-email", { email: otpEmail, code: code1.slice(0, 3) + " " + code1.slice(3) });
  check("verify right code (with a space) → 200", r.status === 200 && r.json.verified === true && r.json.user.email === otpEmail, JSON.stringify(r.json));
  check("code removed after use", (await devCode(otpEmail)) === undefined);
  r = await newbie("POST", "/customer/auth/login", { email: otpEmail, password: "Password123" });
  check("login after verifying → 200", r.status === 200 && r.json.user.email === otpEmail);
  r = await newbie("POST", "/customer/auth/resend-code", { email: otpEmail });
  check("resend for verified email → generic 200", r.status === 200);
  r = await newbie("POST", "/customer/auth/resend-code", { email: "nobody@example.com" });
  check("resend for unknown email → same generic 200", r.status === 200 && r.json.verification.sentTo === "nobody@example.com");

  const lockedEmail = "otp.locked@example.com";
  await newbie("POST", "/customer/auth/register", form(lockedEmail));
  const code2 = await devCode(lockedEmail);
  const wrong2 = String((Number(code2) + 1) % 1_000_000).padStart(6, "0");
  for (let i = 0; i < 5; i++) r = await newbie("POST", "/customer/auth/verify-email", { email: lockedEmail, code: wrong2 });
  check("5th wrong code → too many attempts", r.status === 400 && r.json.error.fields?.code === "Too many incorrect attempts. Request a new code.", JSON.stringify(r.json));
  r = await newbie("POST", "/customer/auth/verify-email", { email: lockedEmail, code: code2 });
  check("right code after 5 wrong → still blocked", r.status === 400 && r.json.error.fields?.code === "Too many incorrect attempts. Request a new code.");

  // ===== Forgot password (SCRUM-65) — Daniel (seeded, not used by later checks) =====
  const fp = client();
  const danielEmail = "daniel.brooks@example.com";
  const resetCode = async (email) => (await fp("GET", `/dev/last-reset-code?email=${encodeURIComponent(email)}`)).json?.code;
  for (let i = 0; i < 5; i++) await fp("POST", "/customer/auth/login", { email: danielEmail, password: "Wrong1234" });
  r = await fp("POST", "/customer/auth/login", { email: danielEmail, password: "Password123" });
  check("reset: Daniel locked out before reset", r.status === 423, JSON.stringify(r.json));

  r = await fp("POST", "/customer/auth/forgot-password", { email: "" });
  check("forgot-password: empty email → 400 required", r.status === 400 && r.json.error.fields?.email === "Email address is required.", JSON.stringify(r.json));
  r = await fp("POST", "/customer/auth/forgot-password", { email: "nobody.here@example.com" });
  check(
    "forgot-password: unregistered email → 400 not registered",
    r.status === 400 && r.json.error.fields?.email === "This email address is not registered. Please check it or sign up.",
    JSON.stringify(r.json),
  );
  r = await fp("POST", "/customer/auth/forgot-password", { email: danielEmail });
  check("forgot-password: registered email → 200", r.status === 200 && r.json.reset.expiresInMinutes === 10 && r.json.reset.resendInSeconds === 60, JSON.stringify(r.json));
  const code4 = await resetCode(danielEmail);
  check("forgot-password: 4-digit code issued", /^\d{4}$/.test(code4 ?? ""), String(code4));
  r = await fp("POST", "/customer/auth/forgot-password", { email: danielEmail });
  check("forgot-password: resend within 60 s → 429", r.status === 429 && r.json.error.retryAfterSeconds > 0, JSON.stringify(r.json));

  r = await fp("POST", "/customer/auth/verify-reset-code", { email: danielEmail, code: "12" });
  check("verify-reset-code: 2 digits → format error", r.status === 400 && r.json.error.fields?.code === "The code must be 4 digits.", JSON.stringify(r.json));
  const wrong4 = code4 === "0000" ? "1111" : "0000";
  r = await fp("POST", "/customer/auth/verify-reset-code", { email: danielEmail, code: wrong4 });
  check("verify-reset-code: wrong code → 4 attempts left", r.status === 400 && r.json.error.fields?.code === "The code is incorrect. 4 attempts left.", JSON.stringify(r.json));
  r = await fp("POST", "/customer/auth/verify-reset-code", { email: "nobody.here@example.com", code: "1234" });
  check("verify-reset-code: unknown email → expired (no hint)", r.status === 400 && r.json.error.fields?.code === "This code has expired. Request a new code.");
  r = await fp("POST", "/customer/auth/verify-reset-code", { email: danielEmail, code: code4 });
  check("verify-reset-code: right code → reset token", r.status === 200 && /^[0-9a-f]{64}$/.test(r.json.resetToken ?? ""), JSON.stringify(r.json));
  const token = r.json.resetToken;
  r = await fp("POST", "/customer/auth/verify-reset-code", { email: danielEmail, code: code4 });
  check("verify-reset-code: code cannot be used twice", r.status === 400 && r.json.error.fields?.code === "This code has expired. Request a new code.");

  r = await fp("POST", "/customer/auth/reset-password", { email: danielEmail, resetToken: token, password: "short", confirmPassword: "other" });
  check(
    "reset-password: weak + mismatch → registration rule messages",
    r.status === 400 && r.json.error.fields?.password === "Password must be at least 8 characters." && r.json.error.fields?.confirmPassword === "Passwords do not match.",
    JSON.stringify(r.json),
  );
  r = await fp("POST", "/customer/auth/reset-password", { email: danielEmail, resetToken: "f".repeat(64), password: "NewPass2026", confirmPassword: "NewPass2026" });
  check("reset-password: wrong token → session expired", r.status === 400 && r.json.error.fields?.resetToken === "Your reset session has expired. Please request a new code.", JSON.stringify(r.json));
  r = await fp("POST", "/customer/auth/reset-password", { email: danielEmail, resetToken: token, password: "NewPass2026", confirmPassword: "NewPass2026" });
  check("reset-password: valid → 200", r.status === 200 && r.json.ok === true, JSON.stringify(r.json));
  r = await fp("POST", "/customer/auth/reset-password", { email: danielEmail, resetToken: token, password: "Another2026", confirmPassword: "Another2026" });
  check("reset-password: token is one-time", r.status === 400 && r.json.error.fields?.resetToken);

  r = await fp("POST", "/customer/auth/login", { email: danielEmail, password: "Password123" });
  check("after reset: old password rejected", r.status === 401);
  r = await fp("POST", "/customer/auth/login", { email: danielEmail, password: "NewPass2026" });
  check("after reset: new password logs in (lockout cleared)", r.status === 200 && r.json.user?.email === danielEmail, JSON.stringify(r.json));
} catch (err) {
  failed++;
  console.error("Smoke test crashed:", err);
} finally {
  await stopServer();
}

console.log(`\n${passed}/${passed + failed} PASS`);
console.log("Note: the database now contains test data — run `npm run db:reset` (empty) or `npm run db:reset -- --demo` (mock data) afterwards.");
process.exit(failed ? 1 : 0);
