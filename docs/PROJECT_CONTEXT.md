# PrivateHire Cars — Project Context

> Updated during SCRUM-103 finalization on 2026-11-25.
> Labels used in this document:
> - `VERIFIED`: Directly observed in the repository, files, or command outputs.
> - `USER-APPROVED`: Explicitly approved by the user (Thuc Nguyen); not claimed as full-team approval unless separately confirmed.
> - `USER-CONFIRMED`: Confirmed by the user (e.g., Jira subtask list/assignees), not live-Jira-verified.
> - `PROPOSED`: Suggested or pending explicit team/user approval.
> - `ASSUMPTION`: Inferred or expected context not yet independently verified.
> - `BLOCKED`: Cannot be verified due to missing access or tooling.

---

## 1. Repository & Git State

- **Repository Path (`VERIFIED`):** `C:\Users\anct7\Downloads\privateHireCar_25_11\privateHireCar_25_11`
- **Current Checked-Out Branch (`VERIFIED`):** `feature/sprint3-customer-verification` tracking `origin/dev` (base commit `43ca762` — `Merge pull request #5 from CongTuDanhNguoi/release/v2`).
- **Working Tree Status (`VERIFIED`):** Untracked `docs/PROJECT_CONTEXT.md` and `docs/SPRINT3_EXECUTION_CONTEXT.md` preserved; all tracked monorepo files match `origin/dev` cleanly.
- **Remote Branches (`VERIFIED`):**
  - `origin/dev` (`43ca762` — Integrated monorepo: `app/`, `web/`, `backend/`, `docs/`, `deploy/`, `docker-compose.yml`, `docker-compose.prod.yml`)
  - `origin/main` (`776c8b6` — Older Sprint 1 frontend-only prototype)
  - `origin/release/v2`, `origin/feature/staff-portal`, `origin/feature/sprint1-prototype-completion`

---

## 2. Verified Architecture (`feature/sprint3-customer-verification` / `origin/dev`)

PrivateHire Cars is a monorepo with two frontend applications sharing a single Express/TypeScript backend and MySQL 8 database (`VERIFIED`):

1. **Customer App (`app/`, `VERIFIED`):**
   - Stack: React 19.2.0, TypeScript 5.9, Vite 7.1, Tailwind CSS v4, `react-router-dom` 7.9.0.
   - Dev port: `5173` (mobile 390px layout), proxies `/api` to backend `:4000`.
   - Pages: `WelcomePage`, `LoginPage`, `RegisterPage`, `VerifyEmailPage`, `RegistrationCompletePage`, `ForgotPasswordPages`, `HomePage`, `ServiceSelectionPage`, `JourneyDetailsPage`, `VehicleSizePage`, `AvailabilityPage`, `GalleryPage`, `ProfilePage`, `SupportPage`, and `checkout/*` (`PriceReviewPage`, `EditJourneyPage`, `PaymentSuccessPage`, `ReceiptPage`, `ReceiptPrintPage`, `NotificationPage`).

2. **Staff Web Portal (`web/`, `VERIFIED`):**
   - Stack: React 19.2.0, TypeScript 5.9, Vite 7.1, Tailwind CSS v4, `react-router-dom` 7.9.0 (`createBrowserRouter` with `useBlocker` for unsaved draft protection), `@fontsource/inter`.
   - Dev port: `5174` (desktop layout), proxies `/api` to backend `:4000`.
   - Pages: `LoginPage`, `InboxPage`, `EnquiryDetailPage`, `UiKitPage`, `NotFoundPage`.
   - Reusable UI Kit in `web/src/components/ui/` (`Alert`, `Avatar`, `Badge`, `Button`, `Card`, `ConfirmDialog`, `CopyButton`, `Feedback`, `Field`, `Icon`, `Segmented`, `Spinner`, `Toast`).
   - Layout & Auth: `web/src/components/layout/AppShell.tsx`, `web/src/auth/AuthContext.tsx`, `web/src/auth/RouteGuards.tsx`, `web/src/api/client.ts`.

