# Checkout + Enquiry wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Figma Sprint-1 screens SCRUM-72/77/88/90/83/95 (price review → notification → payment → confirmation → receipt, and the enquiry wizard) with price + payment status stored in MySQL.

**Architecture:** Shared pure modules in `app/src/` (pricing, validation) are imported by both the React app and the Express backend (same pattern as `app/src/validation/*`). Backend adds additive columns (runtime `ALTER` for the existing production DB) and two booking endpoints; enquiries get optional contact/category/trip-snapshot columns. The app adds 6 pages under `RequireAuth` and reworks `SupportPage` into steps.

**Tech Stack:** React 19 + TS strict + Tailwind v4 + react-router 7 (app, `fe/app`), Express + TS + mysql2 + zod (backend, `fe/backend`), React (Staff Portal, `fe/web`), Playwright (already installed in app).

**Spec:** `fe/docs/superpowers/specs/2026-11-24-checkout-and-enquiry-design.md` — read it fully first; screen-by-screen content is in its §6, decisions in §10, rules in §10b.

## Global Constraints

- **Only add, never delete.** No deleting files, routes, components, features, tests, `data-testid`, `data-node-id`, validation strings, DB columns/rows. Restyle = keep every existing element/testid/behaviour and add the drawn parts. Anything that seems to need a removal → stop and ask Bao.
- **Figma design is fixed.** Every text, field, button and block in the PNGs (`D:\Downloads\anh\`) is built as drawn. Sample values (names, addresses, £, plates) come from real data where the app has it; fixed company text (carrier notice, VAT reg `GB 982 4410 29`, licence `PH0-4821`, dispatch `+44 [0]20 7946 0991`) is copied as drawn.
- **UI skills per screen:** invoke `ui-skills-root` before building each screen; after it works run `baseline-ui` on it; run `fixing-accessibility` on every page with a form. Polish may fix spacing/alignment/focus/tap targets only — never change drawn text, colours or layout.
- No new npm packages, no config changes (`package.json`, `tsconfig.json`, `vite.config.ts`). Map = `<iframe>` OpenStreetMap embed; QR = inline SVG.
- Protected (read-only unless Bao says "allowed"): `app/src/screens/**`, `app/scripts/selftest.mjs`, `app/scripts/test-scrum*.mjs`, `AGENTS.md`, `PROJECT_CONTEXT.md`, `.agents/**`, `README.md`, `DEMO_SCRIPT.md`.
- Existing validation message strings never change; new messages are new keys.
- Money in integer pence; display with `formatGbp`. Fares: `"Standard Car"` 9500, `"Seven-Seater"` 13500, discount 15 %.
- Times: DB is UTC; show UK time with the existing `formatUkDateTime` in `app/src/services/support.ts`.
- Git: binary is `"$LOCALAPPDATA/GitHubDesktop/app-3.6.10/resources/app/git/cmd/git.exe"` (not on PATH). Commit per task on `release/v2`. **Never push, never deploy to production** — ask Bao.
- Never print secrets (`.env.prod`, `deploy/cloudflared/credentials.json`).
- Reports to Bao in **Vietnamese** using the AGENTS.md §7 template; code identifiers in English.
- Dev env: Docker. After backend edits: `docker compose restart backend` (from `fe/`). If port 5173 hangs: `docker compose up -d --force-recreate app`.

## Review Focus

1. **Paying someone else's booking / a ref that doesn't exist** → 404, nothing changes. (Task 2 smoke checks.)
2. **Double-click "Next" / reload during pay** → one payment, same `paymentRef`, one email. (Task 2 idempotency check + button disabled while paying, Task 6.)
3. **Opening a checkout URL in the wrong state** (paid booking at `/price`, unpaid at `/receipt`, bad ref) → redirect / "Booking not found", never a blank page or crash. (Task 11 e2e.)
4. **Production DB without the new columns** → first request adds them, existing rows read as `SAVED`, old enquiry flow keeps working. (Task 2/3: smoke runs against a DB reset from the *old* schema path — see step "migration check".)
5. **Phone input with spaces, `+`, dashes, letters** → `+44 7700 900123` / `07700900123` valid; `+44 7700 ABC89` invalid with the drawn message. (Task 1 unit checks.)

---

### Task 0: Baseline

**Files:** none changed.

- [ ] **Step 1:** Read the spec, `fe/AGENTS.md` (or `../AGENTS.md`), `PROJECT_CONTEXT.md`, `.agents/rules/*`.
- [ ] **Step 2:** `cd fe && docker compose ps` — app (5173), backend (4000), db up. Start with `docker compose up -d` if not.
- [ ] **Step 3:** Record baseline: `cd app && npm run typecheck` (0 errors), `npm run selftest` (15/15), `cd ../backend && npm run typecheck && npm run smoke` (all PASS), `cd ../web && npm run typecheck`. If anything already fails → report to Bao, stop.
- [ ] **Step 4:** `git status` — there are ~20 uncommitted files from earlier work. Ask Bao once: "commit checkpoint trước khi làm?" Commit only on yes (`git add -A && git commit -m "checkpoint: before checkout"`). Never `.env*`.

---

### Task 1: Shared pricing + checkout validation

**Files:**
- Create: `app/src/data/pricing.ts`
- Create: `app/src/validation/checkoutValidation.ts`
- Create: `backend/scripts/unit-checkout.ts` (node:assert, run with tsx)

**Interfaces — Produces:**
- `pricing.ts`: `ONLINE_DISCOUNT_PERCENT = 15`; `BASE_FARE_PENCE: Record<string, number>` = `{ "Standard Car": 9500, "Seven-Seater": 13500 }`; `interface FareQuote { basePence: number; discountPence: number; totalPence: number }`; `quoteFare(vehicleLabel: string): FareQuote | null` (`discountPence = Math.round(base*15/100)`); `formatGbp(pence: number): string` → `"£114.75"`.
- `checkoutValidation.ts`: `CHECKOUT_MESSAGES = { phoneRequired: "Phone number is required.", phoneFormat: "Check telephone number format (e.g. +44 7...).", agreeRequired: "Please confirm you have reviewed the fare." } as const`; `normalizePhone(v: string): string` (trim, strip spaces `-` `(` `)`); `validateNotifyPhone(v?: string): string` — empty → `phoneRequired`; normalized must match `/^\+?\d{10,15}$/` else `phoneFormat`.

- [ ] **Step 1: Write failing checks** in `backend/scripts/unit-checkout.ts` importing `../../app/src/data/pricing` and `../../app/src/validation/checkoutValidation`:
```ts
assert.deepEqual(quoteFare("Seven-Seater"), { basePence: 13500, discountPence: 2025, totalPence: 11475 });
assert.deepEqual(quoteFare("Standard Car"), { basePence: 9500, discountPence: 1425, totalPence: 8075 });
assert.equal(quoteFare("Bus"), null);
assert.equal(formatGbp(11475), "£114.75");
assert.equal(validateNotifyPhone(""), "Phone number is required.");
assert.equal(validateNotifyPhone("+44 7700 900123"), "");
assert.equal(validateNotifyPhone("07700 900123"), "");
assert.equal(validateNotifyPhone("(+44) 7700-900-123"), ""); // normalizes to +447700900123
assert.equal(validateNotifyPhone("+44 7700 ABC89"), "Check telephone number format (e.g. +44 7...).");
assert.equal(validateNotifyPhone("12345"), "Check telephone number format (e.g. +44 7...).");
console.log("unit-checkout: all PASS");
```
- [ ] **Step 2:** `cd backend && npx tsx scripts/unit-checkout.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement both modules per Interfaces. Header comment in Vietnamese like sibling files.
- [ ] **Step 4:** Re-run → `unit-checkout: all PASS`. `cd ../app && npm run typecheck` → 0.
- [ ] **Step 5:** Commit `feat(checkout): shared fare quote and notify-phone validation`.

---

### Task 2: Booking payment columns + GET / pay API

**Files:**
- Create: `backend/src/services/checkoutService.ts`
- Create: `backend/src/validation/checkout.ts` (zod `PayBookingBody = z.object({ phone: z.string().default("") })`)
- Modify: `backend/src/routes/customerBookings.ts` (add 2 routes, keep existing)
- Modify: `backend/sql/001_schema.sql` (add the 6 columns inside `CREATE TABLE bookings`)
- Modify: `backend/scripts/smoke-test.mjs` (append checks after the saved-trip block, ~line 126)

**Interfaces:**
- Consumes: `quoteFare`, `validateNotifyPhone`, `normalizePhone` (Task 1); `sendEmail`, `emailSettings` (`backend/src/email/index.js`); `isReservedTestEmail` (`emailVerificationService.js`); `AppError`, `validationError` (`errors.js`).
- Produces:
  - `ensureBookingPaymentColumns(): Promise<unknown>` — memoised like `ensureTable()` in `passwordResetService.ts`: if `information_schema.COLUMNS` has no `bookings.status` (TABLE_SCHEMA = DATABASE()) run one `ALTER TABLE bookings ADD COLUMN status ENUM('SAVED','PAID') NOT NULL DEFAULT 'SAVED', ADD COLUMN fare_pence INT UNSIGNED NULL, ADD COLUMN discount_pence INT UNSIGNED NULL, ADD COLUMN notify_phone VARCHAR(30) NULL, ADD COLUMN payment_ref VARCHAR(20) NULL, ADD COLUMN paid_at DATETIME NULL`; reset memo on error.
  - `interface CheckoutBooking extends Booking { status: "SAVED" | "PAID"; fare: FareQuote; notifyPhone: string | null; paymentRef: string | null; paidAt: string | null; cardLast4: string | null; customerPhone: string | null }` (`Booking` from `customerEnquiryService.ts`). `fare` = frozen columns when PAID (`base = fare_pence + discount_pence`), else `quoteFare(vehicle_size)`.
  - `getCheckoutBooking(customerId: number, ref: string): Promise<CheckoutBooking>` — `WHERE b.booking_ref = ? AND b.customer_id = ?`, join `customers` for `card_last4`, `phone`; none → `new AppError("NOT_FOUND", "Booking not found.")`.
  - `payBooking(customerId: number, ref: string, phone: string): Promise<{ booking: CheckoutBooking; emailSent: boolean }>` — validate phone (`validationError({ phone: msg }, msg)`); PAID → return `{ booking, emailSent: false }`; else `UPDATE … SET status='PAID', fare_pence=?, discount_pence=?, notify_phone=?, payment_ref=?, paid_at=UTC_TIMESTAMP() WHERE id=? AND status='SAVED'` with `payment_ref = "TXN-" + randomInt(10000,100000)`; if `affectedRows === 0` (raced) re-read and return. Then email (subject `Your PrivateHire Cars booking ${ref} is confirmed`, body: amount `formatGbp`, route, UK date/time, payment ref); skip real send for `isReservedTestEmail` like `passwordResetService`; `emailSent = result.ok`; never throw on email failure.
  - Routes: `GET /api/customer/bookings/:ref` → `{ booking }`; `POST /api/customer/bookings/:ref/pay` body `{ phone }` → `{ booking, emailSent }`.
  - Call `ensureBookingPaymentColumns()` first in both service functions and in `createCustomerBooking` is **not** needed (INSERT relies on defaults).

- [ ] **Step 1: Failing smoke checks** (use the existing `alex`/`emily` clients and `check()`; `savedTripId`'s ref from the save-trip response — store it as `savedTripRef`):
```js
r = await alex("GET", `/customer/bookings/${savedTripRef}`);
check("checkout: GET own booking → SAVED with live quote", r.status === 200 && r.json.booking.status === "SAVED" && r.json.booking.fare.totalPence > 0, JSON.stringify(r.json));
r = await emily("GET", `/customer/bookings/${savedTripRef}`);
check("checkout: other customer's booking → 404", r.status === 404);
r = await alex("GET", "/customer/bookings/PHC-00000");
check("checkout: unknown ref → 404", r.status === 404);
r = await alex("POST", `/customer/bookings/${savedTripRef}/pay`, { phone: "+44 7700 ABC89" });
check("checkout: bad phone → 400 phone", r.status === 400 && r.json.error.fields?.phone === "Check telephone number format (e.g. +44 7...).", JSON.stringify(r.json));
r = await emily("POST", `/customer/bookings/${savedTripRef}/pay`, { phone: "+44 7700 900123" });
check("checkout: pay someone else's booking → 404", r.status === 404);
r = await alex("POST", `/customer/bookings/${savedTripRef}/pay`, { phone: "+44 7700 900123" });
const paid = r.json.booking;
check("checkout: pay → PAID, TXN ref, fare frozen", r.status === 200 && paid.status === "PAID" && /^TXN-\d{5}$/.test(paid.paymentRef) && paid.fare.totalPence === paid.fare.basePence - paid.fare.discountPence, JSON.stringify(r.json));
r = await alex("POST", `/customer/bookings/${savedTripRef}/pay`, { phone: "+44 7700 900123" });
check("checkout: pay again → same paymentRef", r.status === 200 && r.json.booking.paymentRef === paid.paymentRef && r.json.emailSent === false);
```
  The saved trip in the smoke test is a Seven-Seater? Check its body; assert `fare.totalPence === 11475` if it is, `8075` if Standard Car.
- [ ] **Step 2:** `cd backend && npm run smoke` → new checks FAIL (404 route).
- [ ] **Step 3:** Implement per Interfaces; schema file gets the 6 columns after `vehicle_size`.
- [ ] **Step 4: Migration check** — the smoke reset builds from `001_schema.sql`, which already has the columns, so the runtime ALTER path is not exercised. To exercise it: temporarily remove the 6 new lines from your working copy of `001_schema.sql`, run `npm run smoke` (PASS means the ALTER ran), put the lines back, run smoke again. Never run any ALTER/DROP by hand, never touch the production DB.
- [ ] **Step 5:** `npm run smoke` → all PASS; `npm run typecheck` → 0; `docker compose restart backend`.
- [ ] **Step 6:** Commit `feat(checkout): store fare and payment on bookings, GET and pay endpoints`.

---

### Task 3: Enquiry backend — contact, category, trip snapshot

**Files:**
- Modify: `app/src/validation/enquiryValidation.ts` (add only)
- Modify: `backend/src/validation/enquiries.ts` (`CreateEnquiryBody` add optional fields)
- Modify: `backend/src/services/customerEnquiryService.ts` (`createEnquiry`)
- Modify: `backend/src/services/staffEnquiryService.ts` (`getEnquiryDetail` select + DTO), `web/src/types.ts`, `web/src/pages/EnquiryDetailPage.tsx` or `web/src/features/enquiries/InfoCards.tsx` (show new fields)
- Modify: `backend/sql/001_schema.sql`, `backend/scripts/smoke-test.mjs`, `backend/scripts/unit-checkout.ts`

**Interfaces — Produces:**
- In `enquiryValidation.ts` (existing exports unchanged):
  - `interface TripSnapshot { pickupLocation: string; destination: string; journeyDate: string; journeyTime: string; passengerCount: number; vehicleSize: string }`
  - `EnquiryForm` gains optional `contactName?: string; contactEmail?: string; contactPhone?: string; category?: string; tripSnapshot?: TripSnapshot | null` (so `EnquiryErrors` keys grow automatically).
  - `ENQUIRY_CONTACT_MESSAGES = { fullNameRequired: "Full name is required", emailInvalid: "Please enter a valid email address (e.g. name@example.com)", categoryRequired: "Please select an enquiry category", bannerTitle: "SUBMISSION BLOCKED: ALL REQUIRED FIELDS REQUIRE ATTENTION" } as const`
  - `ENQUIRY_CATEGORIES = { GENERAL: [...6 from spec §10], TRIP: [...6 from spec §10] } as const`
  - `validateEnquiryContact(form: EnquiryForm): EnquiryErrors` — contactName empty → `fullNameRequired`, else `validateName(v)` from `rules.ts`; contactEmail empty or `validateEmail` fails → `emailInvalid`; contactPhone filled → `validateNotifyPhone`; category not in `ENQUIRY_CATEGORIES[type]` → `categoryRequired`.
  - `validateEnquiry` change (additive): the TRIP `bookingId` rule passes when `tripSnapshot` has non-empty pickup + destination. Same message otherwise.
- `createEnquiry`: when any of `contactName/contactEmail/category` is present run `validateEnquiryContact` too (merge errors). TRIP with `bookingId` → ownership check unchanged; TRIP without → store `trip_snapshot` JSON. Insert new columns (`contact_name, contact_email, contact_phone, category, trip_snapshot`). `ensureEnquiryContactColumns()` memoised, same pattern as Task 2, columns: `contact_name VARCHAR(100) NULL, contact_email VARCHAR(254) NULL, contact_phone VARCHAR(30) NULL, category VARCHAR(80) NULL, trip_snapshot JSON NULL`.
- Staff detail DTO gains `contactName, contactEmail, contactPhone, category, tripSnapshot` (all nullable).

- [ ] **Step 1: Failing checks.** unit-checkout.ts: `validateEnquiryContact({type:"TRIP", bookingId:null, subject:"", message:"", contactName:"", contactEmail:"x", category:""})` deep-equals the three new messages on `contactName`, `contactEmail`, `category`. Smoke: (a) old body `{type:"TRIP", bookingId: emilyBooking.id, …}` still → 400 with `"Choose the trip this enquiry is about."` (existing check, untouched); (b) TRIP with `tripSnapshot` and no bookingId, contact + category `"Route Planning & Waiting Time"`, subject = category, message ≥ 20 chars → 201; (c) same with `contactName:""` → 400 `fields.contactName === "Full name is required"`; (d) staff detail of (b) returns `category` and `tripSnapshot.pickupLocation`.
  Watch existing count checks (e.g. "Alex: 5" enquiries, "ENQ-000009 on top"): place new enquiry creations **after** those checks so they keep passing.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `npx tsx scripts/unit-checkout.ts`, `npm run smoke`, typecheck backend/app/web → all green.
- [ ] **Step 5:** Commit `feat(enquiry): contact, category and planned-trip snapshot`.

---

### Task 4: App services, routes, Price Review (05 / 08)

**Files:**
- Modify: `app/src/services/support.ts` (add types + 3 functions; update AC-15 comment on `saveTrip`)
- Create: `app/src/components/checkout/CheckoutUi.tsx` (`CheckoutHeader`, `Stepper`, `FareRow` — used only by checkout pages)
- Create: `app/src/pages/checkout/PriceReviewPage.tsx`
- Modify: `app/src/App.tsx` (routes + header comment; add only)

**Interfaces:**
- Produces (support.ts): `interface CheckoutBooking` mirroring Task 2 (import `FareQuote` from `../data/pricing`); `getBooking(ref: string) => call<{ booking: CheckoutBooking }>(\`/bookings/${encodeURIComponent(ref)}\`)`; `payBooking(ref: string, phone: string) => call<{ booking: CheckoutBooking; emailSent: boolean }>(…/pay, POST)`. Extend `SupportResult` fields type only if needed (`fields?: Record<string,string>` compatible).
- `CheckoutHeader({ title: string; subtitle?: string; onBack: () => void })` — back arrow, `BrandLogo`, title/subtitle, avatar (initials), × → `/home`.
- `Stepper({ items: string[]; current: number })` — labels passed per screen exactly as drawn.
- Routes (all `<RequireAuth>`): `/checkout/:ref/price` PriceReviewPage, `/checkout/:ref/edit` EditJourneyPage (Task 5), `/checkout/:ref/notify` NotificationPage, `/checkout/:ref/success` PaymentSuccessPage (Task 6), `/receipt/:ref` ReceiptPage, `/receipt/:ref/print` ReceiptPrintPage (Task 7). Until a page exists, do not add its route.
- PriceReviewPage state rules: loading → skeleton; 404 → "Booking not found" + "Back to Home"; `status === "PAID"` → `<Navigate to={/checkout/${ref}/success} replace />`. sessionStorage key `phc_last_quote` = `{ ref, totalPence }`: read before writing; if stored ref ≠ current ref and total differs → "updated" variant (08: badge "Parameters Changed", "UPDATED", "Previous Total (Reference)" struck through, "DELTA VIEW"); else 05 variant ("15% APPLIED", "DISCOUNT VIEW"). Then write current. Checkbox label includes `formatGbp(total)`; Continue disabled until ticked → `/checkout/${ref}/notify`. Change Details → `/checkout/${ref}/edit`; Change Vehicle → `/vehicle`; Cancel Journey → `/home`.
- testids (new): `price-review-page`, `fare-total`, `agree-fare`, `continue-to-payment`.

- [ ] **Step 1:** `ui-skills-root`, then build page to match `05…png` and `08…png`.
- [ ] **Step 2:** typecheck 0. In browser (390 px): log in demo, go to an available trip, open `/checkout/<ref>/price` by URL → numbers £135.00 / -£20.25 / £114.75 for Seven-Seater; reload keeps state; `/checkout/PHC-00000/price` → Booking not found.
- [ ] **Step 3:** `baseline-ui`, `fixing-accessibility` (checkbox label, button disabled state).
- [ ] **Step 4:** selftest still 15/15. Commit `feat(checkout): price review screen`.

---

### Task 5: Edit Journey (05A)

**Files:** Create `app/src/pages/checkout/EditJourneyPage.tsx`; Modify `app/src/App.tsx`.

**Interfaces:** Consumes `getBooking`, `saveTrip` (support.ts), `useBooking()` (`setJourneyDetails`), `DESTINATION_SUGGESTIONS` / `PICKUP_SUGGESTIONS` (`app/src/data`), journey validation in `app/src/validation/journeyValidation.ts` (use its pickup/destination functions — grep for exact names). Produces nothing for others.

Behaviour: fields prefilled from the booking; date/time, vehicle, passengers read-only (lock icons). "1 Modified" = count of changed location fields; chips "Unchanged"/"Active Editing"; "Valid postal address recognized · Original: <old value>" when destination changed and valid. Map: `<iframe title="Route map" src="https://www.openstreetmap.org/export/embed.html?bbox=-2.35,53.33,-2.15,53.50&layer=mapnik" loading="lazy">` with overlay chips "Approx. 9.8 miles (24 mins)" (mock) and "Recalculating" while saving. **Save & Recalculate Fare**: validate → `setJourneyDetails({ pickupLocation, destination })` → `saveTrip({ serviceName, pickupLocation, destination, journeyDate, journeyTime, passengerCount, vehicleSize })` using the booking's values (vehicle key: map label back via `"Seven-Seater" → "seven-seater"`, `"Standard Car" → "standard"`; journeyDate/Time from the booking's UK time) → `navigate(/checkout/${newRef}/price)`. Cancel Changes → back to price. testids: `edit-journey-page`, `save-recalculate`.

Note the PNG shows "Eight-Seater Executive Van (8 Seats)" — sample data; show the booking's real vehicle.

- [ ] **Step 1:** `ui-skills-root`; build to match `05A…png`.
- [ ] **Step 2:** Browser: change destination to a quick pick → Save → lands on new ref's price page in the 08 "updated" variant (different ref; if the total is equal the 05 variant is correct).
- [ ] **Step 3:** `baseline-ui`, `fixing-accessibility`. typecheck, selftest 15/15. Commit `feat(checkout): edit journey locations`.

---

### Task 6: Notification (01 / 02 / 03) + Payment Successful (04-pay)

**Files:** Create `app/src/pages/checkout/NotificationPage.tsx`, `app/src/pages/checkout/PaymentSuccessPage.tsx`; Modify `app/src/App.tsx`.

**Interfaces:** Consumes `getBooking`, `payBooking`, `validateNotifyPhone`, `CHECKOUT_MESSAGES`, `getCurrentUser()` (guest name).

NotificationPage: `step: "choose" | "phone"`. Paid booking → redirect to success. "choose" (01): radio "Send Message to +44 ••••<last 3 digits of customerPhone>" (default, disabled+hidden text "No phone on file" if none → default to "Change number") and "Change number / phone"; NEXT → "phone". "phone" (02/03): input prefilled with `customerPhone` when first option chosen; VALID chip when valid; on blur (if non-empty) and on Next run `validateNotifyPhone`; error UI = 03 (red border, (!), `"ERROR: " + message`, helper text, "Example standard format" button sets `+44 7700 900123`); typing clears error. Next → `payBooking`; while pending button text "Processing payment…" + disabled (prevents double submit); server `fields.phone` shown the same way; success → `navigate(/checkout/${ref}/success, { state: { emailSent } })`. "Back to Options" → "choose". Copy header/step labels per PNG ("Step 2 of 4", "STEP 2 OF 3", "Step 3 of 4" — exactly as drawn on each state).

PaymentSuccessPage (04-pay): unpaid → redirect to price. Shows amount, "AUTHORISED & CAPTURED", Amount Paid, Transaction Ref (`paymentRef`), Booking Reference, Payment Date & Time (`formatUkDateTime(paidAt)`), email row: `location.state?.emailSent === false` → "PENDING", otherwise "SENT" (a reload has no state; the booking is paid, so the email was attempted), SMS row "SENT" with code comment `// shortcut: SMS is not really sent; add an SMS provider if the client wants real texts.`, VIEW RECEIPT and "Go to booking detail" → `/receipt/${ref}`, "Return to Dashboard / New Booking" → `clearBooking()` then `/home`. Card row text: `Card ending •••• ${cardLast4}`.

testids: `notification-page`, `notify-next`, `notify-phone` (input id `notifyPhone`, error id `notifyPhone-error`), `payment-success-page`, `payment-ref`, `view-receipt`.

- [ ] **Step 1:** `ui-skills-root`; build both to match `01`, `02`, `03`, `04. Payment Successful…png`.
- [ ] **Step 2:** Browser: invalid `+44 7700 ABC89` shows 03 state; valid → success page with PHC ref; back button then Next again → still same TXN (idempotent); reload success page works.
- [ ] **Step 3:** `baseline-ui`, `fixing-accessibility` (`aria-invalid`, `aria-describedby`, `role="alert"`, radio group). typecheck, selftest 15/15. Commit `feat(checkout): notification preferences and payment confirmation`.

---

### Task 7: Receipt (14) + Print preview (15)

**Files:** Create `app/src/pages/checkout/ReceiptPage.tsx`, `app/src/pages/checkout/ReceiptPrintPage.tsx`, `app/src/components/checkout/QrMark.tsx` (static decorative SVG, `aria-hidden`); Modify `app/src/App.tsx`, `app/src/index.css` (add a `@media print` block only).

Both: unpaid → redirect to price; 404 → Booking not found. Data: booking + `getCurrentUser()` (name, email), initials avatar, pax, UK date/time, route, vehicle, fare rows exactly as drawn (base "<vehicle> Base Tariff", "Online Booking Discount (15%)", Airport Drop-off "Included (£0.00)", Meet & Greet "Standard (£0.00)", "Zero-Rated Passenger VAT £0.00"), total, "Paid via Card ending •••• last4", carrier footer text as drawn. Receipt number on 14/15: `REC-` + booking ref digits. Copy button → `navigator.clipboard.writeText(bookingRef)` with "Copied" feedback. 14 buttons: PRINT OFFICIAL RECEIPT → `/receipt/${ref}/print`; RETURN TO BOOKING CONFIRMATION → `/checkout/${ref}/success`; printer icon in header → print page. 15: Print + "Print Receipt" + Download → `window.print()`; Share → `navigator.share({ title, url })` if available else clipboard; toolbar has class `print:hidden`. testids: `receipt-page`, `receipt-total`, `print-receipt`, `receipt-print-page`.

- [ ] **Step 1:** `ui-skills-root`; build to match `14…png` and `15…png`.
- [ ] **Step 2:** Browser: totals equal Price Review; Ctrl+P preview shows only the receipt.
- [ ] **Step 3:** `baseline-ui`, `fixing-accessibility`. typecheck, selftest. Commit `feat(checkout): receipt and print preview`.

---

### Task 8: Availability "View Price" (04)

**Files:** Modify `app/src/pages/AvailabilityPage.tsx` (AVAILABLE branch only; add, don't remove).

- Keep the existing `useEffect` but store the result: `const [savedRef, setSavedRef] = useState<string | null>(null)`; `saveTrip(...).then(r => r.ok && setSavedRef(r.data.booking.bookingRef))`. Declare the state **before** any early return.
- Add the drawn 04 blocks inside the AVAILABLE branch, keeping all current elements and testids: "CHECK VEHICLE AVAILABILITY" + Confirmed chip + info line, journey summary card with Change Journey Details / Change Vehicle Size, confirmed-category card (vehicle label + "Mercedes V-Class or premium equivalent" for Seven-Seater / a saloon text for Standard Car), photo block (reuse an existing vehicle image from `VehicleSizePage`; grep its `src`), capacity + luggage, "Fleet inventory active: 3 vehicles ready for slot", Allocated Driver (provisional) mock card with Call Driver (`tel:+447700900542`) / SMS (`sms:+447700900542`), Indicative Rate "£XX.XX" + "15% Promo Eligible", **View Price** button (`data-testid="view-price"`, disabled until `savedRef`) → `/checkout/${savedRef}/price`, Cancel → `/home`.
- Update line-6 comment (AC-15 no longer applies) — comment text only.

- [ ] **Step 1:** `ui-skills-root`; build to match `04. Check Vehicle Availability - View Price.png`.
- [ ] **Step 2:** Run team tests via temp copies without `executablePath: CHROME_PATH,` (see HANDOFF.md): scrum16/17/18 must PASS. If scrum18 fails because of this change → stop, report the failing assertion to Bao (do not edit team tests).
- [ ] **Step 3:** `baseline-ui`. typecheck, selftest 15/15. Commit `feat(availability): view price entry to checkout`.

---

### Task 9: Enquiry wizard + Profile row

**Files:** Modify `app/src/pages/SupportPage.tsx` (may split new step UIs into `app/src/pages/support/*.tsx`), `app/src/services/support.ts` (`sendEnquiry` body type gains optional fields), `app/src/pages/ProfilePage.tsx` (add one row).

- Profile: add an "Enquiries & Support" row (icon, title, subtitle "Ask questions about our services or your trip", blue dot, highlighted cyan style from `S95 - Enquiries & Support (Profile).png`) above the Log Out button → `/support`. testid `profile-enquiries`. Nothing else on Profile changes.
- SupportPage: `step: "type" | "form" | "success"`. Keep existing data loading, "my enquiries" list, signed-out handling and all existing testids (if an existing element no longer fits a step, keep it rendered in the most fitting step — never delete).
  - type (S95-01): header, 4 tabs (Type/Details/Contact/Summary), two cards, Continue (disabled until chosen), Cancel / Return → `/profile`.
  - form GENERAL (S95-02) / TRIP (S95-03): fields `contactName` (prefill `user.fullName`), `contactEmail` (prefill `user.email`), `contactPhone` (prefill `user.phone ?? ""`), `category` select with placeholder "Select an enquiry category…" + `ENQUIRY_CATEGORIES[type]`, message textarea (`maxLength` 1000 GENERAL, 500 TRIP; counter `n / 1000 characters` / `n / 500`). TRIP context: "Journey Planning (No Confirmed Booking Yet)" (default) showing the BookingContext trip card (Edit → `/journey`, Change → `/vehicle`); if `bookings.length > 0` also a second option "Existing booking" with the current trip picker. Submit body: `subject = category`; TRIP planning → `tripSnapshot` from BookingContext, `bookingId: null`; TRIP existing → `bookingId`. TRIP empty details → send `message = \`${category} — no additional details.\`` (keeps the existing ≥20-char server rule; comment why).
  - errors (S95-04): client runs `validateEnquiry` + `validateEnquiryContact`; on errors show red banner (title `ENQUIRY_CONTACT_MESSAGES.bannerTitle`, one line per error), "[ ERROR DETECTED ]" chip, "[ REQUIRED - MISSING ]" / "[ ACTION REQUIRED ]" / "[ REQUIRED - UNSELECTED ]" tags, red fields with (!), waiting-time policy note (TRIP). Server `fields` displayed the same way.
  - success (S95-06): ENQ code + copy, timestamp (`formatUkDateTime`), summary, Return to Home / Dashboard → `/home`, Submit Another Enquiry → reset to "type".
- testids (new): `enquiry-type-continue`, `enquiry-submit`, `enquiry-success`, `enquiry-code`; input ids `contactName`, `contactEmail`, `contactPhone`, `category`, `enquiryMessage` with `-error` ids.

- [ ] **Step 1:** `ui-skills-root`; build each step to match S95, S95-01, 02, 03, 04, 06.
- [ ] **Step 2:** Browser: Profile → Enquiries & Support → General → submit empty → S95-04 state with the 3 drawn messages; fill → success with ENQ code; Trip (planning) → success; Staff Portal (5174) shows contact + category + trip.
- [ ] **Step 3:** `baseline-ui`, `fixing-accessibility`. typecheck app/web, selftest 15/15, smoke PASS. Commit `feat(enquiry): S95 wizard and profile entry`.

---

### Task 10: Staff Portal payment rows

**Files:** Modify `backend/src/services/staffEnquiryService.ts` (booking select ~line 153: add `status, fare_pence`; call `ensureBookingPaymentColumns()` first), `web/src/types.ts` (`Booking` + `status?: "SAVED" | "PAID"; farePence?: number | null`), `web/src/features/enquiries/InfoCards.tsx` `TripCard` (add row "Payment": `Paid · £x.xx` / `Not paid`).

- [ ] **Step 1:** Add a smoke check: staff enquiry detail for a TRIP enquiry whose booking was paid in Task 2 returns `booking.status === "PAID"` (create that enquiry after the existing count checks).
- [ ] **Step 2:** implement; smoke PASS; web typecheck; browser check Staff Portal.
- [ ] **Step 3:** Commit `feat(staff): show payment status on trip card`.

---

### Task 11: End-to-end checkout script (new file, not protected)

**Files:** Create `app/scripts/test-checkout.mjs` (copy the launch/login/`expect` helpers style from `selftest.mjs`; viewport 430×932; default Playwright chromium, no `executablePath`).

Tests (each prints PASS/FAIL, exit 1 on any FAIL): login demo → services → pick a service → journey (fill valid future date/time + locations) → vehicle Seven-Seater 3 pax → availability AVAILABLE → `view-price` enabled → price shows `£114.75` → Continue disabled until `agree-fare` → notify: type `+44 7700 ABC89` → error text `ERROR: Check telephone number format (e.g. +44 7...).` → `+44 7700 900123` → success page `PHC-` → `view-receipt` → `receipt-total` `£114.75` → open `/checkout/<ref>/price` → redirected to success → `/checkout/PHC-00000/price` → "Booking not found" → Profile → `profile-enquiries` → General → empty submit shows 3 drawn messages → fill → `enquiry-code` starts `ENQ-`. Use `page.goto` + sessionStorage the same way selftest does where the UI path is slow.

- [ ] **Step 1:** write; run `cd app && node scripts/test-checkout.mjs` → all PASS (fix the app, not the test, on failure).
- [ ] **Step 2:** Commit `test(checkout): end-to-end checkout and enquiry script`.

---

### Task 12: AC-15 replacement + docs (protected — needs Bao)

**Files:** `app/scripts/selftest.mjs` (AC-15 block ~line 296), `AGENTS.md:45`, `PROJECT_CONTEXT.md` (lines 22, 94, 231 + routes table §5), `.agents/rules/01-scope-and-protected-files.md:13`, `.agents/rules/02-workflow-and-verification.md:45`, `README.md:47`, `fe/README.md` (202/355/364/385/401), `DEMO_SCRIPT.md:44`, `HANDOFF.md:29`, comments `app/src/services/support.ts:67`, `backend/src/validation/bookings.ts:2`.

- [ ] **Step 1:** Prepare the selftest diff: keep id `"AC-15"`, new title `"Checkout: Price → Payment → Receipt"`; body = the shortest path from Task 11 (price → agree → notify valid phone → success shows `PHC-` → receipt shows `£`). Show the exact diff to Bao and **stop until Bao writes "allowed" / "duyệt"**.
- [ ] **Step 2:** After approval apply it; run `npm run selftest` → 15/15.
- [ ] **Step 3:** Prepare doc edits (replace "no Booking Confirmation / Payment" wording with the new checkout routes; add checkout + enquiry demo steps to DEMO_SCRIPT). Show the diff to Bao, apply only on approval.
- [ ] **Step 4:** Commit `docs: AC-15 now covers checkout; demo steps`.

---

### Task 13: Final verification + report

- [ ] **Step 1:** `cd app && npm run typecheck && npm run build`; `cd ../backend && npm run typecheck && npx tsx scripts/unit-checkout.ts && npm run smoke`; `cd ../web && npm run typecheck`; `cd ../app && npm run selftest` (15/15) `&& node scripts/test-checkout.mjs`; scrum16/17/18 temp copies PASS.
- [ ] **Step 2:** Browser walk at 390 px through every new PNG side by side; console has no red errors.
- [ ] **Step 3:** `git diff --stat` since checkpoint: confirm no deleted lines in protected files except the approved ones, no deleted testids (`git diff | grep '^-.*data-testid'` → empty).
- [ ] **Step 4:** Report to Bao in Vietnamese (AGENTS.md §7) with real command output. Ask before push / production deploy (production needs `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --no-deps web backend`; never recreate the tunnel).
