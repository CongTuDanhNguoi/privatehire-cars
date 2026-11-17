# be/ — PrivateHire Cars API

Backend dùng chung cho **app Customer** (thư mục gốc repo) và **Staff Portal** (`web/`).
Node.js + Express 5 + TypeScript (chạy bằng `tsx`) + MySQL 8.

> Kế hoạch đầy đủ: [`../docs/STAFF_PORTAL_PLAN.md`](../docs/STAFF_PORTAL_PLAN.md). Trạng thái: **Phase 3 xong** (nền, đăng nhập, Enquiry, gửi email Mock/EmailJS).

## 1. Cài đặt

Yêu cầu: Node.js ≥ 20.19, MySQL 8 đang chạy.

```bash
cd be
npm install
cp .env.example .env      # rồi điền DB_PASSWORD và JWT_SECRET (chuỗi ngẫu nhiên ≥ 32 ký tự)
npm run db:reset          # tạo database "privatehire" + bảng + dữ liệu mẫu
npm run dev               # http://localhost:4000 (tự khởi động lại khi sửa code)
```

Tạo `JWT_SECRET` ngẫu nhiên: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy server, tự tải lại khi sửa code |
| `npm start` | Chạy server (không theo dõi file) |
| `npm run typecheck` / `npm run build` | Kiểm tra kiểu TypeScript (server chạy trực tiếp bằng `tsx`, không xuất file JS) |
| `npm run db:reset` | **Xoá sạch** database rồi tạo lại + seed (dùng trước mỗi buổi demo) |
| `npm run smoke` | Kiểm thử API tự động (47 bước). **Tự reset DB**, tự bật server riêng ở cổng 4100 với Mock email. Chạy xong nên `db:reset` lại |

`.env` không được commit. Server **không khởi động** nếu cấu hình sai (ví dụ `JWT_SECRET` còn giá trị mẫu) và không bao giờ in giá trị bí mật ra log.

## 2. Tài khoản mẫu (sau `db:reset`)

| Loại | Email | Mật khẩu |
|---|---|---|
| Staff | `sarah.collins@privatehire.test` | `Staff@2026` |
| Staff | `james.patel@privatehire.test` | `Staff@2026` |
| Customer | `alex.morgan@example.com` | `Password123` |
| Customer | `emily.clarke@example.com` | `Password123` |
| Customer | `daniel.brooks@example.com` | `Password123` |

## 3. Cấu trúc

```
be/
├── sql/001_schema.sql        7 bảng, utf8mb4, giờ UTC
├── scripts/
│   ├── connect.ts            kết nối MySQL cho script
│   ├── seed.ts               dữ liệu mẫu (bcrypt cost 10)
│   └── db-reset.ts           drop + create + schema + seed
└── src/
    ├── index.ts              khởi động server
    ├── app.ts                Express app: json, cookie, routes, error handler
    ├── config.ts             đọc + kiểm tra .env (zod)
    ├── db.ts                 mysql2 pool (UTC)
    ├── errors.ts             AppError + định dạng lỗi chung
    ├── types.d.ts            res.locals.staffId / customerId
    ├── middleware/           requireStaff, requireCustomer, loginRateLimit
    ├── routes/               customerAuth, staffAuth
    ├── services/             session (JWT cookie), loginAttempts, passwords, customerAuthService, staffAuthService
    └── validation/auth.ts    schema zod + luật đăng nhập staff
```

Luật kiểm tra dữ liệu khách (email, đăng ký...) **dùng lại nguyên** `../src/validation/` của app Customer, nên câu báo lỗi
ở trình duyệt và ở server luôn giống nhau.

## 4. Quy ước API

