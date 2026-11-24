# Checkout (Price → Notification → Payment → Receipt) + Enquiry wizard — design

Date: 2026-11-24 · Branch: `release/v2` · Figma: file `ZlW5p7so2ld9LCCpxT5XxY`, sections 539-525 (72), 539-527 (77),
539-533 (88), 539-531 (90), 539-529 (83), 539-535 (95). Reference PNGs: `D:\Downloads\anh\` (names below).

## 1. Intent

Bao's team must demo a **complete booking journey** to the team lead: after "Vehicle available" the customer sees a price,
picks how to be notified, pays, gets a confirmation and a receipt. Enquiries must match the S95 Figma flow.
AC-15 ("no Booking Confirmation / Payment") is **dropped** by the user. Approach **B** chosen: price + payment status are
**stored in MySQL**, so a reload or the Staff Portal sees the paid trip.

## 2. Goals / non-goals / anti-goals

Goals
- Screens 04, 05, 08, 01, 02, 03, Payment Successful (04-pay), 14, 15, S95, S95-01…S95-06 built at 390 px, matching the PNGs.
- Fare computed **on the server** (client cannot set the price). Paid state, payment ref, notify phone stored in `bookings`.
- Every existing check still passes: `npm run typecheck`, `npm run selftest` (15/15 with the new AC-15), `backend npm run smoke`,
  `app/scripts/test-scrum16/17/18.mjs`.

**Rule from Bao: the Figma design is fixed.** Every screen, field, button, label and text in the PNGs is built as drawn —
nothing skipped, simplified or replaced. Shortcuts are allowed only behind the UI (backend/mock data), never in what the
user sees. Sample values in the PNGs (names, addresses, £ amounts, plate numbers) are replaced by real data where the app
has it; fixed company texts (carrier footer, VAT reg, licence, dispatch phone) are copied as drawn.

Behind-the-UI shortcuts (allowed)
- No card-entry screen exists in Figma, so none is added. "Pay" charges the card registered at sign-up (`customers.card_last4`).
- No real payment provider, no real SMS. SMS row shows "SENT" as drawn (code comment `shortcut:`). Email is real.
- Driver card on 04 (name, rating, licence, phone, car, plate) is mock data; Call / SMS buttons are `tel:` / `sms:` links.
- Map on 05A: OpenStreetMap embed (`<iframe>` openstreetmap.org/export/embed, no key, no package) centred on Manchester;
  "Approx. x miles (y mins)" from a mock distance table. QR codes on 15: static inline SVG (decorative).
- Status bar "9:41" drawn in S95 PNGs is device chrome, not rendered (same as every existing screen).

Anti-goals (failure even if it "works")
- Price taken from the request body. Full card number / CVV stored. A customer reading or paying another customer's booking.
- Breaking the production DB (existing rows must survive; migration is additive only).
- Changing any existing `data-testid`, `data-node-id`, validation message string, or `src/screens/**`.

## 3. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| A | Frontend only (sessionStorage) | Zero DB risk, but paid state lost on new tab; Staff Portal blind. |
| **B (picked by user)** | Add columns to `bookings`, server computes fare, `pay` endpoint | Real persistence + Staff Portal sees it; needs an additive ALTER on prod. |
| C | New `payments` table | Cleaner for refunds/multiple payments — nobody needs that in a prototype. Rejected. |

## 4. Flow and routes (all `RequireAuth`, add to `app/src/App.tsx` + header comment)

```
/availability (AVAILABLE, screen 04 "View Price")
   └─ View Price ──► /checkout/:ref/price        PriceReviewPage   (05; 08 when the quote changed)
                        ├─ Change Details ─► /checkout/:ref/edit   EditJourneyPage (05A)
                        │                      Save & Recalculate Fare ─► new saved trip ─► /checkout/:newRef/price (08)
                        ├─ Change Vehicle ─► /vehicle
                        └─ Continue to Payment (checkbox ticked) ─► /checkout/:ref/notify
/checkout/:ref/notify   NotificationPage  (01 choose channel → 02 phone → 03 invalid phone)
   └─ Next (valid) ─► POST pay ─► /checkout/:ref/success
/checkout/:ref/success  PaymentSuccessPage (04-pay = "Booking Confirmed", SCRUM-90)
   ├─ View Receipt / Go to booking detail ─► /receipt/:ref
   └─ Return to Dashboard ─► /home  (clearBooking())
/receipt/:ref           ReceiptPage (14)   ── Print Official Receipt ─► /receipt/:ref/print
/receipt/:ref/print     ReceiptPrintPage (15) ── Print button = window.print()
```
`:ref` is the existing `booking_ref` (e.g. `PHC-24051`). Unpaid booking opened at `/success` or `/receipt` → redirect to
`/checkout/:ref/price`. Paid booking opened at `/price` or `/notify` → redirect to `/checkout/:ref/success`.
Unknown / someone else's ref → 404 from API → page shows "Booking not found" + button to `/home`.

## 5. Data and backend

### 5.1 Pricing — new `app/src/data/pricing.ts` (shared by app + backend, like `validation/*`)
```ts
export const ONLINE_DISCOUNT_PERCENT = 15;
// keyed by the label stored in bookings.vehicle_size (VEHICLES[..].label in backend/src/validation/bookings.ts)
export const BASE_FARE_PENCE: Record<string, number> = { "Standard Car": 9500, "Seven-Seater": 13500 }; // £95 / £135 (Figma: £135 → £114.75)
export function quoteFare(vehicleSize: string): { basePence: number; discountPence: number; totalPence: number } | null
//   discountPence = Math.round(base * 15 / 100); totalPence = base - discountPence; unknown size → null
export const formatGbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
```
Verified: `createCustomerBooking` stores `VEHICLES[b.vehicleSize].label`. Smoke test asserts "Seven-Seater" → 13500 / 2025 / 11475.

### 5.2 Schema — `backend/sql/001_schema.sql` (new installs) + runtime migration (prod)
Add to `bookings`:
```sql
status        ENUM('SAVED','PAID') NOT NULL DEFAULT 'SAVED',
fare_pence    INT UNSIGNED NULL,   -- frozen at payment time
discount_pence INT UNSIGNED NULL,
notify_phone  VARCHAR(30)  NULL,
payment_ref   VARCHAR(20)  NULL,   -- e.g. TXN-48213
paid_at       DATETIME     NULL    -- UTC
```
Prod DB already exists → memoised `ensureBookingPaymentColumns()` (same pattern as `ensureTable()` in
`passwordResetService.ts`): query `information_schema.COLUMNS` for `bookings.status`; if missing run **one**
`ALTER TABLE bookings ADD COLUMN … , ADD COLUMN …`. Reset the memo on error. Call it at the top of every function that
reads/writes these columns (customer + staff services). Additive only — existing rows become `SAVED`.

### 5.3 Validation — new `app/src/validation/checkoutValidation.ts`
```ts
export const CHECKOUT_MESSAGES = {
  phoneRequired: "Phone number is required.",
  phoneFormat: "Check telephone number format (e.g. +44 7...).",   // Figma 03 text without "ERROR: " prefix (prefix is UI)
  agreeRequired: "Please confirm you have reviewed the fare.",
} as const;
export function validateNotifyPhone(v?: string): string
//   trim; empty → phoneRequired; strip spaces, "-", "(", ")"; allow one leading "+"; rest must be 10–15 digits → else phoneFormat
```
Do **not** change `validatePhone` in `rules.ts` (registration messages are a requirement).

### 5.4 API (`backend/src/routes/customerBookings.ts`, logic in `customerEnquiryService.ts` or a new `checkoutService.ts`)
- `GET /api/customer/bookings/:ref` → `{ booking: CheckoutBooking }` — own booking only, else 404 `NOT_FOUND`.
- `POST /api/customer/bookings/:ref/pay` body `{ phone }` (zod) →
  - `validateNotifyPhone` fail → 400 `validationError({ phone })`.
  - already `PAID` → 200 same booking (idempotent, no second email).
  - else in one UPDATE … WHERE id=? AND status='SAVED': set fare from `quoteFare` (server), `payment_ref = TXN-${randomInt(10000,100000)}`,
    `notify_phone`, `paid_at = UTC_TIMESTAMP()`, `status='PAID'`. Then send confirmation email with existing `sendEmail`
    (subject "Your PrivateHire Cars booking PHC-… is confirmed", amount, route, date; follow the enquiry-email pattern for
    test mode / reserved addresses). Email failure must **not** fail the payment; return `emailSent: boolean`.
  - → 200 `{ booking: CheckoutBooking, emailSent }`.
- `CheckoutBooking` = existing `Booking` fields + `status`, `fare: {basePence, discountPence, totalPence}` (frozen if PAID,
  else live `quoteFare`), `notifyPhone`, `paymentRef`, `paidAt`, `cardLast4` (join `customers`), `customerPhone`
  (registered phone, used to prefill screen 01/02).
- `GET /api/customer/bookings` list: unchanged shape (extra fields allowed but not required).

### 5.5 App service — `app/src/services/support.ts`
`getBooking(ref)`, `payBooking(ref, phone)` using the existing `call<>()` helper and `SupportResult` shape.
Update the AC-15 comment on `saveTrip`.

### 5.6 Staff Portal (small)
`web/src/types.ts` `Booking` + `staffEnquiryService.ts` select: add `status`, `farePence` (nullable). `TripCard` in
`web/src/features/enquiries/InfoCards.tsx`: two extra rows "Payment" (`Paid · £114.75` / `Not paid`) .

## 6. Screens (match PNG; reuse `AppBar`, `Icon`, `MobileFrame`, auth UI tokens; Inter; colours from rule 03)

Common checkout header (05/08/01/02/04/14): back arrow, logo, title + subtitle, avatar, close (×→`/home`).
Stepper `1 Route · 2 Vehicle · 3 Price · 4 Pay` — one small local component, reused on these pages only.

| Screen | PNG | Content / behaviour |
|---|---|---|
| Availability AVAILABLE | `04. Check Vehicle Availability - View Price.png` | Restyle the existing AVAILABLE state to this layout: "CHECK VEHICLE AVAILABILITY" + Confirmed, journey summary, change links, confirmed category card (vehicle name per `vehicleSize`), capacity/luggage, mock "Allocated driver (provisional)" card, "Indicative rate £XX.XX · 15% Promo Eligible", **View Price** (disabled until `saveTrip` returned the booking; navigates to `/checkout/:ref/price`), Cancel → `/home`. Keep every existing `data-testid` on this page; CHECKING/UNAVAILABLE states unchanged. |
| Price Review | `05. Price Review - 15% Discount Applied.png` | Journey summary, fare breakdown (original struck through, discount line, final amount, "You save"), agree checkbox (label includes amount), Continue to Payment disabled until ticked, Cancel Journey → `/home`. |
| Price Review – updated | `08. Updated Price Review - After Parameter Change.png` | Same page. Variant when sessionStorage `phc_last_quote` (`{ref,totalPence}`) holds a **different ref** with a different total: badge "Parameters Changed", "Previous Total" line struck through. Write `phc_last_quote` whenever Price Review loads. |
| Edit Journey | `05A. Edit Journey - Location Parameters.png` | Info banner, "Trip Configuration · Step 2 of 4" progress, map (OSM embed) + "Approx. … miles" + "Recalculating" chip, Location Parameters card: pickup (Unchanged / edit pencil, "Tap to edit"), destination (Active Editing, clear ×, "Valid postal address recognized · Original: …", Quick picks chips from `DESTINATION_SUGGESTIONS`), "1 Modified" counter. Locked Journey Parameters (date/time, vehicle class, passengers — read-only, lock icons) + note. 15% eligibility card. **Save & Recalculate Fare** → `saveTrip` with new locations (same date/vehicle/pax) → `/checkout/:newRef/price`; **Cancel Changes** → back to price. Locations validated with existing `journeyValidation`. |
| Notification – choose | `01. Notification Selection — SMS Selected.png` | Locked fare card (ref, guest name, route, vehicle, total). Radio: "Send Message to +44 •••• (last 3 digits of registered phone)" (default) / "Change number / phone". Next → step 02 (state in page, not a new route). |
| Notification – phone | `02. Contact Information — SMS Selected.png` | Phone input, prefilled with registered phone (if "Send Message" chosen) or empty (if "Change number"). VALID chip when `validateNotifyPhone` passes. Next → `payBooking`. "Back to Options" → step 01. While paying: button "Processing payment…" disabled. |
| Notification – invalid | `03. Contact Validation — SMS Invalid Format.png` | Same step, error state: red border, (!) icon, "ERROR: " + message, helper text, "Example standard format: Use +44 7700 900123" button fills the field. Format errors on blur and on Next; typing clears. |
| Payment Successful / Booking Confirmed | `04. Payment Successful — Receipt Dispatched.png` | Tick, amount, status "AUTHORISED & CAPTURED", amount / transaction ref / booking ref / paid date (UK time), "sent to email" row (SENT if `emailSent`, else "PENDING"), "sent to SMS" row (SENT — simulated), View Receipt, trip card, Go to booking detail → receipt, Return to Dashboard → `/home`. |
| Receipt | `14. Confirmed Booking Receipt – Digital View.png` | Paid & Confirmed, booking ref + Copy (`navigator.clipboard`), customer name/email/pax, date, pickup/destination, vehicle, fare breakdown (base, discount, £0.00 rows as in PNG), total, "Paid via card ending •••• {cardLast4}", Print Official Receipt → print page, Return to booking confirmation → success page, carrier footer text. |
| Receipt print | `15. Official Customer Receipt – Clean Print Preview.png` | Same data in the A4 layout, **all blocks as drawn** incl. "Verify official trip" QR card (static SVG), itemized tariff table, carrier notice, signature line. Print + Print Receipt → `window.print()`; Download → `window.print()` (browser "Save as PDF"); Share → `navigator.share` (fallback: copy link). `@media print` hides the toolbar. |

### Enquiry (SCRUM-95) — rework `app/src/pages/SupportPage.tsx` + small backend change
Every field in S95-02/03/04 is built as drawn, so the backend must store what the form collects.

Backend
- `enquiries` gets (additive, memoised `ensure…` like 5.2): `contact_name VARCHAR(100) NULL`, `contact_email VARCHAR(254) NULL`,
  `contact_phone VARCHAR(30) NULL`, `category VARCHAR(80) NULL`, `trip_snapshot JSON NULL`.
- TRIP enquiry no longer needs a saved booking ("Journey Planning (No Confirmed Booking Yet)" / "BOOKING NOT REQUIRED"):
  `bookingId` optional; when absent, `trip_snapshot` = {pickup, destination, date, time, passengers, vehicle} from
  BookingContext. Existing rule "TRIP needs bookingId" relaxed in backend service + zod only; the existing message string
  stays in the file (unused is fine).
- `subject` column keeps working: send `category` as subject too (existing 5–120 rule passes).
- Staff Portal enquiry detail shows contact name/email/phone, category and the trip snapshot when present.

Validation — new keys in `app/src/validation/enquiryValidation.ts` (existing strings untouched), texts copied from S95-04:
`fullNameRequired: "Full name is required"`, `emailInvalid: "Please enter a valid email address (e.g. name@example.com)"`,
`categoryRequired: "Please select an enquiry category"`, banner title "SUBMISSION BLOCKED: ALL REQUIRED FIELDS REQUIRE ATTENTION"
with the drawn banner lines. Phone optional; if filled, `validateNotifyPhone` format rule. Message: General required
(1000 max, counter "n / 1000 characters"); Trip "Details & Special Requests" optional (500 max, "n / 500").

| Screen | PNG | Build |
|---|---|---|
| Profile | `S95 - Enquiries & Support (Profile).png` | Row "Enquiries & Support" + dot, highlighted style as drawn, between Payment Details and Log Out → `/support`. Other rows unchanged. |
| Type | `S95-01 - Enquiry Type Selection.png` | Header "BACK · ROUTE ENQUIRY · × · avatar", 4-step tabs (1 Type · 2 Details · 3 Contact · 4 Summary), two cards with tags, Continue to Enquiry Form, Cancel / Return → `/profile`. |
| General form | `S95-02 - General Enquiry Form.png` | Editable Full Name / Email (prefilled from user) / Phone Number (prefilled registered phone), Enquiry Category select + helper text, Enquiry Message + counter, Submit Enquiry, Back to Type Selection. |
| Trip form | `S95-03 - Trip-Specific Enquiry Form.png` | 1 Trip Context: "Journey Planning (No Confirmed Booking Yet)" option + Planned Journey Specification card from BookingContext (Edit → `/journey`, Change → `/vehicle`); if the customer has saved trips, the existing trip picker stays available as a second option. 2 Contact (Full Name, Contact Email, Telephone optional). 3 Message (category select, details + counter). Submit Trip Enquiry, Cancel / Return. |
| Errors | `S95-04 - Trip Enquiry Validation Errors.png` | Header with "[ ERROR DETECTED ]" chip, red summary banner, "[ REQUIRED - MISSING ]" / "[ ACTION REQUIRED ]" tags, red fields with (!) icon, waiting-time policy note, as drawn. |
| Success | `S95-06 - Enquiry Submission Success.png` | ENQ reference + copy, timestamp, Submission Summary (type chip, contact, trip context, quoted message), Return to Home / Dashboard, Submit Another Enquiry. |

Category options: the PNGs show only "General Information / Pricing Inquiry" and "Route Planning & Waiting Time".
Options: see §10.

## 7. AC-15 removal (protected files — show diff to Bao first, edit only after "allowed")

- `app/scripts/selftest.mjs:296` AC-15 → new test "Checkout": log in demo, go through journey/vehicle/availability (or seed
  context via sessionStorage the same way other tests do), View Price → tick → Continue → Next with demo phone →
  expect `/checkout/…/success` and `PHC-` visible → View Receipt shows "£". Keep the test ID `AC-15` so the count stays 15.
- Docs: `AGENTS.md:45`, `PROJECT_CONTEXT.md` (22, 94, 231 + routes table), `.agents/rules/01` line 13, `.agents/rules/02` line 45,
  `README.md:47`, `fe/README.md` (202/355/364/385/401), `DEMO_SCRIPT.md:44` (add the checkout + enquiry demo steps), `HANDOFF.md:29`.
- Code comments: `AvailabilityPage.tsx:6`, `support.ts:67`, `backend/src/validation/bookings.ts:2`.

## 8. Tests

- `backend/scripts/smoke-test.mjs` (after the saved-trip block): quote for seven-seater = 11475; GET other customer's ref → 404;
  pay with `"+44 7700 ABC89"` → 400 `phone`; pay with `"+44 7700 900123"` → 200 PAID, `paymentRef` starts `TXN-`,
  fare frozen; pay again → 200 same `paymentRef`; GET after → `status: "PAID"`. Run `cd backend && npm run smoke` → all PASS.
- App: `npm run typecheck` (app, backend, web), `npm run selftest` 15/15, scrum16/17/18 scripts (via the temp copy without
  `executablePath`). If a scrum18 assertion checks AVAILABLE-state text that the 04 restyle removes → **stop and ask**,
  do not edit team tests.
- Manual in browser at 390 px: whole flow, reload on each checkout page, print preview, Staff Portal shows "Paid".

## 9. Order of work (each step ends green: typecheck + relevant test)

1. `pricing.ts` + `checkoutValidation.ts`.
2. Schema + `ensureBookingPaymentColumns` + GET/pay endpoints + smoke tests.
3. App service functions + routes + PriceReviewPage (05/08) + EditJourneyPage (05A).
4. NotificationPage (01/02/03) + PaymentSuccessPage.
5. ReceiptPage + ReceiptPrintPage.
6. Availability AVAILABLE restyle (04) + View Price.
7. Enquiry backend columns + wizard + Profile row.
8. Staff Portal TripCard rows.
9. AC-15 diff → Bao approves → selftest + docs. Then full verification. **No commit/push/production deploy without Bao.**

## 10. Decisions (approved by Bao 2026-11-24: "blocked items — decide yourself")

- Fares £95 Standard Car / £135 Seven-Seater, 15 % online discount always applied (Figma £135 → £114.75 matches).
- Pay uses the registered card's last 4 (no card screen exists in Figma, none added).
- SMS shown as SENT but never sent; email confirmation is real.
- 05A map = OpenStreetMap embed; QR = static SVG; Download = print to PDF.
- Selftest keeps id `AC-15` for the new checkout test so the report still reads 15/15.
- Enquiry Category options (first one = the value drawn in the PNG):
  - GENERAL: "General Information / Pricing Inquiry", "Fleet & Vehicle Availability", "Corporate & Business Accounts",
    "Airport Transfer Policies", "Feedback & Complaints", "Other".
  - TRIP: "Route Planning & Waiting Time", "Pickup / Destination Change", "Passenger Count & Luggage",
    "Vehicle Class Request", "Existing Booking Question", "Other".
  Placeholder option: "Select an enquiry category…" (as drawn in S95-04).
- Stepper labels: copied exactly per screen as drawn (they differ between PNGs on purpose of the designer; not unified).
- 04-pay: shows `TXN-xxxxx` ref without "-PAYPAL"; method shown as the card (`Card ending •••• last4`) to match 14/15.

## 10b. Working rules for the builder (Bao)

- **Only add, never delete.** No deleting files, routes, components, features, tests, `data-testid`, `data-node-id`,
  validation strings, DB columns or rows. Restyling a screen = keep every existing element/testid/behaviour and add the
  drawn parts. If the design seems to require removing something → stop and ask Bao.
- **Make it look polished** with the UI skills: before building each screen invoke `ui-skills-root`, then run
  `baseline-ui` on the finished page and `fixing-accessibility` on every form page. Polishing must not change the drawn
  texts, colours or layout of the Figma design — it fixes spacing, alignment, hierarchy, focus states and tap targets only.
- Figma design is fixed (see §2). Build each PNG exactly.

## 11. Left to the builder

Exact Tailwind spacing per PNG, icon choices from `Icon.tsx` (add an icon only if none fits), file split between
`checkoutService.ts` vs `customerEnquiryService.ts`, the vehicle display names/images on screen 04 (reuse what
`VehicleSizePage` already shows).
