// Playwright acceptance walkthrough & screenshot capture for SCRUM-108 (Vi & Hieu UI review).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WEB_URL = process.env.WEB_URL || "http://localhost:5174";
const SCREENS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/test-reports/2026-11-25/screens",
);
mkdirSync(SCREENS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(`${WEB_URL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(/Email/i).fill("admin@gmail.com");
  await page.getByRole("textbox", { name: "Password" }).fill("123456");
  await page.getByRole("button", { name: /Log in|Sign in/i }).click();
  await page.waitForURL(/\/enquiries/);

  await page.getByRole("link", { name: /Customer Lookup/i }).click();
  await page.waitForURL(/\/customers/);

  // 1. Search matching accounts (+44 7700 900123 -> 2 matches)
  await page.getByLabel(/Caller telephone number/i).fill("+44 7700 900123");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByText(/Matching Customer Accounts/).waitFor();
  await page.screenshot({ path: path.join(SCREENS_DIR, "01-search-matching.png"), fullPage: true });

  // 2. Existing customer Alex Morgan -> Send Simulated OTP
  await page.getByLabel(/Caller telephone number/i).fill("07911 123456");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByRole("button", { name: /Select customer/i }).first().click();
  await page.getByRole("button", { name: /Send Simulated OTP/i }).click();
  const simBanner = page.locator("div[role='status']", { hasText: "SIMULATION — Telephone OTP" });
  await simBanner.waitFor();
  await page.screenshot({ path: path.join(SCREENS_DIR, "02-selected-unverified-otp.png"), fullPage: true });

  // 3. Verify OTP -> Protected Customer Account & Booking History
  const codeText = (await simBanner.locator("strong").textContent())?.trim() ?? "";
  await page.getByLabel(/Enter OTP/i).fill(codeText);
  await page.getByRole("button", { name: /Verify OTP/i }).click();
  await page.getByRole("heading", { name: "Booking History" }).waitFor();
  await page.getByText(/PHC-24051/).waitFor();
  await page.screenshot({ path: path.join(SCREENS_DIR, "03-verified-account-and-bookings.png"), fullPage: true });

  // 4. Unverified direct navigation to /customers/new is blocked
  await page.goto(`${WEB_URL}/customers/new`, { waitUntil: "networkidle" });
  await page.getByText("Verification Required").waitFor();
  await page.getByRole("button", { name: /Back to Customer Lookup/i }).click();
  await page.waitForURL(/\/customers$/);

  // 5. New customer -> No Matching Account -> Verify OTP -> Begin Account Creation -> /customers/new
  await page.getByLabel(/Caller telephone number/i).fill("07999 888777");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByRole("heading", { name: "No Matching Account" }).waitFor();
  await page.getByRole("button", { name: /Send Simulated OTP/i }).click();
  const newSimBanner = page.locator("div[role='status']", { hasText: "SIMULATION — Telephone OTP" });
  await newSimBanner.waitFor();
  const newCode = (await newSimBanner.locator("strong").textContent())?.trim() ?? "";
  await page.getByLabel(/Enter OTP/i).fill(newCode);
  await page.getByRole("button", { name: /Verify OTP/i }).click();
  await page.getByRole("button", { name: /Begin Account Creation/i }).click();
  await page.waitForURL(/\/customers\/new$/);
  await page.getByRole("heading", { name: "New Customer", exact: true }).waitFor();
  await page.getByText("No customer account has been saved yet").waitFor();
  const lockedPhone = await page.getByLabel(/Verified telephone number/i).inputValue();
  if (lockedPhone !== "07999888777") throw new Error(`Expected locked phone 07999888777, got ${lockedPhone}`);
  await page.screenshot({ path: path.join(SCREENS_DIR, "04-no-match-and-new-customer-entry.png"), fullPage: true });

  // Back to Customer Lookup works
  await page.getByRole("button", { name: /Back to Customer Lookup/i }).click();
  await page.waitForURL(/\/customers$/);

  console.log("PASS accept-ui-scrum25 + 4 screenshots captured");
} finally {
  await browser.close();
}