- Tiền tố `/api`, body JSON, cổng 4000. App Customer và Staff Portal gọi qua Vite proxy nên không cần CORS.
- Mọi lỗi có **một dạng duy nhất**:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "…" } } }
  ```
  | code | HTTP |
  |---|---|
  | `VALIDATION_ERROR` | 400 |
  | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | 401 |
  | `FORBIDDEN` | 403 |
  | `NOT_FOUND` | 404 |
  | `CONFLICT` | 409 |
  | `ACCOUNT_LOCKED` (kèm `minutesLeft`) | 423 |
  | `EMAIL_SEND_FAILED` | 502 |
  | `INTERNAL_ERROR` | 500 |
- Phiên đăng nhập: cookie httpOnly, `SameSite=Lax`, `Path=/`, hết hạn sau `SESSION_HOURS` (8 giờ), chứa JWT `{ sub, kind }`.
  Hai cookie **tách biệt**: `phc_staff` và `phc_customer` — cookie loại này không dùng được cho API loại kia.
- Sai mật khẩu **5 lần liên tiếp** với cùng email → khoá **15 phút** (bảng `login_attempts`, tách theo STAFF / CUSTOMER).
  Thông báo sai không bao giờ nói rõ là sai email hay sai mật khẩu.

## 5. Endpoint (Phase 2)

| Method & path | Cần đăng nhập | Body / query | Trả về |
|---|---|---|---|
| `GET /api/health` | — | — | 200 `{ status: "ok", database: "up" }` · 503 khi mất DB |
| `POST /api/customer/auth/register` | — | `{ fullName, email, homeAddress, phone, cardholderName, cardNumber, expiry, cvv, password, confirmPassword }` | 201 `{ user: { fullName, email } }` — **không** tự đăng nhập · 400 kèm `fields` · 409 email trùng |
| `POST /api/customer/auth/login` | — | `{ email, password }` | 200 `{ user: { email, fullName, loggedInAt } }` + cookie `phc_customer` · 400 · 401 · 423 |
| `POST /api/customer/auth/logout` | — | — | 204, xoá cookie |
| `GET /api/customer/auth/me` | customer | — | 200 `{ user }` · 401 |
| `GET /api/customer/auth/email-exists?email=` | — | — | 200 `{ exists }` |
| `POST /api/staff/auth/login` | — | `{ email, password }` | 200 `{ staff: { id, fullName, email } }` + cookie `phc_staff` · 400 · 401 · 423 |
| `POST /api/staff/auth/logout` | — | — | 204 |
| `GET /api/staff/auth/me` | staff | — | 200 `{ staff }` · 401 |

Đăng ký chỉ lưu **4 số cuối thẻ**; không lưu số thẻ đầy đủ, CVV hay tên chủ thẻ. Mật khẩu băm bcrypt.

### Enquiry (Phase 3)

| Method & path | Cần đăng nhập | Body / query | Trả về |
|---|---|---|---|
| `GET /api/customer/bookings` | customer | — | 200 `{ bookings: Booking[] }` — chỉ booking của chính khách |
| `POST /api/customer/enquiries` | customer | `{ type: "GENERAL"\|"TRIP", bookingId?, subject, message }` | 201 `{ enquiry: { id, code, status, createdAt } }` · 400 (TRIP phải dùng booking **của chính khách**) |
| `GET /api/customer/enquiries` | customer | — | 200 `{ enquiries: [{ id, code, type, subject, status, createdAt }] }` |
| `GET /api/staff/enquiries` | staff | `type=ALL\|GENERAL\|TRIP` · `status=ALL\|AWAITING\|RESOLVED` · `q` (mã ENQ, tên, email, tiêu đề) · `sort=newest\|oldest` · `page` · `pageSize` (≤ 50) | 200 `{ items, page, pageSize, total, counts: { awaiting, resolved, general, trip } }` |
| `GET /api/staff/enquiries/:id` | staff | — | 200 `{ enquiry, customer, booking \| null, responses, statusHistory }` · 404 |
| `PATCH /api/staff/enquiries/:id/status` | staff | `{ status: "AWAITING"\|"RESOLVED" }` | 200 `{ enquiry }` (ghi lịch sử MANUAL nếu đổi thật) |
| `POST /api/staff/enquiries/:id/responses` | staff | `{ clientRequestId (UUID), subject, body }` | 201 `{ response, enquiry }` · 502 `{ error: EMAIL_SEND_FAILED, response }` |
| `POST /api/staff/responses/:responseId/retry` | staff | — | 200 `{ response, enquiry }` · 502 · 409 nếu không phải FAILED |
| `GET /api/staff/email-settings` | staff | — | 200 `{ provider, testMode, testRecipient }` |

`counts`: `awaiting/resolved` tính theo bộ lọc loại + tìm kiếm (bỏ qua lọc trạng thái); `general/trip` tính theo bộ lọc
trạng thái + tìm kiếm (bỏ qua lọc loại) — để tab và dòng tóm tắt luôn cho biết mỗi lựa chọn có bao nhiêu mục.

**Gửi phản hồi** (§7.4): lưu `PENDING` → gửi (tối đa 10 giây) → `SENT` và enquiry `AWAITING` tự thành `RESOLVED`
(ghi lịch sử `AUTO_AFTER_RESPONSE`), hoặc `FAILED` kèm lỗi rút gọn và **giữ nguyên trạng thái** enquiry.
Gửi lại cùng `clientRequestId` → trả bản ghi cũ, không gửi email lần nữa. Retry dùng lại đúng bản ghi đó.

## 6. Chế độ gửi email

| `.env` | Hành vi | Banner trên Staff Portal |
|---|---|---|
| `EMAIL_PROVIDER=MOCK` | **Không gửi email thật**, chỉ ghi log `[MOCK EMAIL] …`. `MOCK_EMAIL_FAIL=never\|always\|next` để ép lỗi (`next` = chỉ lỗi lần gửi kế tiếp) | "Mock email service" |
| `EMAIL_PROVIDER=EMAILJS` + `EMAIL_TEST_MODE=true` | Gửi thật qua EmailJS nhưng **mọi email về `EMAIL_TEST_RECIPIENT`**, tiêu đề thêm `[TEST → <email khách>]` | "Test mode" |
| `EMAIL_PROVIDER=EMAILJS` + `EMAIL_TEST_MODE=false` | Gửi thật tới email khách | (không có) |

Server **dừng ngay khi khởi động** nếu chọn `EMAILJS` mà thiếu `EMAILJS_*`, hoặc test mode bật mà thiếu
`EMAIL_TEST_RECIPIENT`. Với `MOCK`, test mode chỉ có tác dụng khi có điền `EMAIL_TEST_RECIPIENT` (quyết định P0-6).
Private key EmailJS chỉ nằm trong `be/.env`, không bao giờ gửi ra trình duyệt hay ghi vào log/DB.

Đổi `MOCK_EMAIL_FAIL` thì phải **khởi động lại** server (Ctrl + C rồi `npm run dev`).

## 7. Kiểm thử bằng curl (Phase 2)

Chạy trong **Git Bash** khi `npm run dev` đang chạy, nên `npm run db:reset` trước để dữ liệu sạch.
(PowerShell: dùng `curl.exe` và đổi cách đặt dấu nháy cho JSON.)

```bash
B=http://localhost:4000/api
J='-H Content-Type:application/json'

