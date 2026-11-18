# Staff Portal — Visual redesign (hướng A) — Design

Ngày: 2026-11-18 · Phạm vi: `web/` (Staff Portal) · Trạng thái: chờ duyệt

## 1. Mục đích & lý do
Làm Staff Portal **đẹp hẳn lên** để bạn (Bảo) dùng làm cơ sở vẽ **wireframe nộp cho SCRUM-99**.
Chỉ đổi phần nhìn; mọi chức năng, luồng, dữ liệu giữ nguyên.

## 2. Mục tiêu / Không làm / Phản mục tiêu
- **Mục tiêu:** bố cục rõ ràng, có chiều sâu (thanh bên, thẻ số liệu, cột thông tin), đọc nhanh, nhìn chuyên nghiệp; vẫn nhận ra ngay là cùng "họ" UI Kit PrivateHire Cars.
- **Không làm:** tính năng mới, đổi API/backend, đổi app khách, đổi chữ thông báo lỗi/thành công, đổi thứ tự luồng.
- **Phản mục tiêu (coi như hỏng dù chạy được):** test Staff Portal S01–S10 không còn 10/10; lệch màu/font UI Kit; mất trạng thái đang tải / rỗng / lỗi / Retry; mất hỏi "Discard your unsent response?".

## 3. Ràng buộc
- **Màu:** chỉ token UI Kit trong `web/src/index.css` (`ink, surface, line, error, error-fill, success, success-fill, primary, primary-stroke, primary-pressed, muted`). Được dùng độ trong suốt của token (vd `bg-muted/40`). **Không thêm mã hex mới** (plan §8.1).
- **Font:** Inter; cỡ 28/20/16/14/12 như plan §8.2.
- **Chỉ sửa file giao diện:** `web/src/pages/*`, `web/src/components/**`, `web/src/features/enquiries/*` (phần JSX/class), `web/src/index.css`. **Không** sửa `web/src/api/*`, `web/src/auth/*` (logic), `web/src/lib/*`, `useDraft.ts`, backend, app khách, `web/scripts/selftest.mjs`.
- **Giữ nguyên cho test** (`web/scripts/selftest.mjs`):
  - `#email`, `#password`, `#email-error`, `#password-error`, `button[type=submit]`, chữ "Log out", "Incorrect email or password."
  - Inbox: `h1` "Enquiries" và **ngay sau nó** là `<p>` "X awaiting · Y resolved"; ô có label "Search"; bộ lọc loại là radio `input[value=ALL|GENERAL|TRIP]` trong `<label>`; vẫn là **`<table>` với `tbody tr`**; tiêu đề enquiry là **link**.
  - Detail: heading "Customer" và "Trip details"; nội dung nằm trong `<main>`; `#reply-body`, `#reply-body-error`; nút "Send response"; Alert lỗi nằm trong `form` (`[role=alert]`) có nút "Retry"; lịch sử phản hồi là `<ol><li>` **mới nhất ở trên**; điều khiển trạng thái là radio `value="AWAITING|RESOLVED"`; `#status-history-title`; Toast "Status updated".
- Desktop ≥ 1280px (plan §8.4); không cần bản mobile.
- Accessibility không được kém đi: label, `aria-invalid`, `aria-describedby`, `role=alert`, focus ring, điều hướng bàn phím ở bảng.

## 4. Các hướng đã cân nhắc
| | Hướng | Đánh đổi |
|---|---|---|
| **A** ✅ | Nâng cấp mạnh trong UI Kit: thanh bên, thẻ số liệu, Detail chia vùng hội thoại + cột thông tin, Login chia đôi | Đẹp rõ rệt, vẫn đúng yêu cầu "đồng bộ UI Kit" |
| B | Phong cách mới hoàn toàn (màu/font khác) | Ấn tượng nhất nhưng trái plan → rủi ro trừ điểm |
| C | Tinh chỉnh nhỏ | An toàn nhưng gần như không khác |

**Đã chọn A** (bạn chọn, 2026-11-18).

## 5. Thiết kế

### 5.1 Khung chung (AppShell)
```
┌──────────────┬───────────────────────────────────────────────┐
│ [logo]       │  (banner Test mode / Mock — giữ nguyên nội dung)│
│ Staff Portal │───────────────────────────────────────────────│
│              │                                               │
│ ▣ Enquiries  │   nội dung trang (max 1280px, padding 32px)   │
│   (badge số  │                                               │
│    Awaiting) │                                               │
│              │                                               │
│ ──────────── │                                               │
│ (SC) Sarah   │                                               │
│ sarah@…      │                                               │
│ [Log out]    │                                               │
└──────────────┴───────────────────────────────────────────────┘
```
- **Thanh bên trái** rộng 248px, nền `ink` (navy), chữ trắng; mục đang chọn: nền `surface/10`, vạch trái `primary`. Mục menu ghi **"Enquiry Management"** cho khớp SCRUM-99 *(việc của mình chọn; có thể giữ "Enquiries" nếu bạn muốn)*.
- Dưới cùng thanh bên: avatar tròn chữ cái đầu (nền `primary`), tên + email nhân viên, nút "Log out" (secondary viền trắng).
- Vùng nội dung nền `muted/30`; card nền `surface`, bo 12px, bóng nhẹ.
- Banner email mode giữ nguyên chữ, đặt trên cùng vùng nội dung.

