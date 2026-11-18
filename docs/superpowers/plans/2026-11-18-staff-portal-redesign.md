# Staff Portal Visual Redesign (hướng A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi diện mạo Staff Portal (`web/`) theo hướng A — thanh bên, thẻ số liệu, Detail 8/4, Login chia đôi — không đổi chức năng.

**Architecture:** Chỉ sửa JSX/class Tailwind ở trang và component giao diện, thêm 2 component trình bày nhỏ (`Avatar`, `StatCards`). Logic dữ liệu, API, auth, draft giữ nguyên; thẻ số liệu và badge thanh bên đọc `counts` từ `enquiriesApi.list` đã có.

**Tech Stack:** React 19 + TypeScript strict + Tailwind v4 (`@theme` tokens) + react-router 7; kiểm thử bằng `web/scripts/selftest.mjs` (Playwright, S01–S10).

**Spec:** `docs/superpowers/specs/2026-11-18-staff-portal-redesign-design.md`

## Global Constraints
- Chỉ dùng token màu có trong `web/src/index.css` (`ink, surface, line, error, error-fill, success, success-fill, primary, primary-stroke, primary-pressed, muted`), được thêm độ trong suốt (`/10`, `/30`, `/40`). **Không mã hex mới.**
- Font Inter; cỡ chữ chỉ dùng `text-page | text-heading | text-body | text-label | text-helper`.
- Không sửa: `web/src/api/*`, logic trong `web/src/auth/*`, `web/src/lib/*`, `web/src/features/enquiries/useDraft.ts`, `web/scripts/selftest.mjs`, `backend/`, `app/`, `package.json`.
- Không đổi bất kỳ chuỗi chữ hiển thị nào, **trừ** nhãn menu "Enquiries" → "Enquiry Management".
- Giữ mọi selector test liệt kê ở spec §3 (id, label, `h1 + p`, `table/tbody tr`, link tiêu đề, radio value, `ol > li` mới nhất ở trên, `#status-history-title`, `form [role=alert]`).
- Desktop ≥ 1280px; chuyển động ≤ 150ms và tắt khi `prefers-reduced-motion: reduce`.
- Lệnh git: `G="$LOCALAPPDATA/GitHubDesktop/app-3.6.10/resources/app/git/cmd/git.exe"`; commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Không push.

## Review Focus
1. **Cửa sổ 1280px:** thanh bên 248px còn lại ~1032px — bảng Inbox (8 cột) không được tràn ngang trang. Kiểm ở Task 4.
2. **Chữ dài:** tiêu đề enquiry / tên khách / email rất dài phải cắt `…` (bảng) hoặc xuống dòng `break-words` (Detail), không đẩy vỡ layout. Kiểm ở Task 4 và 5 bằng enquiry seed có tiêu đề dài nhất.
3. **Đang tải / lỗi API:** thẻ số liệu và badge thanh bên hiện "—" khi `counts` chưa có hoặc lỗi; không ném lỗi, không chặn trang. Kiểm ở Task 2 và 4 (tắt backend: `docker compose stop backend`, mở lại sau).
4. **Focus bàn phím trên nền navy:** vòng focus phải nhìn thấy trên thanh bên (`ink`). Kiểm ở Task 2 bằng Tab.
5. **Detail cột phải sticky + nội dung dài:** cột phải không che/chồng lên ô soạn khi cuộn; lịch sử nhiều mục vẫn cuộn bình thường. Kiểm ở Task 5.

---

### Task 1: Nền tảng — token nền, Avatar, icon

**Files:**
- Modify: `web/src/index.css` (body background)
- Create: `web/src/components/ui/Avatar.tsx`
- Modify: `web/src/components/ui/Icon.tsx` (thêm path)

**Interfaces:**
- Produces: `Avatar({ name: string; size?: "sm" | "md" }): JSX.Element` — chữ cái đầu của tối đa 2 từ, hình tròn nền `primary`, chữ `surface` semibold; `sm` = 28px/`text-helper`, `md` = 36px/`text-label`; `aria-hidden="true"` (tên luôn có chữ bên cạnh).
- Produces: icon mới `car`, `mail`, `clock`, `user` trong `IconName`.

- [ ] **Step 1:** `index.css` body `background-color` → `color-mix(in srgb, var(--color-muted) 30%, var(--color-surface))` (vẫn chỉ từ token). Thêm `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0ms !important; } }`.
- [ ] **Step 2:** Tạo `Avatar.tsx` theo Interfaces; thêm 4 icon (stroke 24-viewBox như icon hiện có, kiểu lucide).
- [ ] **Step 3:** `cd web && npm run typecheck` → không lỗi.
- [ ] **Step 4:** Commit `style(web): base background, Avatar, icons`.

### Task 2: AppShell → thanh bên trái

**Files:**
- Modify: `web/src/components/layout/AppShell.tsx` (thay `TopBar` bằng `Sidebar`, bố cục `AppShell`)