curl -s $B/health                                                     # {"status":"ok","database":"up"}

# ---- Staff ----
curl -s $J -d '{}' $B/staff/auth/login                                # 400 Email address is required. / Password is required.
curl -s $J -d '{"email":"sarah@","password":"x"}' $B/staff/auth/login # 400 Enter a valid email address.
curl -s $J -d '{"email":"sarah.collins@privatehire.test","password":"wrong"}' $B/staff/auth/login   # 401 Incorrect email or password.
curl -s -c staff.txt $J -d '{"email":"sarah.collins@privatehire.test","password":"Staff@2026"}' $B/staff/auth/login   # 200 + cookie phc_staff
curl -s -b staff.txt $B/staff/auth/me                                 # 200 Sarah Collins
curl -s -b staff.txt -c staff.txt -X POST $B/staff/auth/logout        # 204

# ---- Customer ----
curl -s $J -d '{"email":"alex.morgan@example.com","password":"nope"}' $B/customer/auth/login    # 401 Incorrect email or password. Please try again.
curl -s $J -d '{"email":"nobody@example.com","password":"nope"}' $B/customer/auth/login         # 401 (cùng câu — không lộ email có tồn tại không)
curl -s -c cust.txt $J -d '{"email":"alex.morgan@example.com","password":"Password123"}' $B/customer/auth/login   # 200 + cookie phc_customer
curl -s -b cust.txt $B/customer/auth/me                               # 200 Alex Morgan
curl -s "$B/customer/auth/email-exists?email=alex.morgan@example.com" # {"exists":true}

curl -s $J -d '{}' $B/customer/auth/register                          # 400 với đủ 10 lỗi
curl -s $J -d '{"fullName":"Bao Demo","email":"bao.demo@example.com","homeAddress":"1 Test St","phone":"+84 912 345 678","cardholderName":"Bao Demo","cardNumber":"4242 4242 4242 4242","expiry":"08/28","cvv":"123","password":"Password123","confirmPassword":"Password123"}' $B/customer/auth/register   # 201, không set cookie
# gửi lại đúng lệnh trên                                               # 409 This email address is already registered…

# ---- Hai loại phiên tách biệt ----
curl -s -b staff.txt $B/customer/auth/me                              # 401 (cookie staff không gọi được API customer)
curl -s -b cust.txt  $B/staff/auth/me                                 # 401 (và ngược lại)

# ---- Khoá đăng nhập: 5 lần sai liên tiếp ----
for i in 1 2 3 4 5; do curl -s $J -d '{"email":"james.patel@privatehire.test","password":"wrong"}' $B/staff/auth/login; echo; done
# lần 1–4: 401 · lần 5: 423 Too many failed attempts. Try again in 15 minutes. (minutesLeft: 15)
curl -s $J -d '{"email":"james.patel@privatehire.test","password":"Staff@2026"}' $B/staff/auth/login   # vẫn 423 khi đang khoá
```

Kết quả chạy thật ngày 17/11/2026: tất cả các lệnh trên trả đúng mã HTTP và câu thông báo như chú thích.

Phần Enquiry + email (Phase 3) được kiểm bằng `npm run smoke`: **47/47 PASS** ngày 17/11/2026 — gồm enquiry TRIP với
booking của người khác → 400; gửi phản hồi → SENT + tự RESOLVED + lịch sử `AUTO_AFTER_RESPONSE`;
`MOCK_EMAIL_FAIL=always` → 502, FAILED, enquiry vẫn AWAITING → đổi `never` rồi retry → SENT; gửi trùng
`clientRequestId` → không tạo bản ghi mới; lọc / tìm / sắp xếp / phân trang đúng số lượng.
Mở khoá ngay: `npm run db:reset` (hoặc xoá dòng tương ứng trong bảng `login_attempts`).
