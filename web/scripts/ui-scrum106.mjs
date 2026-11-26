// Playwright UI-106-1 test for Staff Portal Customer Search against live backend + privatehire_test.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const WEB_URL = process.env.WEB_URL || "http://localhost:5174";

const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage();

try {
  await page.goto(`${WEB_URL}/login`, { waitUntil: "networkidle" });

  // Staff login
  await page.getByLabel(/Email/i).fill("admin@gmail.com");
  await page.getByRole("textbox", { name: "Password" }).fill("123456");
  await page.getByRole("button", { name: /Log in|Sign in/i }).click();
  await page.waitForURL(/\/enquiries/);

  // Enquiry Management regression check
  await page.getByRole("heading", { name: /Enquir/i }).waitFor({ timeout: 10000 });

  // Navigate to Customer Lookup (/customers)
  await page.getByRole("link", { name: /Customer Lookup/i }).click();
  await page.waitForURL(/\/customers/);
  await page.getByRole("heading", { name: "Customer Lookup" }).waitFor();

  // Invalid phone validation
  await page.getByLabel(/Caller telephone number/i).fill("abc");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByText(/valid telephone number/i).waitFor();

  // Zero matches -> No Matching Account
  await page.getByLabel(/Caller telephone number/i).fill("07999999999");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByText("No Matching Account").waitFor();

  // Multiple matches (+44 7700 900123 -> Emily Clarke + Emily Duplicate)
  await page.getByLabel(/Caller telephone number/i).fill("+44 7700 900123");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByText(/Matching Customer Accounts \(2\)/).waitFor();

  // Select first customer -> Selected-but-unverified state
  await page.getByRole("button", { name: /Select customer/i }).first().click();
  await page.getByText("Selected Customer — Verification Required").waitFor();
  await page.getByText("Unverified Caller").waitFor();
  await page.getByText("Account access is protected").waitFor();

  // Switch customer clears selection
  await page.getByRole("button", { name: /Switch customer/i }).click();
  await page.getByText(/Matching Customer Accounts \(2\)/).waitFor();

  console.log("PASS UI-106-1 Staff Portal Customer Search & Enquiry regression");
} finally {
  await browser.close();
}