3. **Backend (`backend/`, `VERIFIED`):**
   - Stack: Node.js, Express 5.3.0, TypeScript (`tsx`), `mysql2`, `bcryptjs`, `jsonwebtoken`, `zod`, `cookie-parser`, `dotenv`.
   - Dev port: `4000`.
   - Auth/Session (`backend/src/services/session.ts`, `backend/src/middleware/requireStaff.ts`): Separate httpOnly JWT cookies (`phc_customer` and `phc_staff`, 8-hour expiry, `iat` available via `readSession`) with `Cache-Control: no-store` on `/api`.
   - Mounted routers (`backend/src/app.ts`): `/api/health`, `/api/customer/auth`, `/api/customer/bookings`, `/api/customer/enquiries`, `/api/staff/auth`, `/api/staff/enquiries`, `/api/staff` (`staffResponsesRouter`), and `/api/dev` (non-production only).

4. **Shared Database (`MySQL 8`, `VERIFIED`):**
   - Database name: `privatehire` (Docker host port `3307` -> container `3306`, UTC timestamps, `utf8mb4_unicode_ci`).
   - Existing tables (`backend/sql/001_schema.sql`): `staff`, `customers`, `email_verifications`, `password_resets`, `bookings`, `enquiries`, `enquiry_responses`, `enquiry_status_history`, `login_attempts`.

---

## 3. Existing Reusable Functionality & OTP Isolation (`VERIFIED`)

- **Customer Data:** `customers` table has `id`, `full_name`, `email`, `phone VARCHAR(30) NULL` (stored trimmed, not normalized, not unique), `home_address`, `card_last4`, `email_verified_at`.
- **Bookings:** `bookings` table stores `SAVED` and `PAID` customer bookings (`customerEnquiryService.ts:listCustomerBookings`, `checkoutService.ts`).
- **Distinction: Simulated Telephone OTP vs. Registration Email OTP (`VERIFIED` / `USER-APPROVED`):**
  - **Existing Registration Email OTP (`emailVerificationService.ts` / `email_verifications` / `app/src/validation/otpValidation.ts`):** 6 digits via EmailJS/Mock, **10-minute TTL**, **5 max attempts**, **60s resend cooldown**, permanently sets `customers.email_verified_at`.
  - **New Simulated Telephone OTP (`SCRUM-25`):** 6 numeric digits, **5-minute TTL**, **3 max attempts**, resend immediately invalidates previous code (no additional resend cooldown required by MVP), no real SMS, bound to `(staff_id, customer_id, staff_session_iat)` for caller verification only. Must use its own table/service/validation and must **never** reuse or mutate `email_verifications` or `email_verified_at`.
- **Additive Schema Update (`VERIFIED` in `001_schema.sql` & `db-init.ts`, not yet applied to a live DB):** Added `customers.phone_normalized VARCHAR(20) NULL` + `INDEX idx_customers_phone_norm (phone_normalized)` and idempotent `upgradeCustomerPhoneNormalized()` in `db-init.ts`. Still pending for later tasks: `caller_verifications` (SCRUM-107), `vehicles`, `drivers`.

---

## 4. Team Responsibilities (`USER-CONFIRMED`)

- **Thuc Nguyen (User):** Final decision-maker, Scrum Master, requirements reviewer, Sprint 3 contributor (`SCRUM-103`, `SCRUM-106`, `SCRUM-107`, `SCRUM-108`).
- **ChatGPT:** Primary planner, architecture reviewer, quality reviewer.
- **Antigravity:** Technical executor, code inspector, implementation assistant, test executor.
- **Ngoc Vi:** UX wireframes and user flows (`SCRUM-104`).
- **Hieu Vu:** High-fidelity UI and UI Kit (`SCRUM-105`).
- **Bao:** Developer; future Sprint 3 implementation allocation is not yet finalised (do not assign work without user approval).

---

## 5. Safe Git & Database Practices (`USER-APPROVED`)

- **Git Allowed Without Approval:** `git status`, `git diff`, `git log`, `git branch`, `git show`.
- **Git Requires Explicit User Approval:** Switching/creating branches, installing dependencies, running migrations, creating commits.
- **Git Never Automated:** `push`, `merge`, `rebase`, `reset`, `clean`, `force push`, deleting branches or project files.
- **Database Safety:** Never reset, truncate, replace, or migrate the normal project database without explicit approval.
- **Destructive Script Warning (`VERIFIED`):** `backend/scripts/smoke-test.mjs` runs `npm run db:reset`, which wipes and reseeds the database. Never run it against the normal project database; use an isolated test database only.