### 5.2 Login
```
┌──────────────────────────┬──────────────────────────┐
│  nền ink                 │      [logo]              │
│  PrivateHire Cars        │      Staff Portal        │
│  "Customer enquiries,    │      Sign in to manage…  │
│   answered fast."        │      Email*  [        ]  │
│  • General & Trip        │      Password* [   ]Show │
│  • Email replies + retry │      [   Sign in   ]     │
│  • Awaiting / Resolved   │                          │
└──────────────────────────┴──────────────────────────┘
```
- Chia đôi 50/50; nửa trái nền `ink` với tiêu đề lớn trắng và 3 dòng tính năng (icon tick `success`); nửa phải form như cũ.
- Chữ lỗi/validation giữ nguyên.

### 5.3 Inbox
```
Enquiries                                              [↻ Refresh]
5 awaiting · 6 resolved
┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│ ● 5     ││ ✓ 6     ││ 🚗 4    ││ ✉ 7     │
│ Awaiting││ Resolved││ Trip    ││ General │
└─────────┘└─────────┘└─────────┘└─────────┘
┌ card ─────────────────────────────────────────────────────────┐
│ [All 11|General 7|Trip 4]  Status▾  [🔍 Search…]  Sort▾       │
│───────────────────────────────────────────────────────────────│
│ ID        Type   Subject                Customer    Trip  ... │
│ ENQ-0007  Trip   Extra luggage for…     (AM) Alex   PHC-…     │
└───────────────────────────────────────────────────────────────┘
```
- **4 thẻ số liệu** lấy từ `counts` API đã có (awaiting, resolved, trip, general). Bấm thẻ = áp bộ lọc tương ứng (dùng lại hàm `update()` hiện có, không thêm API).
- Bảng nằm trong card; hàng cao hơn, hover nền `muted/40`; cột Customer có avatar chữ cái; mã ENQ dùng chữ số đều (`tabular-nums`); hàng **Awaiting** có chấm tròn `primary-pressed` trước ID để nổi bật việc cần làm.
- Badge giữ màu theo plan §8.3, làm dạng "pill" có icon nhỏ.
- Trạng thái tải (skeleton), rỗng, lỗi giữ nguyên chữ; khung đẹp hơn (icon to, căn giữa).

### 5.4 Detail
```
← Back to inbox
ENQ-000007 · [Trip]                              Status
Extra luggage for airport transfer             (Awaiting|Resolved)
Received 17/11/2026 11:30
┌───────── 8/12 ───────────────────────┐┌──── 4/12 ─────────┐
│ Enquiry (bong bóng tin của khách)    ││ Customer          │
│   "Hi, we are travelling…"           ││ (AM) Alex Morgan  │
│──────────────────────────────────────││ email ⧉ · phone   │
│ Response history  (ol, mới nhất trên)││───────────────────│
│   [Sent] Re: … · Sarah · 17/11 14:02 ││ Trip details      │
│   [Failed] … [Retry]                 ││ PHC-24051 …       │
│──────────────────────────────────────││───────────────────│
│ Reply to customer                    ││ Status history    │
│ To: … / Delivered to (test mode): …  ││ Awaiting→Resolved │
│ Subject [..........]                 │└───────────────────┘
│ Message [..............] 0/5000      │
│ [Send response]  Discard draft       │
└──────────────────────────────────────┘
```
- Đổi bố cục từ 5/12–7/12 thành **8/12 (hội thoại) – 4/12 (thông tin)**: cột trái là "cuộc trao đổi" (tin khách → lịch sử phản hồi → ô trả lời), cột phải là thông tin tham khảo (Customer, Trip details, Status history). Cột phải dính (`sticky`) khi cuộn.
- Tin của khách hiển thị như bong bóng (nền `muted/40`, avatar khách); mỗi phản hồi là một mục có viền trái màu theo trạng thái gửi (`success` Sent, `error` Failed, `line` Pending).
- **Thứ tự lịch sử giữ "mới nhất ở trên"** (plan + test) — *mình quyết để không phải sửa test*.
- Mọi Alert (gửi thành công, thất bại + Retry, lỗi mạng, email khách không hợp lệ), đếm ký tự, ConfirmDialog, Toast giữ nguyên chữ và vị trí trong `form`.

### 5.5 Trang phụ
NotFound / "Enquiry not found" / Spinner toàn màn hình: cùng phong cách (icon lớn trong vòng tròn `muted`, nút về Inbox).

## 6. Phần để người làm tự quyết
- Icon cụ thể (dùng `web/src/components/ui/Icon.tsx`, thêm path nếu thiếu).
- Bóng đổ, khoảng cách chi tiết, hiệu ứng hover/transition nhẹ (≤150ms, tôn trọng `prefers-reduced-motion`).
- Câu tagline nửa trái Login (tiếng Anh, ngắn).

## 7. Kiểm tra khi xong
- `npm run typecheck` + `npm run build` trong `web/` → 0 lỗi.
- `web` selftest → **10/10 PASS**; app selftest 15/15 (không đụng nhưng chạy lại cho chắc).
- Mở Login, Inbox (có dữ liệu / rỗng / lỗi), Detail (Trip + General, gửi lỗi + Retry) trên trình duyệt ở 1280px và 1920px, chụp màn hình làm tư liệu vẽ wireframe.
