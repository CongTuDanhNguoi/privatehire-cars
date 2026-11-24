# Full test pass before the demo — design

Date: 2026-11-24 · Branch: `release/v2` (commits up to `e7b1f78`) · Executor: Haiku · Author of plan: Opus

## 1. Intent

Bao demos PrivateHire Cars to the team lead. Before that, a tester (Haiku) checks **everything** — the new checkout
screens (SCRUM-72/77/88/90/83), the Enquiry wizard (SCRUM-95) and a regression of the customer app, backend and
Staff Portal — and writes **one report** of what works and what is broken, with evidence. Bao (or Opus) fixes later.

## 2. Goals / non-goals / anti-goals

Goals
- Every automated suite run on an isolated test stack, results recorded verbatim.
- A scripted browser checklist per screen: content vs Figma PNG, states, invalid input, reload, back, wrong-state URLs,
  390 px, keyboard/focus, console errors.
- Security/edge cases: someone else's booking, double payment, logged-out access, bad API bodies.
- One report file with a bug table (severity, steps, expected, actual, evidence) and a PASS/FAIL summary per area.

Non-goals
- Fixing anything. Editing any test. Testing production or the Docker stacks. Load/performance testing.
- Browsers other than Chromium. Pixel-measuring Figma (visual comparison by eye, side by side).

Anti-goals (failure even if the report looks fine)
- Any change to source, tests, config, Docker containers, or the `privatehire` / production databases.
- Real emails sent. Writing "PASS" without the command output or screenshot that proves it.
- Re-reporting the known issues in §7 as new bugs.

## 3. Constraints

- **Only files Haiku may create:** everything under `docs/test-reports/2026-11-24/` (report, screenshots, helper
  scripts). Nothing else in the repo changes. Temp copies of team scripts go to the OS temp folder, not the repo.
- **Ports (never 4000/5173/5174/8080/3306-docker):** backend **4400**, customer app **5190**, Staff Portal **5191**.
  Smoke test uses its own **4100** (built in).
- **Database:** local MySQL (localhost:3306, same credentials as `backend/.env`), database name **`privatehire_test`**.
  Reset with demo data before UI tests: `DB_NAME=privatehire_test npm run db:reset -- --demo` (in `backend/`).
- **Email:** test backend runs with `EMAIL_PROVIDER=MOCK` (no real email).
- **Do not touch:** Docker (`docker compose …`), the Cloudflare tunnel, `.env*`, `deploy/**`, git (no commit/push —
  except committing the report folder, only if Bao asks).
- No `npm install`, no new packages. Playwright is already installed in `app/`.
- Demo accounts in the test DB: customer `alex.morgan@example.com` / `Password123`, second customer
  `emily.clarke@example.com` / `Password123`, staff `admin@gmail.com` / `123456`.
- Report in **Vietnamese**; code identifiers, commands and UI texts in English.

## 4. Approaches (Bao picked A)

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | Separate test stack: ports 4400/5190/5191 + DB `privatehire_test`, automated suites + browser checklist | Isolated and repeatable; one-time DB creation |
| B | Separate ports, shared DB `privatehire` | Simpler, but smoke wipes that DB and test data mixes with dev data |
| C | Automated suites only | Cheap, but misses Figma/UX problems — not "full" |

## 5. Test stack (exact)

From `fe/` in **Git Bash** (the `VAR=value command` form below does not work in PowerShell). Earlier dev servers on
4300/5180 may still be running — ignore them, do not use them:
1. `cd backend; DB_NAME=privatehire_test npm run db:reset -- --demo`
2. Backend: `DB_NAME=privatehire_test EMAIL_PROVIDER=MOCK PORT=4400 npx tsx src/index.ts` (background, log to temp).
   Health: `curl http://localhost:4400/api/health` → `{"status":"ok","database":"up"}`; `/api/dev/last-verification-code` must not be 404-HTML (dev routes mounted).
3. App: `cd app; API_PROXY_TARGET=http://localhost:4400 npx vite --port 5190 --strictPort` (background).
4. Staff Portal: `cd web; API_PROXY_TARGET=http://localhost:4400 npx vite --port 5191 --strictPort` (background).
5. Record the PIDs; stop exactly these processes at the end.

Before every UI block that depends on clean data, re-run step 1 (backend keeps running; restart it if it errors).

## 6. What gets tested

### 6.1 Automated suites (run in this order; paste the summary lines into the report)
| # | Command | Expected |
|---|---|---|
| A1 | `cd app && npx tsc --noEmit`, same in `backend`, `web` | exit 0 ×3 |
| A2 | `cd backend && npx tsx scripts/unit-checkout.ts` | `unit-checkout: all PASS` |
| A3 | `cd backend && DB_NAME=privatehire_test npm run smoke` | `99/99 PASS` |
| A4 | reset DB (§5 step 1) | — |
| A5 | `cd app && BASE_URL=http://localhost:5190 OUT_DIR=<temp> npm run selftest` | `15/15 PASS` (AC-15 is still the old "no payment routes" check — see §7) |
| A6 | `cd app && BASE_URL=http://localhost:5190 OUT_DIR=<temp> node scripts/test-checkout.mjs` | `7/7 PASS` |
| A7 | team scripts `test-scrum12/16/17/18.mjs`, `test-final-acceptance.mjs`: temp copy without the line `executablePath: CHROME_PATH,`, run with `BASE_URL=http://localhost:5190` | all PASS |
| A8 | `cd web && BASE_URL=http://localhost:5191 node scripts/selftest.mjs` | all PASS |
| A9 | `cd app && npm run build`, `cd web && npm run build` | exit 0 |

