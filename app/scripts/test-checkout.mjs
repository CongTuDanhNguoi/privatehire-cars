// End-to-end check of the checkout and enquiry screens (SCRUM-72…95).
// Needs the app and backend running. Run: npm run dev (app) + backend, then:
//   BASE_URL=http://localhost:5173 node scripts/test-checkout.mjs
// Uses the demo account alex.morgan@example.com (Password123). Creates one saved trip and one payment in the DB it talks to.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = path.resolve(process.env.OUT_DIR ?? "selftest-checkout");
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(err.message));

const results = [];
const wait = (ms = 300) => page.waitForTimeout(ms);
const pathname = () => new URL(page.url()).pathname;
async function test(id, title, fn) {
  try {
    const detail = await fn();
    results.push({ id, title, ok: true, detail });
    console.log(`PASS  ${id}  ${title}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    results.push({ id, title, ok: false, detail: err.message });
    console.log(`FAIL  ${id}  ${title} — ${err.message}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// 1. Log in through the form.
await test("CK-01", "Login → Home", async () => {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "alex.morgan@example.com");
  await page.fill("#password", "Password123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 10000 });
  return pathname();
});

// 2. Seed a saved trip through the same API the Availability screen uses (state lives in the DB).
let ref = "";
await test("CK-02", "Save a Seven-Seater trip", async () => {
  const r = await page.request.post(`${BASE}/api/customer/bookings`, {
    data: {
      serviceName: "Airport Transfer",
      pickupLocation: "Manchester Piccadilly Station, M1 2PB",
      destination: "Manchester Airport Terminal 2, M90 4FP",
      journeyDate: "2027-09-15",
      journeyTime: "14:30",
      passengerCount: 3,
      vehicleSize: "seven-seater",
    },
  });
  expect(r.status() === 201 || r.status() === 200, `status ${r.status()}`);
  ref = (await r.json()).booking.bookingRef;
  expect(/^PHC-\d{5}$/.test(ref), `ref ${ref}`);
  return ref;
});

// 3. Price Review: £135 − 15 % = £114.75, Continue disabled until the fare is agreed.
await test("CK-03", "Price review shows £114.75 and gates Continue", async () => {
  await page.goto(`${BASE}/checkout/${ref}/price`);
  await page.waitForSelector("[data-testid=fare-total]", { timeout: 10000 });
  expect((await page.textContent("[data-testid=fare-total]")) === "£114.75", "fare total is not £114.75");
  expect(await page.isDisabled("[data-testid=continue-to-payment]"), "Continue is enabled before agreeing");
  await page.check("[data-testid=agree-fare]");
  expect(!(await page.isDisabled("[data-testid=continue-to-payment]")), "Continue still disabled after agreeing");
  await page.click("[data-testid=continue-to-payment]");
  await page.waitForURL(`**/checkout/${ref}/notify`);
  return "£114.75";
});

// 4. Notification: wrong phone shows the drawn error; a correct one pays.
await test("CK-04", "Notification: invalid phone blocked, valid phone pays", async () => {
  await page.click("[data-testid=notify-next]");
  await page.waitForSelector("#notifyPhone");
  await page.fill("#notifyPhone", "+44 7700 ABC89");
  await page.locator("#notifyPhone").blur();
  const error = await page.textContent("#notifyPhone-error");
  expect(error?.includes("Check telephone number format (e.g. +44 7...)."), `error text: ${error}`);
  expect(await page.isDisabled("[data-testid=notify-pay]"), "Next enabled with an invalid phone");

  await page.fill("#notifyPhone", "+44 7700 900123");
  await page.locator("#notifyPhone").blur();
  await page.click("[data-testid=notify-pay]");
  await page.waitForURL(`**/checkout/${ref}/success`, { timeout: 10000 });
  return "paid";
});

// 5. Payment Successful, then the receipt shows the same total.
await test("CK-05", "Success page shows TXN ref; receipt total matches", async () => {
  await page.waitForSelector("[data-testid=payment-ref]");
  const txn = await page.textContent("[data-testid=payment-ref]");
  expect(/^TXN-\d{5}$/.test(txn ?? ""), `txn ${txn}`);
  await page.click("[data-testid=view-receipt]");
  await page.waitForSelector("[data-testid=receipt-total]", { timeout: 10000 });
  expect((await page.textContent("[data-testid=receipt-total]"))?.includes("£114.75"), "receipt total differs");
  return txn;
});

// 6. A paid booking can't be priced again (redirects to success); an unknown ref says so.
await test("CK-06", "Paid booking redirects; unknown ref shows not found", async () => {
  await page.goto(`${BASE}/checkout/${ref}/price`);
  await page.waitForURL(`**/checkout/${ref}/success`, { timeout: 10000 });
  await page.goto(`${BASE}/checkout/PHC-00000/price`);
  await page.waitForSelector("[data-testid=price-review-error]", { timeout: 10000 });
  expect((await page.textContent("[data-testid=price-review-error]"))?.includes("Booking not found."), "no not-found message");
  return "ok";
});

// 7. Enquiry: an empty General form shows the drawn errors; a full one returns an ENQ code.
await test("CK-07", "General enquiry: errors, then submitted", async () => {
  await page.goto(`${BASE}/support`);
  await page.waitForSelector("input[name=type][value=GENERAL]");
  await page.check("input[name=type][value=GENERAL]");
  await page.click("text=Continue to enquiry form");
  await page.waitForSelector("#category");
  await page.fill("#message", "");
  await page.click("text=Submit enquiry");
  const banner = await page.textContent("[role=alert]");
  expect(banner?.includes("SUBMISSION BLOCKED"), "no blocked banner");
  expect(banner?.includes("Please select an enquiry category"), "category error missing");

  await page.selectOption("#category", "General Information / Pricing Inquiry");
  await page.fill("#message", "I would like to inquire about executive Mercedes V-Class availability for a conference next month.");
  await page.click("text=Submit enquiry");
  await page.waitForSelector("[data-testid=enquiry-code]", { timeout: 10000 });
  const code = await page.textContent("[data-testid=enquiry-code]");
  expect(/^ENQ-\d{6}$/.test(code ?? ""), `code ${code}`);
  return code;
});

await browser.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS${pageErrors.length ? `  (page errors: ${pageErrors.length})` : ""}`);
if (pageErrors.length) console.log(pageErrors.slice(0, 5).join("\n"));
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, pageErrors }, null, 2));
process.exit(passed === results.length ? 0 : 1);
