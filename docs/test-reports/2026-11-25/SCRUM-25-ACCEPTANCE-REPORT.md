# SCRUM-25 Acceptance Test Report (SCRUM-108)

- **Project:** COMP1807 — PrivateHire Cars
- **Sprint:** Sprint 3 — Quality Release
- **Parent Story:** SCRUM-25 — Customer Identification & Verification
- **Task:** SCRUM-108 — Execute SCRUM-25 acceptance tests, review defects and retest fixes
- **Branch / Base Commit:** `feature/sprint3-customer-verification` (based on `origin/dev` `43ca762`, uncommitted local changes)
- **Date:** 2026-11-25
- **Tester Role:** Thuc Nguyen (Developer & Self-Tester — **not** independent acceptance; independent review by Ngoc Vi, Hieu Vu, and Reviewer still required)

---

## 1. Test Execution Environment

- **Isolated Database:** Docker container `privatehire-test-db` (`mysql:8.0`, volume `privatehire-test-db-data`, DB `privatehire_test`, user `phc_test`, bound to `127.0.0.1:3308`). Normal `privatehire` DB and Windows `MySQL84` untouched.
- **Backend API:** Express 5 / TypeScript (`NODE_ENV=development`, `EMAIL_PROVIDER=MOCK`, port `4101` for UI tests / ephemeral `127.0.0.1` port for API tests).
- **Staff Portal UI:** Vite 7 (`http://localhost:5174`), Playwright (`channel: "msedge"`, headless).

---

## 2. Acceptance Criteria Traceability Matrix

| AC / Requirement | Implementation Files | UI Steps (`/customers`) | API Endpoints | Test Cases | Evidence / Result |
|---|---|---|---|---|---|
| **AC1:** Staff can search for a customer using available identifying information. | `backend/src/validation/customerSearch.ts`, `staffCustomerService.ts`, `staffCustomers.ts`, `web/src/pages/CustomerSearchPage.tsx` | Enter telephone number -> click **Search** | `GET /api/staff/customers/search?phone=...` | `unit-scrum106`, `live-scrum106` (DB-106-4,6), `accept-ui-scrum25` | **PASS** (developer self-test) |
| **AC2:** The system displays possible matching customer accounts. | `staffCustomerService.ts`, `CustomerSearchPage.tsx` | View **Matching Customer Accounts** list (0, 1, or multiple) | `GET /api/staff/customers/search?phone=...` | `int-scrum106-http`, `live-scrum106` (DB-106-5), `accept-ui-scrum25` | **PASS** (developer self-test; `01-search-matching.png`) |
| **AC3:** Staff must complete a verification process before accessing an existing customer account. | `callerVerificationService.ts`, `requireVerifiedCaller.ts`, `callerOtp.ts`, `CustomerSearchPage.tsx` | Select customer -> **Send Simulated OTP** -> **Enter OTP** -> **Verify OTP** -> **Protected Customer Account** | `POST /:id/otp/send`, `POST /:id/otp/verify`, `GET /:id` (`403` before verify) | `unit-scrum107`, `live-scrum107` (1–10), `accept-scrum25`, `accept-ui-scrum25` | **PASS** (developer self-test; `02-selected-unverified-otp.png`, `03-verified-account-and-bookings.png`) |
| **AC4:** The system clearly indicates when no matching customer account exists. | `CustomerSearchPage.tsx` | Search unknown number -> **No Matching Account** card/alert shown | `GET /api/staff/customers/search?phone=...` (`[]`) | `live-scrum106` (DB-106-5), `ui-scrum107`, `accept-ui-scrum25` | **PASS** (developer self-test; `04-no-match-and-new-customer-entry.png`) |
| **AC5:** Staff can begin creating a new account for a verified new customer. | `callerVerificationService.ts`, `staffCustomers.ts`, `CustomerSearchPage.tsx` | Under **No Matching Account**: **Send Simulated OTP** -> **Verify OTP** -> **Begin Account Creation** | `POST /new/otp/send`, `POST /new/otp/verify`, `POST /new/begin` (`403` before verify, `200` after) | `live-scrum107` (14, 15), `ui-scrum107`, `accept-ui-scrum25` | **PARTIAL / PROVISIONAL PASS** (verified entry gate & confirmation banner work; downstream registration form is outside SCRUM-25) |
| **Extended Workflow:** Booking History | `staffCustomerService.ts`, `staffCustomers.ts`, `CustomerSearchPage.tsx` | After OTP verify, view **Booking History** card (UK time, `SAVED`/`PAID`) | `GET /api/staff/customers/:id/bookings` (`403` before verify) | `live-scrum107` (10–13), `accept-ui-scrum25` | **PASS** (developer self-test; `03-verified-account-and-bookings.png`) |