**Interfaces:**
- Consumes: `Avatar` (Task 1); `useAuth()` (`staff`, `signOut`) như hiện tại; `enquiriesApi.list(query: InboxQuery, signal)` và `useAsync`.
- Produces: `Sidebar()` nội bộ file.

- [ ] **Step 1:** Bố cục `AppShell`: `div.flex.min-h-dvh` → `<Sidebar/>` (`w-[248px] shrink-0 sticky top-0 h-dvh bg-ink text-surface flex flex-col`) + cột phải (`flex-1 min-w-0`) chứa banner email mode (giữ điều kiện cũ) và `<main id="main">` (`mx-auto w-full max-w-[1280px] p-8`).
- [ ] **Step 2:** `Sidebar`: logo + "Staff Portal" trên cùng; `<nav aria-label="Main">` một `NavLink to="/enquiries"` chữ **"Enquiry Management"** + icon `inbox`; active: `bg-surface/10` + vạch trái `primary` 3px; badge số awaiting bên phải (pill `bg-primary text-ink text-helper`).
- [ ] **Step 3:** Badge: `useAsync((s) => enquiriesApi.list({ type: "ALL", status: "AWAITING", q: "", sort: "newest", page: 1 }, s), [location.pathname])` → `data?.counts.awaiting`; khi `loading` lần đầu hoặc `error` → không hiện badge.
- [ ] **Step 4:** Chân thanh bên: `Avatar name={staff.fullName}` + tên (`text-label font-semibold`) + email (`text-helper text-surface/70`, `truncate`) + nút **"Log out"** (giữ `handleSignOut`, `loading`/`loadingText="Signing out…"`) kiểu viền `surface/40`, chữ `surface`, hover `bg-surface/10`.
- [ ] **Step 5:** Focus trên nền navy: trong Sidebar thêm class `focus-visible:outline-primary` cho link/nút.
- [ ] **Step 6:** Kiểm tra: `npm run typecheck`; mở `http://localhost:5174/enquiries` (đăng nhập Sarah từ seed) ở 1280px — thấy thanh bên, badge số; nhấn Tab qua menu và Log out thấy vòng focus; `docker compose stop backend` rồi tải lại → trang báo lỗi như cũ, thanh bên không vỡ; `docker compose start backend`.
- [ ] **Step 7:** Commit `style(web): sidebar navigation`.

### Task 3: Login chia đôi

**Files:**
- Modify: `web/src/pages/LoginPage.tsx` (chỉ phần bọc ngoài/JSX trình bày)

- [ ] **Step 1:** Bọc trang thành `grid grid-cols-2 min-h-dvh`. Trái: `bg-ink text-surface p-16 flex flex-col justify-between` — logo, tiêu đề `text-page font-bold` "Customer enquiries, answered fast.", 3 dòng có icon `check` màu `success`: "General & trip-specific enquiries", "Email replies with retry on failure", "Awaiting / Resolved at a glance"; chân: "PrivateHire Cars · Staff Portal" `text-helper text-surface/70`.
- [ ] **Step 2:** Phải: form hiện tại giữ nguyên nội dung, id, chữ lỗi; căn giữa, rộng 400px, bỏ viền card (nền `surface`).
- [ ] **Step 3:** Kiểm tra: `npm run typecheck`; mở `/login`, sai mật khẩu → "Incorrect email or password." hiện như cũ; để trống → `#email-error`, `#password-error`.
- [ ] **Step 4:** Commit `style(web): split login layout`.

### Task 4: Inbox — thẻ số liệu + bảng trong card

**Files:**
- Create: `web/src/features/enquiries/StatCards.tsx`
- Modify: `web/src/pages/InboxPage.tsx` (JSX phần header/toolbar/khung bảng)
- Modify: `web/src/features/enquiries/InboxTable.tsx` (class hàng/ô, Avatar, chấm Awaiting)
- Modify: `web/src/components/ui/Badge.tsx`, `web/src/components/ui/Feedback.tsx` (kiểu pill + EmptyState icon lớn)

**Interfaces:**
- Consumes: `Avatar`, icon `car`, `mail`, `clock`, `check` (Task 1); `update(changes: Partial<InboxQuery>)` có sẵn trong `InboxPage`.
- Produces: `StatCards({ counts?: { awaiting: number; resolved: number; general: number; trip: number }; onPick: (changes: Partial<InboxQuery>) => void })`.