A failing suite is a finding, not a stop: record it and continue.

### 6.2 Browser checklist (built-in browser pane at 375×812 + Playwright screenshots)
For each screen: open its PNG in `D:\Downloads\anh\` side by side, list every visible text/field/button of the PNG,
mark present/missing/different. Then the behaviour rows. Save one screenshot per state into the report folder.

| Area | PNG(s) | Behaviour to check |
|---|---|---|
| Availability → View Price | `04. Check Vehicle Availability - View Price.png` | full flow Home→Services→Journey→Vehicle→Availability; View Price disabled until trip saved, then opens `/checkout/PHC-…/price`; Unavailable state has no View Price |
| Price Review | `05…`, `08…` | £135.00 / −£20.25 / £114.75 (Seven-Seater), £95.00/−£14.25/£80.75 (Standard Car); Continue disabled until checkbox; Change Details/Vehicle; Cancel Journey; reload; unknown ref → "Booking not found."; paid ref → redirect to success |
| Edit Journey | `05A…` | prefilled; quick picks; clear ×; empty pickup/destination errors; destination = pickup error; Save creates new ref and shows 08 variant; Cancel Changes; map loads |
| Notification | `01…`, `02…`, `03…` | registered phone masked; Change number path; phone table: `+44 7700 900123` ✓, `07700 900123` ✓, `(+44) 7700-900-123` ✓, `+44 7700 ABC89` ✗, `12345` ✗, empty ✗; error text exactly `ERROR: Check telephone number format (e.g. +44 7...).`; Example button fills; Next disabled while invalid; double-click Next pays once |
| Payment Successful | `04. Payment Successful…` | amount, TXN-xxxxx, booking ref, UK date/time, card last 4; email row SENT/PENDING; reload works; Return to Dashboard clears booking |
| Receipt / Print | `14…`, `15…` | totals equal Price Review; Copy; Print → print preview shows receipt only (emulate print media); Share fallback; unpaid ref → redirect to price |
| Enquiry | `S95…`, `S95-01…06` | Profile row opens `/support`; type step; General: empty submit → banner + 3 drawn messages; valid → ENQ-xxxxxx; Trip with planned journey (plan a trip first) and with existing booking; counters; Submit another; My enquiries list updates |
| Staff Portal (5191) | — | log in admin; enquiry detail shows Enquiry details card (category/contact), Planned trip card, Trip card with Payment row "Paid · £…" / "Not paid" |
| Security / edge | — | logged out: `/checkout/x/price`, `/receipt/x`, `/support` → `/login`; Emily opening Alex's `/checkout/<ref>/price` → not found; API: `POST /api/customer/bookings/<ref>/pay` with `{}` → 400 phone; paying twice → same TXN; no `/api/dev` reachable on production is NOT tested (prod out of scope) |
| Regression (light) | existing PNGs | Welcome, Login (empty/invalid/locked), Register + OTP, Forgot password (4 screens), Home, Services, Journey, Vehicle, Profile, Log out — click through once; automated suites cover depth |
| Cross-cutting | — | console errors per page; keyboard: Tab order reaches every button, visible focus, Enter submits forms; 390 px no horizontal scroll; text not cut off |

### 6.3 Severity
- **Blocker** — breaks a demo flow or loses/leaks data. **Major** — wrong result or missing drawn element with a workaround.
- **Minor** — small functional or text issue. **Cosmetic** — visual difference from Figma only.

## 7. Known issues (record under "Đã biết", do not file as new)
1. Selftest AC-15 still checks "no payment routes" (proposal waiting: `docs/superpowers/plans/2026-11-24-ac15-proposal.md`).
2. Availability "Indicative rate" shows `£XX.XX` literally (copied from PNG; Bao to decide).
3. Enquiry counters show 1000/500 but the server limit is 2000.
4. SMS is never really sent; "SENT" is shown as drawn. Email to `@example.com` accounts is never sent → "PENDING".
5. `ui-skills` CLI was blocked; `baseline-ui` / `fixing-accessibility` were not run on the new screens.
6. Docker dev container on port 4000 runs old code (not used by this test).

## 8. Report

File: `docs/test-reports/2026-11-24/REPORT.md`, screenshots in `docs/test-reports/2026-11-24/screens/`
(name `<area>-<state>.png`), helper scripts (screenshot/print helpers) in `docs/test-reports/2026-11-24/tools/`.
Sections:
1. Tóm tắt (1 đoạn): số lỗi theo mức độ, có nên demo không.
2. Môi trường: commit, ports, DB, thời gian chạy.
3. Bảng tự động A1–A9: lệnh, kết quả thật (dòng tổng kết), PASS/FAIL.
4. Bảng lỗi: `BUG-01…` | mức độ | màn/khu vực | các bước | mong đợi | thực tế | ảnh.
5. Checklist theo màn: mỗi dòng PASS/FAIL + ghi chú; danh sách khác biệt so với Figma.
6. Đã biết (§7).
7. Chưa kiểm được và lý do.

## 9. Left to the plan writer / builder
Exact step order inside each area, Playwright helper for screenshots/print emulation, how to plan a trip quickly
for the Trip enquiry (UI path or sessionStorage like selftest), and the wording of each checklist row.