---

## 3. Exact Test Commands & Actual Results

1. `npm --prefix backend run typecheck` (`tsc --noEmit`) -> **PASS** (0 errors)
2. `npm --prefix web run build` (`tsc --noEmit && vite build`) -> **PASS** (88 modules)
3. `npx --prefix backend tsx --test backend/scripts/unit-scrum106.ts` -> **PASS** (5/5)
4. `npx --prefix backend tsx --test backend/scripts/unit-scrum107.ts` -> **PASS** (2/2)
5. `npx --prefix backend tsx --test backend/scripts/live-scrum106.ts` -> **PASS** (3/3 suites: DB-106-1..8)
6. `npx --prefix backend tsx --test backend/scripts/live-scrum107.ts` -> **PASS** (7/7 test blocks: scenarios 1–16)
7. `npx --prefix backend tsx --test backend/scripts/accept-scrum25.ts` -> **PASS** (4/4: production mode hides `simulatedCode`, expired Staff JWT rejected `401`, Customer App login/me/bookings regression PASS, `email_verifications` count = 0)
8. `node web/scripts/accept-ui-scrum25.mjs` -> **PASS** (Existing & New Customer journeys + 4 screenshots captured)

---

## 4. Screenshots for Vi (SCRUM-104) & Hieu (SCRUM-105) Review

- [01-search-matching.png](screens/01-search-matching.png) — Matching Customer Accounts list
- [02-selected-unverified-otp.png](screens/02-selected-unverified-otp.png) — Selected Customer + Simulated OTP banner + Enter OTP form
- [03-verified-account-and-bookings.png](screens/03-verified-account-and-bookings.png) — Verification Successful + Protected Customer Account + Booking History
- [04-no-match-and-new-customer-entry.png](screens/04-no-match-and-new-customer-entry.png) — No Matching Account + Verified New-Customer Entry

---

## 5. Defect Log & Known Limitations

- **DEF-108-1 (UX/UI Acceptance — Severity: Blocker for Story Done):**
  - **Related AC:** AC1–AC5, Booking History
  - **Description:** Approved SCRUM-104 (Ngoc Vi) wireframes and SCRUM-105 (Hieu Vu) high-fidelity Figma designs have not yet been reviewed/approved against the provisional `/customers` UI.
  - **Status:** `BLOCKED` (awaiting Vi & Hieu review).
- **LIM-108-1 (AC5 Downstream Registration Scope):**
  - **Related AC:** AC5
  - **Description:** Clicking **Begin Account Creation** enforces server-side telephone verification (`POST /api/staff/customers/new/begin`) and displays the `Verified New-Customer Entry` (`STAFF_ASSISTED_REGISTRATION_ENTRY`) confirmation, but does not open a full staff-assisted customer registration form (full registration is outside SCRUM-25).

---

## 6. Independent Review Requirements

- All tests above were executed by **Thuc Nguyen** (developer self-testing).
- Before **SCRUM-25** can be marked **Done** on Jira:
  1. **Ngoc Vi (SCRUM-104)** and **Hieu Vu (SCRUM-105)** must review the provisional `/customers` screenshots (`docs/test-reports/2026-11-25/screens/`) and approve UX/UI parity.
  2. An independent reviewer (or ChatGPT/team review) must sign off on the acceptance evidence.
  3. Changes on `feature/sprint3-customer-verification` must be committed and merged per team Git workflow.
