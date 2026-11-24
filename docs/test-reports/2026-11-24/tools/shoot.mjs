// Chụp ảnh một trang sau khi đăng nhập (dùng cho báo cáo kiểm thử 2026-11-24).
// Chạy từ thư mục app/ để import Playwright:
//   cd app && node ../docs/test-reports/2026-11-24/tools/shoot.mjs <email> <password> <path> <name> [--print] [--base=URL]
// Ví dụ: node ../docs/test-reports/2026-11-24/tools/shoot.mjs alex.morgan@example.com Password123 /home home
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCREENS = path.join(here, "..", "screens");
const [email, password, route, name, ...flags] = process.argv.slice(2);
if (!email || !password || !route || !name) {
  console.error("usage: shoot.mjs <email> <password> <path> <name> [--print] [--base=URL]");
  process.exit(2);
}
const baseFlag = flags.find((f) => f.startsWith("--base="));
const BASE = baseFlag ? baseFlag.slice("--base=".length) : "http://localhost:5190";
const printMode = flags.includes("--print");

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
fs.mkdirSync(SCREENS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const problems = [];
page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
});

let code = 0;
try {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/home$/, { timeout: 10000 }).catch(() => null);
  // Staff Portal login has no /home redirect: accept any post-login URL that is not the login page.
  if (new URL(page.url()).pathname === "/login") throw new Error("login did not leave /login");

  if (printMode) await page.emulateMedia({ media: "print" });
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(1500);
  const file = path.join(SCREENS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${file}`);
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  code = 1;
} finally {
  for (const p of problems.slice(0, 20)) console.log(p);
  await browser.close();
}
process.exit(code);
