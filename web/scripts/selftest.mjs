// =============================================================
// Staff Portal self-test (Playwright) — plan §13 / demo script §14 (staff side).
//
// Before running:
//   1. The stack is running (docker compose up -d) — Staff Portal on http://localhost:5174.
//   2. be/.env uses the MOCK email provider and forces ONE failure:
//        EMAIL_PROVIDER=MOCK
//        MOCK_EMAIL_FAIL=next
//      then: docker compose up -d --force-recreate be
//   3. Fresh demo data: docker compose exec be npm run db:reset
//   4. Once: npx playwright install chromium
// Run:  cd web && npm run selftest
// Result: web/selftest/ — screenshots + report.html
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5174";
const OUT = path.resolve(process.env.OUT_DIR ?? "selftest");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

const results = [];
let shot = 0;
const snap = async (label) => {
  const file = `${String(++shot).padStart(2, "0")}-${label}.png`;
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  return file;
};
const pathname = () => new URL(page.url()).pathname;
const wait = (ms = 400) => page.waitForTimeout(ms);
function expect(cond, message) {
  if (!cond) throw new Error(message);
}
async function test(id, criterion, fn) {
  const shots = [];
  let ok = true;
  let detail = "";
  try {
    detail = (await fn((label) => snap(label).then((f) => shots.push(f)))) ?? "";
  } catch (err) {
    ok = false;
    detail = err.message;
    shots.push(await snap(`${id}-FAILED`));
  }
  results.push({ id, criterion, ok, detail, shots });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${criterion}${ok ? "" : "  -> " + detail}`);
}
const rowTexts = async () => page.locator("tbody tr").allInnerTexts();

// The forced failure (step S08) only works with the MOCK provider.
const settings = await (await fetch(`${BASE}/api/health`)).json().catch(() => null);
if (!settings) {
  console.error(`Cannot reach ${BASE}. Start the stack first (docker compose up -d).`);
  process.exit(1);
}

// ---------------------------------------------------------------
await test("S01", "Chưa đăng nhập vào /enquiries → về /login", async (s) => {
  await page.goto(BASE + "/enquiries");
  await page.waitForURL("**/login");
  await s("guest-redirected");
});

await test("S02", "Login: để trống / sai mật khẩu / đúng", async (s) => {
  await page.click("button[type=submit]");
  await wait();
  expect((await page.textContent("#email-error"))?.includes("Email address is required."), "Thiếu lỗi email bắt buộc");
  expect((await page.textContent("#password-error"))?.includes("Password is required."), "Thiếu lỗi mật khẩu bắt buộc");
  await s("login-empty");
  await page.fill("#email", "sarah.collins@privatehire.test");
  await page.fill("#password", "wrong-password");
  await page.click("button[type=submit]");
  await page.getByText("Incorrect email or password.").waitFor();
  await s("login-wrong");
  await page.fill("#password", "Staff@2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/enquiries**");
  const settingsRes = await page.evaluate(() => fetch("/api/staff/email-settings").then((r) => r.json()));
  expect(settingsRes.provider === "MOCK", `Cần EMAIL_PROVIDER=MOCK (đang là ${settingsRes.provider}) — xem hướng dẫn đầu file`);
  return "Sarah Collins đăng nhập, provider MOCK";
});

await test("S03", "Inbox mặc định lọc Awaiting, có số đếm", async (s) => {
  await page.locator("tbody tr", { hasText: "ENQ-" }).first().waitFor();
  const rows = await rowTexts();
  expect(rows.length > 0 && rows.every((r) => r.includes("Awaiting")), "Có dòng không phải Awaiting");
  const sub = await page.locator("h1 + p").innerText();
  expect(/\d+ awaiting · \d+ resolved/.test(sub), `Dòng tóm tắt sai: ${sub}`);
  await s("inbox-awaiting");
  return sub;
});

await test("S04", "Lọc General / Trip-specific và tìm \"child seat\"", async (s) => {
  await page.locator('label:has(input[value="TRIP"])').click();
  await page.waitForURL("**type=TRIP**");
  await wait(600);
  expect((await rowTexts()).every((r) => r.includes("Trip")), "Lọc Trip có dòng General");
  await page.locator('label:has(input[value="GENERAL"])').click();
  await page.waitForURL("**type=GENERAL**");
  await wait(600);
  expect((await rowTexts()).every((r) => r.includes("General")), "Lọc General có dòng Trip");
  await page.locator('label:has(input[value="ALL"])').click();
  await page.waitForURL((u) => !u.search.includes("type="));
  await page.getByLabel("Search").fill("child seat");
  await page.waitForURL("**q=child**");
  await wait(600);
  const rows = await rowTexts();
  expect(rows.length === 1 && rows[0].includes("Do you provide child seats?"), `Tìm kiếm ra ${rows.length} dòng`);
  await s("inbox-search");
  await page.getByLabel("Search").fill("");
  await wait(700);
});

await test("S05", "Mở enquiry TRIP → có thông tin khách + Trip details", async (s) => {
  await page.getByRole("link", { name: "Extra luggage for airport transfer" }).click();
  await page.waitForURL("**/enquiries/*");
  await page.getByRole("heading", { name: "Trip details" }).waitFor();
  const text = await page.locator("main").innerText();
  expect(text.includes("PHC-24051") && text.includes("alex.morgan@example.com"), "Thiếu booking PHC-24051 hoặc email khách");
  await s("detail-trip");
});

await test("S06", "Gửi phản hồi trống → lỗi validation", async (s) => {
  await page.click("text=Send response");
  await wait();
  expect((await page.textContent("#reply-body-error"))?.includes("Message is required."), "Thiếu lỗi Message is required.");
  await s("reply-empty");
});

await test("S07", "Gửi lỗi (MOCK_EMAIL_FAIL=next) → Failed, giữ nội dung → Retry → Sent + Resolved", async (s) => {
  await page.fill("#reply-body", "Hi Alex,\n\nThe Seven-Seater has room for two extra cases and a pushchair.\n\nSarah");
  await page.click("text=Send response");
  await page.getByText("Email could not be sent.").waitFor({ timeout: 15000 });
  expect((await page.inputValue("#reply-body")).includes("Seven-Seater"), "Nội dung bị mất sau khi gửi lỗi");
  expect((await page.locator("ol > li").first().innerText()).includes("Failed"), "Lịch sử không có mục Failed");
  await s("send-failed");
  await page.locator("form [role=alert]").getByRole("button", { name: "Retry" }).click();
  await page.getByText("Enquiry marked as Resolved.").waitFor({ timeout: 15000 });
  expect((await page.locator("ol > li").first().innerText()).includes("Sent"), "Retry chưa thành Sent");
  expect(await page.locator('input[type=radio][value="RESOLVED"]').isChecked(), "Trạng thái chưa thành Resolved");
  await s("retry-sent");
});

await test("S08", "Đổi tay Resolved → Awaiting → toast + lịch sử", async (s) => {
  await page.locator('label:has(input[value="AWAITING"])').click();
  await page.getByText("Status updated").first().waitFor();
  await wait(800);
  const history = await page.locator("#status-history-title").locator("..").innerText();
  expect(history.includes("Resolved → Awaiting") && history.includes("by Sarah Collins"), `Lịch sử sai: ${history}`);
  await s("status-manual");
});

await test("S09", "Enquiry GENERAL không có Trip details", async (s) => {
  await page.goto(BASE + "/enquiries?status=ALL&q=child%20seat");
  await page.getByRole("link", { name: "Do you provide child seats?" }).click();
  await page.getByRole("heading", { name: "Customer", exact: true }).waitFor();
  expect((await page.getByRole("heading", { name: "Trip details" }).count()) === 0, "GENERAL vẫn có Trip details");
  await s("detail-general");
});

await test("S10", "Log out → /login; Back không vào lại trang trong", async (s) => {
  await page.click("text=Log out");
  await page.waitForURL("**/login");
  await page.goBack();
  await wait(800);
  expect(pathname() === "/login", `Back vào được ${pathname()}`);
  await s("logged-out");
});

await browser.close();

// ---------- report ----------
const passed = results.filter((r) => r.ok).length;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const rows = results
  .map(
    (r) => `<tr><td>${r.id}</td><td>${esc(r.criterion)}</td><td class="${r.ok ? "pass" : "fail"}">${r.ok ? "PASS" : "FAIL"}</td>
<td>${esc(r.detail)}</td><td>${r.shots.map((f) => `<a href="${f}"><img src="${f}"></a>`).join("")}</td></tr>`,
  )
  .join("\n");
fs.writeFileSync(
  path.join(OUT, "report.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>Staff Portal — Self-test</title><style>
body{font-family:system-ui,sans-serif;margin:24px;color:#02284f} table{border-collapse:collapse;width:100%;font-size:13px}
td,th{border:1px solid #d5e2ed;padding:8px;vertical-align:top;text-align:left} th{background:#d5e2ed}
.pass{color:#047857;font-weight:700} .fail{color:#b91c1c;font-weight:700} img{width:160px;border:1px solid #d5e2ed;margin:2px}
</style></head><body><h1>Staff Portal — Self-test report</h1>
<p>${new Date().toLocaleString()} · ${BASE} · <b>${passed}/${results.length} PASS</b> · ${pageErrors.length ? `JS errors: ${esc(pageErrors.join("; "))}` : "0 JS errors"}</p>
<table><tr><th>ID</th><th>Criterion</th><th>Result</th><th>Detail</th><th>Evidence</th></tr>${rows}</table></body></html>`,
);

console.log(`\n${passed}/${results.length} PASS${pageErrors.length ? ` · JS errors: ${pageErrors.join("; ")}` : ""} — report: ${path.join(OUT, "report.html")}`);
process.exitCode = passed === results.length && pageErrors.length === 0 ? 0 : 1;
