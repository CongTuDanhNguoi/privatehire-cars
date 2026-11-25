# PrivateHire Cars — Sprint 3 Execution Context

> Updated during SCRUM-103 finalization on 2026-11-25.
> Labels used in this document:
> - `VERIFIED`: Directly observed in the repository, files, or command outputs.
> - `USER-APPROVED`: Explicitly approved by the user (Thuc Nguyen); not claimed as full-team approval unless separately confirmed.
> - `USER-CONFIRMED`: Confirmed by the user, not live-Jira-verified.
> - `PROPOSED`: Suggested or pending explicit team/user approval.
> - `ASSUMPTION`: Inferred or expected context not yet independently verified.
> - `BLOCKED`: Cannot be verified due to missing access or tooling.

---

## 1. Branch & Sprint Scope

- **Current Feature Branch (`VERIFIED` / `USER-APPROVED`):** `feature/sprint3-customer-verification` based on `origin/dev` (`43ca762`).
- **Sprint 3 Dates (`ASSUMPTION` — not live-Jira-verified):** 25 November – 2 December 2026.
- **Live Jira Status (`BLOCKED`):** No Jira CLI, MCP server, or connected plugin is available. Issue statuses and descriptions cannot be read from live Jira.

### Reported Sprint 3 Parent Stories (`ASSUMPTION` — pending live Jira verification)

1. `SCRUM-25` — Customer Identification & Verification *(initial priority workstream, `USER-APPROVED`)*
2. `SCRUM-27` — Staff-Assisted Booking
3. `SCRUM-24` — Amend Existing Booking
4. `SCRUM-29` — Review Completed Journey
5. `SCRUM-60` — Add a New Minicab
6. `SCRUM-61` — Add a New Driver
7. `SCRUM-26` — View Available Vehicles and Drivers

### `SCRUM-25` Subtasks (`USER-CONFIRMED`, not `LIVE-JIRA-VERIFIED`)

- `SCRUM-103` — Requirements Review — Thuc
- `SCRUM-104` — UX Wireframes — Vi
- `SCRUM-105` — High-Fidelity UI — Hieu
- `SCRUM-106` — Customer Search & Access Control — Thuc
- `SCRUM-107` — OTP & Booking History — Thuc
- `SCRUM-108` — Acceptance Testing — Thuc

---

## 2. Corrected `SCRUM-25` AC1–AC5 Mapping

Original Acceptance Criteria are preserved verbatim:

- **AC1:** *Staff can search for a customer using available identifying information.*
  -> Maps to **telephone-number customer search**.
- **AC2:** *The system displays possible matching customer accounts.*
  -> Maps to **matching-account results** (handling 0, 1, or multiple matches).
- **AC3:** *Staff must complete a verification process before accessing an existing customer account.*
  -> Maps to **mandatory simulated telephone OTP verification and protected customer account access**.
- **AC4:** *The system clearly indicates when no matching customer account exists.*
  -> Maps to the **No Matching Account** state.
- **AC5:** *Staff can begin creating a new account for a verified new customer.*
  -> Maps to **verified-new-customer account-creation entry**.

> **Extended Workflow Note:** **Booking History** (viewing the verified customer's bookings) is part of the agreed extended `SCRUM-25` workflow (`SCRUM-107`), **not** AC4.

---

## 3. Approved & Proposed Decisions

### `USER-APPROVED` Decisions (Approved by Thuc Nguyen — NOT claimed as full-team approval)

- **Telephone OTP:** 6 numeric digits, 5-minute validity, max 3 incorrect attempts per issued OTP, resend immediately invalidates the previous OTP (no additional resend cooldown required by MVP), no real SMS delivery.
- **Telephone Search:** Normalize spaces and formatting separators; support UK representations (`+44`, `0044`, domestic `0`); support 0, 1, or multiple matching accounts; never treat a telephone number as proof of identity.
- **Caller Verification Context:** Bind verification to the correct customer and Staff session; changing customer invalidates previous verification; logging out invalidates verification; expired Staff sessions must not retain caller verification.
- **Simulated OTP Display:** Show demonstration OTP only through a controlled development/test mechanism; clearly label simulated delivery; never send an actual SMS; never expose demonstration OTP through production responses.
- **New Customer:** After successful simulated telephone verification, staff can enter the account-creation flow; SCRUM-25 does not require completing full staff-assisted registration; do not automatically create passwords or mark email addresses as verified.
- **Booking History:** After verification, show permitted fields: booking reference, service, pickup, destination, journey date/time, vehicle size, and existing booking status where available.
- **Branch & Isolation:** Separate feature branch `feature/sprint3-customer-verification` based on `origin/dev`; existing `email_verifications` OTP must not be reused; do not assign work to Bao without user approval.

### `PROPOSED` / Remaining Open Items

- **Exact simulated OTP display surface:** Confirm whether SCRUM-107 uses `/api/dev` only or also a dev-only Staff Portal banner.
- **New-customer account-creation entry (`SCRUM-107` / AC5):** Exact form fields & handoff UI (pending `SCRUM-104`/`SCRUM-105`).
- **UX/UI Finalization:** `SCRUM-104` (Ngoc Vi wireframes) and `SCRUM-105` (Hieu Vu high-fidelity UI) are not yet approved; current Staff Portal `/customers` UI is provisional.
- **Live Jira Verification (`BLOCKED`):** No Jira CLI/MCP/plugin available.

---

## 4. Development Readiness (`SCRUM-106` & `SCRUM-107`)

### Reusable Files (`VERIFIED`)

- Backend auth/session: `backend/src/services/session.ts`, `backend/src/middleware/requireStaff.ts`, `backend/src/errors.ts`.
- Backend customer/bookings: `backend/src/services/customerAuthService.ts`, `backend/src/services/customerEnquiryService.ts` (`listCustomerBookings`), `backend/src/services/checkoutService.ts`.
- Shared validation pattern: `app/src/validation/checkoutValidation.ts` (`normalizePhone`), `backend/src/validation/auth.ts`.
- Staff Portal UI/API: `web/src/api/client.ts`, `web/src/auth/AuthContext.tsx`, `web/src/components/layout/AppShell.tsx`, `web/src/components/ui/*`.

### Required Data-Model & API Changes (`PROPOSED`)

- **DB:** Add `customers.phone_normalized` (indexed) and `caller_verifications` table (separate from `email_verifications`).
- **API (`/api/staff/customers/*`, all behind `requireStaff`):**
  - `GET /api/staff/customers/search?phone=...` (`SCRUM-106`)
  - `GET /api/staff/customers/:id` (protected by verified-caller guard, `SCRUM-106`/`107`)
  - `POST /api/staff/customers/:id/otp/send` & `POST /api/staff/customers/:id/otp/verify` (`SCRUM-107`)
  - `GET /api/staff/customers/:id/bookings` (protected by verified-caller guard, `SCRUM-107`)
  - `POST /api/staff/customers/new/otp/send` & `POST /api/staff/customers` (`SCRUM-107` / AC5)
  - `POST /api/staff/customers/session/clear`

### Dependencies & Testing Safety

- **UX/UI Dependencies:** Final Staff Portal layout for `SCRUM-106` and `SCRUM-107` depends on `SCRUM-104` (Ngoc Vi wireframes) and `SCRUM-105` (Hieu Vu high-fidelity UI). Backend API + schema design can proceed once remaining business decisions are confirmed.
- **Safe Isolated DB Testing (`VERIFIED`):** Do not run `backend/scripts/smoke-test.mjs` (`db:reset`) against the normal project database; configure a separate isolated test database for `SCRUM-108` acceptance tests.