- [ ] **Step 1:** `StatCards`: lưới 4 nút (`<button type="button">`, không dùng radio để không lẫn selector test), mỗi nút: icon trong vòng tròn, số `text-page font-bold tabular-nums` (hoặc "—" nếu `counts` undefined), nhãn `text-label`. Bấm: Awaiting → `{ status: "AWAITING" }`, Resolved → `{ status: "RESOLVED" }`, Trip → `{ type: "TRIP" }`, General → `{ type: "GENERAL" }`.
- [ ] **Step 2:** `InboxPage`: giữ nguyên `<h1>` và `<p>` ngay sau nó (`h1 + p`); đặt `<StatCards counts={counts} onPick={update} />` **sau** khối header; gộp `<search>` toolbar + bảng/empty/error vào một khung `rounded-xl bg-surface shadow-sm border border-muted` (toolbar có viền dưới).
- [ ] **Step 3:** `InboxTable`: hàng `h-14 hover:bg-muted/40`, ô Customer = `Avatar size="sm"` + tên/email (`truncate max-w-[220px]`); Subject `truncate max-w-[320px]`; trước mã ENQ của hàng `AWAITING` có chấm `size-2 rounded-full bg-primary-pressed` (`aria-hidden`); giữ link tiêu đề, `tbody tr`, xử lý click/Enter như cũ.
- [ ] **Step 4:** `Badge.tsx`: pill `rounded-full px-2.5 py-0.5 text-helper font-semibold` + icon nhỏ (Trip `car`, General `mail`, Awaiting `clock`, Resolved `check`); màu giữ theo plan §8.3. `Feedback.tsx` EmptyState: icon 48px trong vòng tròn `bg-muted/40`.
- [ ] **Step 5:** Kiểm tra (Review Focus 1–3): `npm run typecheck`; ở 1280px Inbox **không có thanh cuộn ngang trang** (`document.documentElement.scrollWidth <= innerWidth` qua console); bấm từng thẻ số liệu → URL đổi `?status=` / `?type=` đúng; tìm "zzzz" → EmptyState + "Clear filters"; dừng backend → Alert "Enquiries could not be loaded." + thẻ hiện "—".
- [ ] **Step 6:** Commit `style(web): inbox stat cards and table card`.

### Task 5: Detail — bố cục 8/4 hội thoại

**Files:**
- Modify: `web/src/pages/EnquiryDetailPage.tsx` (khối `grid` và header)
- Modify: `web/src/features/enquiries/InfoCards.tsx` (EnquiryCard dạng bong bóng; CustomerCard có Avatar)
- Modify: `web/src/features/enquiries/ResponseHistory.tsx` (viền trái theo `sendStatus`)
- Modify: `web/src/features/enquiries/ReplyComposer.tsx` (chỉ class khung, không đổi logic/chữ)

**Interfaces:**
- Consumes: `Avatar` (Task 1); props hiện có của `ReplyComposer`, `ResponseHistory`, `StatusHistory`, `CustomerCard`, `EnquiryCard`, `TripCard` — không đổi chữ ký.

- [ ] **Step 1:** Grid: trái `col-span-8` theo thứ tự `EnquiryCard` → `ResponseHistory` → `ReplyComposer`; phải `col-span-4 sticky top-8 self-start` theo thứ tự `CustomerCard` → `TripCard` (chỉ khi TRIP) → `StatusHistory`. Giữ `ConfirmDialog`, `useBlocker`, header + `Segmented` như cũ.
- [ ] **Step 2:** `EnquiryCard`: nội dung trong bong bóng `rounded-2xl rounded-tl-sm bg-muted/40 p-4 whitespace-pre-wrap break-words` có `Avatar` khách bên trái; giữ tiêu đề card và dòng "Sent …".
- [ ] **Step 3:** `CustomerCard`: thêm `Avatar size="md"` cạnh tên; giữ heading "Customer", nút copy, "Phone".
- [ ] **Step 4:** `ResponseHistory`: mỗi `li` có `border-l-4` — `border-success` (SENT), `border-error` (FAILED), `border-line` (PENDING); giữ `<ol>`, thứ tự mới nhất ở trên, nút Retry, "Show more".
- [ ] **Step 5:** Kiểm tra (Review Focus 2, 5): `npm run typecheck`; mở ENQ Trip (PHC-24051) và một General; cuộn trang dài → cột phải dính, không che ô soạn; gõ nháp rồi bấm "Back to inbox" → hỏi "Discard your unsent response?".
- [ ] **Step 6:** Commit `style(web): two-column conversation detail`.

### Task 6: Trang phụ + kiểm thử toàn bộ + tư liệu

**Files:**
- Modify: `web/src/pages/NotFoundPage.tsx` (icon lớn trong vòng tròn `muted/40`, nút về Inbox giữ chữ)

- [ ] **Step 1:** Sửa NotFound theo spec §5.5 (trang "Enquiry not found" dùng lại component này); Spinner toàn màn hình lúc kiểm tra phiên (`web/src/auth/RouteGuards.tsx`, chỉ class) căn giữa trên nền mới.
- [ ] **Step 2:** `cd web && npm run build` → 0 lỗi.
- [ ] **Step 3:** `cd web && npm run selftest` (Docker đang chạy) → **10/10 PASS**. Nếu FAIL: sửa giao diện, không sửa test.
- [ ] **Step 4:** `cd app && npm run selftest` → **15/15 PASS** (xác nhận không ảnh hưởng app).
- [ ] **Step 5:** Chụp màn hình Login, Inbox, Detail (Trip, sau khi gửi lỗi + Retry), Empty ở 1280px và 1920px làm tư liệu vẽ wireframe.
- [ ] **Step 6:** Commit `style(web): not-found polish`; báo cáo theo mẫu AGENTS.md §7. Không push.
