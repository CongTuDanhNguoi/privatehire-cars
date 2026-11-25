// Playwright E2E test for SCRUM-107 (OTP, Booking History, New-Customer Entry & Enquiry regression).
import { chromium } from "playwright";

const WEB_URL = process.env.WEB_URL || "http://localhost:5174";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage();

try {
  await page.goto(`${WEB_URL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(/Email/i).fill("admin@gmail.com");
  await page.getByRole("textbox", { name: "Password" }).fill("123456");
  await page.getByRole("button", { name: /Log in|Sign in/i }).click();
  await page.waitForURL(/\/enquiries/);
  await page.getByRole("heading", { name: /Enquir/i }).waitFor({ timeout: 10000 });

  // Go to Customer Lookup
  await page.getByRole("link", { name: /Customer Lookup/i }).click();
  await page.waitForURL(/\/customers/);

  // 1. Existing customer: Alex Morgan (+44 7911 123456)
  await page.getByLabel(/Caller telephone number/i).fill("07911 123456");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByRole("button", { name: /Select customer/i }).first().click();
  await page.getByText("Selected Customer — Verification Required").waitFor();

  // Send Simulated OTP
  await page.getByRole("button", { name: /Send Simulated OTP/i }).click();
  await page.getByText(/SIMULATION — Telephone OTP/i).waitFor();

  // Wrong OTP -> Incorrect OTP error
  await page.getByLabel(/Enter OTP/i).fill("000000");
  await page.getByRole("button", { name: /Verify OTP/i }).click();
  await page.getByText(/Incorrect verification code|attempts remaining/i).waitFor();

  // Resend OTP & extract simulated code
  await page.getByRole("button", { name: /Resend OTP/i }).click();
  const simBanner = page.locator("div[role='status']", { hasText: "SIMULATION — Telephone OTP" });
  await simBanner.waitFor();
  const codeText = (await simBanner.locator("strong").textContent())?.trim() ?? "";
  if (!/^\d{6}$/.test(codeText)) throw new Error(`Expected 6-digit simulated code, got: ${codeText}`);

  // Verify with new OTP -> Protected Customer Account & Booking History
  await page.getByLabel(/Enter OTP/i).fill(codeText);
  await page.getByRole("button", { name: /Verify OTP/i }).click();
  await page.getByText("Verification Successful").waitFor();
  await page.getByRole("heading", { name: "Protected Customer Account" }).waitFor();
  await page.getByText("221B Baker St, London NW1 6XE").waitFor();
  await page.getByRole("heading", { name: "Booking History" }).waitFor();
  await page.getByText(/PHC-24051/).waitFor();
  await page.getByText(/PHC-24052/).waitFor();

  // Switch customer clears verified view
  await page.getByRole("button", { name: /Switch customer/i }).click();
  await page.getByText(/Matching Customer Accounts/i).waitFor();

  // 2. New customer flow (AC5): 07999 888777 -> No Matching Account
  await page.getByLabel(/Caller telephone number/i).fill("07999 888777");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.getByRole("heading", { name: "No Matching Account" }).waitFor();

  // Clicking Begin Account Creation before OTP verify is blocked
  await page.getByRole("button", { name: /Begin Account Creation/i }).click();
  await page.getByText(/Telephone verification is required/i).waitFor();

  // Send & verify simulated OTP for new customer
  await page.getByRole("button", { name: /Send Simulated OTP/i }).click();
  const newSimBanner = page.locator("div[role='status']", { hasText: "SIMULATION — Telephone OTP" });
  await newSimBanner.waitFor();
  const newCode = (await newSimBanner.locator("strong").textContent())?.trim() ?? "";
  await page.getByLabel(/Enter OTP/i).fill(newCode);
  await page.getByRole("button", { name: /Verify OTP/i }).click();
  await page.getByText("Verification Successful").waitFor();

  // Begin Account Creation now unlocked
  await page.getByRole("button", { name: /Begin Account Creation/i }).click();
  await page.getByText("Verified New-Customer Entry").waitFor();

  console.log("PASS UI-107 Staff Portal OTP, Booking History, New-Customer Entry & Enquiry regression");
} finally {
  await browser.close();
}
