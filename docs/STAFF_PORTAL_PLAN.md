# PrivateHire Cars — Kế hoạch triển khai Staff Web Portal (Enquiry Management)

> **Dành cho Claude Code.** Đọc toàn bộ file này trước khi viết dòng code nào.
> Làm lần lượt theo từng **Phase** (mục 12). Hết mỗi Phase phải đạt **Tiêu chí hoàn thành** của Phase đó rồi mới sang Phase tiếp.
> Mọi điểm **không có trong file này** hoặc **mâu thuẫn với code thực tế trong repo** → **DỪNG LẠI và hỏi người dùng**, không tự đoán.
> Ngôn ngữ trao đổi với người dùng: **tiếng Việt**. Code, tên biến, comment trong code: tiếng Anh.

> ### ⚠️ Quyết định bổ sung sau Phase 0 (17/11/2026) — ưu tiên hơn nội dung bên dưới
>
> | # | Nội dung | Quyết định |
> |---|---|---|
> | P0-1 | Tên thư mục | Backend dùng chung đặt ở **`be/`** (thay cho `server/`), Staff Portal đặt ở **`web/`** (thay cho `staff-portal/`). App Customer vẫn ở gốc repo. Mọi chỗ ghi `server/` / `staff-portal/` bên dưới hiểu là `be/` / `web/`. |
> | P0-2 | Đăng ký khách | Theo §7.2: đăng ký **không** tự đăng nhập. Phase 6 đổi màn Registration Complete và sửa selftest AC-14 (báo người dùng trước khi sửa test). |
> | P0-3 | `cardholderName` | Có trong body `POST /api/customer/auth/register`, server validate giống FE, **không lưu** DB. |
> | P0-4 | Tên dịch vụ | Seed dùng tên trong app: **"Driver & Car Daily Hire"** (không phải "Daily Hire"). |
> | P0-5 | Seed | `be/scripts/seed.ts` insert thẳng qua mysql2 (không sinh file `002_seed.sql`). |
> | P0-6 | Test mode + MOCK | `EMAIL_TEST_RECIPIENT` chỉ **bắt buộc khi `EMAIL_PROVIDER=EMAILJS`**. MOCK + test mode mà trống địa chỉ → coi như tắt test mode (Mock không gửi gì). |
> | P0-8 | Docker (thay D10) | **Toàn bộ chạy bằng Docker**: `docker-compose.yml` ở gốc repo gồm `db` (MySQL 8.0, cổng máy 3307), `be` (:4000), `web` (:5174), `app` (:5173), chế độ dev (mount mã nguồn). `be` chạy `npm run db:init` (chỉ tạo + seed khi DB trống). Chạy trực tiếp bằng `npm run dev` vẫn được. |
> | P0-9 | Validation dùng chung (Phase 4) | Staff Portal import luật đăng nhập từ `be/src/validation/staffLogin.ts` và luật phản hồi từ `be/src/validation/reply.ts` (không viết lại ở `web/src/lib`). |
> | P0-16 | Cấu trúc repo (sau Phase 8, **thay P0-1 và D3**) | Repo đổi tên thành **`privatehire-cars`**, gồm 3 thư mục: **`app/`** (app Customer, chuyển từ gốc repo), **`web/`** (Staff Portal), **`backend/`** (đổi tên từ `be/`). Docker service tên `backend`; mã nguồn mount vào `/workspace`. Mọi chỗ ghi `be/`, `server/`, `staff-portal/` hay "app Customer ở gốc repo" bên dưới hiểu theo cấu trúc mới. |
> | P0-13 | Đăng ký tự đăng nhập (Phase 6, **thay P0-2**) | Người dùng yêu cầu **không đổi bất cứ UI nào** của app Customer, nên giữ luồng cũ: đăng ký xong server set cookie `phc_customer` luôn → Registration Complete giữ nguyên "Go to Home". |
> | P0-14 | Không đổi UI app Customer (Phase 6) | Không sửa giao diện màn nào đang có (kể cả Profile — **không** thêm mục Contact Support). Màn `/support` (form + My enquiries) là màn mới, chỉ mở bằng cách gõ đường dẫn `/support`. Email trùng chỉ báo khi bấm Create Account (409 từ server). Lỗi mất kết nối: Login dùng banner sẵn có; Register hiện dưới ô email. |
> | P0-15 | Selftest AC-14 (Phase 6) | Chỉ đổi email cố định thành `new.user+<thời gian>@example.com` để chạy lại nhiều lần trên MySQL; luồng và các kiểm tra giữ nguyên. |
> | P0-10 | Giờ chuyến xe (Phase 5) | Giờ đón/booking hiển thị theo **giờ UK (Europe/London)** kèm nhãn "(UK time)", vì đó là giờ địa phương của chuyến. Các mốc hoạt động (nhận, gửi, đổi trạng thái) vẫn theo giờ máy người xem. |
> | P0-11 | Router Staff Portal (Phase 5) | `web/` dùng data router (`createBrowserRouter`) để chặn rời trang khi còn bản nháp (`useBlocker`). Bộ lọc Type là nhóm radio dạng segmented (không dùng tabs ARIA vì chỉ lọc một danh sách). |
> | P0-12 | Mất kết nối (Phase 5) | Không gọi được API khi mở app → màn "Can't reach the server…" + Try again (không đẩy về Login). Proxy trả 5xx không có JSON cũng coi là mất kết nối. |
> | P0-7 | Câu chữ bổ sung (Phase 3) | Enquiry khách > 2000 ký tự: `Message must be 2000 characters or fewer.` · enquiry GENERAL gửi kèm `bookingId` → bỏ qua, lưu `NULL` · retry bản không FAILED → 409 `Only responses that failed to send can be retried.` · gửi trùng `clientRequestId` khi bản cũ đang PENDING → 409. Luật form khách nằm ở `src/validation/enquiryValidation.ts` (dùng chung FE + BE), luật form phản hồi ở `be/src/validation/reply.ts`. |

---

## 0. Bối cảnh

- Repo: `https://github.com/CongTuDanhNguoi/privatehire-react-fe` (nhánh `main` ổn định, `dev` làm việc hằng ngày).
- Hiện trạng repo:
  - App **Customer**: React 19 + TypeScript (strict) + Vite 7 + Tailwind CSS v4 (theme trong `src/index.css`, không có `tailwind.config.js`) + react-router-dom 7. Giao diện khung điện thoại 390 px.
  - Chủ yếu là màn hình chuyển từ Figma sang code; **logic thật mới có đăng nhập / đăng ký**, và đang **giả lập bằng `localStorage`** trong `src/services/auth.ts`.
  - **Chưa có backend, chưa có database, chưa có chức năng Enquiry, chưa lưu booking nào** (luồng đặt xe chỉ giữ state trong `sessionStorage` qua `src/context/BookingContext.tsx`).
  - Có self-test Playwright: `npm run selftest` (15/15 PASS, cần `npm run dev` đang chạy).
- Yêu cầu mới (bổ sung ngoài Jira): xây **Staff Web Portal** riêng cho nhân viên, chỉ tập trung **Enquiry Management**.

## 1. Yêu cầu chức năng (nguyên văn từ người dùng — không được bỏ sót)

1. **Staff Login**: nhân viên đăng nhập để truy cập hệ thống, có **Logout**.
2. **Enquiry Inbox**: xem danh sách câu hỏi khách gửi, phân biệt **General Enquiry** và **Trip-Specific Enquiry**.
3. **Enquiry Detail**: xem thông tin khách hàng, nội dung câu hỏi và thông tin chuyến xe (nếu có).
4. **Email Response**: nhân viên soạn và gửi phản hồi qua hệ thống.
5. **Response History**: lưu nội dung phản hồi và liên kết với đúng **Enquiry ID**.
6. **Enquiry Status**: hiển thị và cập nhật trạng thái **Awaiting / Resolved**.
7. **Validation & Error Handling**: xử lý thiếu thông tin, gửi thất bại và **cho phép thử lại**.

Yêu cầu triển khai:
- Website riêng cho Staff, **giao diện desktop**, không phải mobile.
- Được tự quyết layout, miễn đủ chức năng.
- **Phải chạy được để demo**, không phải giao diện tĩnh.
- Dữ liệu Enquiry **liên kết với phần Customer Enquiry của app khách** (Staff xem và trả lời đúng yêu cầu khách đã gửi).
- Nếu có mock service thì **phải phân biệt rõ** với chức năng gửi email thật.
- Ngoài phạm vi: quản lý tài xế, doanh thu, điều phối xe.
- Giao diện **tự thiết kế** (không dùng bản Stitch/Figma), nhưng **đồng bộ UI Kit PrivateHire Cars** (màu, typography, button, component) với app Customer.

## 2. Các quyết định đã chốt với người dùng

| # | Chủ đề | Quyết định |
|---|---|---|
| D1 | Database | **MySQL 8** thật |
| D2 | Backend | **Node.js + Express + TypeScript**, **dùng chung** cho app Customer và Staff Portal |
| D3 | Vị trí code | Cùng repo `privatehire-react-fe`: backend ở `server/`, Staff Portal là app Vite riêng ở `staff-portal/`, app Customer **giữ nguyên ở thư mục gốc** |
| D4 | Gửi email | **Email thật qua EmailJS**, gọi từ **backend** (REST API của EmailJS) |
| D5 | Chế độ test email | **Bật mặc định**: mọi email chuyển về 1 hộp thư của nhóm; giao diện hiện nhãn rõ "Test mode". Tắt đi thì gửi đúng email khách |
| D6 | Màn gửi Enquiry phía khách | **Thêm màn "Contact Support"** vào app Customer, mở từ trang **Profile** |
| D7 | Trip-Specific Enquiry | Gắn với **booking mẫu** (seed sẵn trong MySQL). Khách chọn chuyến của mình trong form |
| D8 | Tài khoản nhân viên | **Seed sẵn 2 tài khoản** (bcrypt). Không có trang quản lý tài khoản, **không phân quyền** |
| D9 | Trạng thái | Gửi phản hồi **thành công → tự chuyển Resolved**. Nhân viên **tự đổi được** Awaiting ⇄ Resolved bất cứ lúc nào (kể cả mở lại) |
| D10 | Môi trường demo | **localhost** (MySQL cài trên máy, chạy bằng `npm run dev`) |
| D11 | Typography | **Inter** toàn bộ Staff Portal; cỡ chữ theo UI Kit + thêm **28px Bold** chỉ cho tiêu đề trang |
| D12 | Nút Secondary | Nền trắng, viền + chữ `#02284F` |
| D13 | Tài khoản khách | **Chuyển đăng ký/đăng nhập của khách sang MySQL** qua API, **giữ nguyên tên hàm + kiểu trả về** trong `src/services/auth.ts` |

## 3. Kiến trúc

```
┌──────────────────────────┐        ┌──────────────────────────┐
│ App Customer (gốc repo)  │        │ Staff Portal              │
│ Vite :5173  (mobile web) │        │ Vite :5174 (desktop web)  │
│ proxy /api → :4000       │        │ proxy /api → :4000        │
└────────────┬─────────────┘        └─────────────┬────────────┘
             │  /api/customer/*                    │  /api/staff/*
             └──────────────┬──────────────────────┘
                            ▼
              ┌──────────────────────────────┐
              │ server/  Express + TS  :4000 │──► EmailJS REST API (email thật)
              │ cookie session (JWT httpOnly)│──► MockEmailProvider (chỉ dev/test)
              └──────────────┬───────────────┘
                             ▼
                      MySQL 8  (database: privatehire)
```

- Hai app gọi API qua **Vite proxy** (`/api` → `http://localhost:4000`) nên cookie là same-origin, **không cần CORS**.
- Hai loại phiên đăng nhập **tách biệt**: cookie `phc_customer` và cookie `phc_staff`. Route `/api/staff/*` (trừ login) bắt buộc cookie staff hợp lệ; `/api/customer/*` (trừ register/login/email-exists) bắt buộc cookie customer.
- Email được gửi **ở backend** để: (1) không lộ private key EmailJS ra trình duyệt; (2) ghi lịch sử phản hồi và kết quả gửi trong cùng một luồng xử lý.

## 4. Cấu trúc thư mục đích

```
privatehire-react-fe/
├── (app Customer giữ nguyên: index.html, src/, public/, scripts/, vite.config.ts, package.json ...)
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── sql/
│   │   ├── 001_schema.sql
│   │   └── 002_seed.sql            (sinh bằng script, xem Phase 1)
│   ├── scripts/
│   │   ├── db-reset.ts             (drop + create + schema + seed)
│   │   └── seed.ts                 (băm mật khẩu bcrypt rồi insert)
│   └── src/
│       ├── index.ts                (khởi động server)
│       ├── app.ts                  (tạo express app, gắn middleware + routes)
│       ├── config.ts               (đọc + kiểm tra biến môi trường, dùng zod)
│       ├── db.ts                   (mysql2/promise pool)
│       ├── errors.ts               (AppError + error handler chung)
│       ├── middleware/
│       │   ├── requireStaff.ts
│       │   ├── requireCustomer.ts
│       │   └── loginRateLimit.ts
│       ├── email/
│       │   ├── EmailProvider.ts    (interface)
│       │   ├── EmailJsProvider.ts  (gửi thật)
│       │   ├── MockEmailProvider.ts(giả lập, có thể ép lỗi)
│       │   └── index.ts            (chọn provider theo .env, áp dụng test mode)
│       ├── routes/
│       │   ├── customerAuth.ts
│       │   ├── customerBookings.ts
│       │   ├── customerEnquiries.ts
│       │   ├── staffAuth.ts
│       │   ├── staffEnquiries.ts
│       │   └── staffResponses.ts
│       ├── services/               (logic nghiệp vụ, routes chỉ gọi vào đây)
│       └── validation/             (schema zod dùng cho request body/query)
├── staff-portal/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts              (port 5174, proxy /api)
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 (routes)
│       ├── index.css               (Tailwind v4 + @theme tokens UI Kit)
│       ├── api/                    (client.ts + từng nhóm endpoint, có kiểu TS)
│       ├── auth/                   (AuthContext, RequireStaff)
│       ├── components/ui/          (Button, TextField, TextArea, Select, Badge, Alert, Card, Spinner, EmptyState, ConfirmDialog, Toast)
│       ├── components/layout/      (AppShell, TopBar)
│       ├── pages/                  (LoginPage, InboxPage, EnquiryDetailPage, NotFoundPage)
│       ├── features/enquiries/     (bảng inbox, bộ lọc, khối chi tiết, composer, history)
│       ├── lib/                    (format ngày, enquiry code, validate)
│       └── types.ts                (kiểu dùng chung với API)
└── docs/
    └── STAFF_PORTAL_PLAN.md        (chính file này)
```

**Không** chuyển repo sang monorepo/workspaces. Mỗi thư mục (`/`, `server/`, `staff-portal/`) có `package.json` riêng và chạy `npm install` riêng.

## 5. Công nghệ & thư viện

| Phần | Thư viện |
|---|---|
| server | `express` 5, `mysql2`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `zod`, `dotenv`; dev: `typescript`, `tsx`, `@types/*` |
| staff-portal | giống app Customer: `react` 19, `react-dom`, `react-router-dom` 7, `tailwindcss` 4 + `@tailwindcss/vite`, `vite` 7, `typescript` 5; font Inter qua `@fontsource/inter` (không phụ thuộc Google Fonts khi demo offline) |
| Không dùng | ORM, Redux, thư viện form, thư viện UI (MUI/AntD...) — tự xây component theo UI Kit |

Node.js ≥ 20.19 (yêu cầu của Vite 7, giống README).

## 6. Database (MySQL 8) — `server/sql/001_schema.sql`

Charset `utf8mb4`, collation `utf8mb4_unicode_ci`, engine InnoDB. Thời gian lưu **UTC** (`DATETIME`), frontend tự đổi sang giờ địa phương khi hiển thị.

```sql
CREATE TABLE staff (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,      -- luôn lưu dạng trim + lowercase
  phone         VARCHAR(30)  NULL,
  home_address  VARCHAR(255) NULL,
  card_last4    CHAR(4)      NULL,                  -- KHÔNG lưu số thẻ đầy đủ, KHÔNG lưu CVV
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_ref      VARCHAR(20)  NOT NULL UNIQUE,    -- ví dụ PHC-24051
  customer_id      INT UNSIGNED NOT NULL,
  service_name     VARCHAR(60)  NOT NULL,           -- ví dụ 'Airport Transfer'
  pickup_location  VARCHAR(255) NOT NULL,
  destination      VARCHAR(255) NOT NULL,
  journey_datetime DATETIME     NOT NULL,
  passenger_count  TINYINT UNSIGNED NOT NULL,
  vehicle_size     VARCHAR(40)  NOT NULL,           -- ví dụ 'Seven-Seater'
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE enquiries (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,   -- hiển thị dạng ENQ-000001
  customer_id INT UNSIGNED NOT NULL,
  type        ENUM('GENERAL','TRIP') NOT NULL,
  booking_id  INT UNSIGNED NULL,                         -- bắt buộc khi TRIP, NULL khi GENERAL
  subject     VARCHAR(120)  NOT NULL,
  message     VARCHAR(2000) NOT NULL,
  status      ENUM('AWAITING','RESOLVED') NOT NULL DEFAULT 'AWAITING',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (booking_id)  REFERENCES bookings(id),
  INDEX idx_enquiries_status_created (status, created_at),
  INDEX idx_enquiries_type (type)
);

CREATE TABLE enquiry_responses (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enquiry_id        INT UNSIGNED NOT NULL,
  staff_id          INT UNSIGNED NOT NULL,
  client_request_id CHAR(36)     NOT NULL UNIQUE,     -- UUID do frontend sinh, chống gửi trùng
  subject           VARCHAR(150) NOT NULL,
  body              TEXT         NOT NULL,
  intended_to       VARCHAR(254) NOT NULL,            -- email thật của khách
  delivered_to      VARCHAR(254) NULL,                -- địa chỉ thực sự nhận (khác nếu Test mode)
  provider          ENUM('EMAILJS','MOCK') NOT NULL,
  test_mode         BOOLEAN      NOT NULL,
  send_status       ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  attempt_count     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  error_message     VARCHAR(500) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at           DATETIME NULL,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
  FOREIGN KEY (staff_id)   REFERENCES staff(id),
  INDEX idx_responses_enquiry (enquiry_id, created_at)
);

CREATE TABLE enquiry_status_history (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enquiry_id  INT UNSIGNED NOT NULL,
  from_status ENUM('AWAITING','RESOLVED') NOT NULL,
  to_status   ENUM('AWAITING','RESOLVED') NOT NULL,
  changed_by  INT UNSIGNED NULL,                      -- staff_id; NULL nếu hệ thống tự đổi
  reason      ENUM('MANUAL','AUTO_AFTER_RESPONSE') NOT NULL,
  changed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
  FOREIGN KEY (changed_by) REFERENCES staff(id)
);

CREATE TABLE login_attempts (
  scope        ENUM('STAFF','CUSTOMER') NOT NULL,
  email        VARCHAR(254) NOT NULL,
  fail_count   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  PRIMARY KEY (scope, email)
);
```

**Ràng buộc nghiệp vụ** (kiểm tra ở tầng service, không chỉ dựa vào DB):
- `type = 'TRIP'` ⇒ `booking_id` bắt buộc và booking đó **phải thuộc đúng customer** gửi enquiry.
- `type = 'GENERAL'` ⇒ `booking_id` phải NULL.

### 6.1 Dữ liệu mẫu (seed) — sinh bằng `server/scripts/seed.ts`

Mật khẩu băm bằng bcrypt (cost 10) lúc chạy seed, **không** ghi mật khẩu thô vào SQL.

**Staff** (D8):

| Họ tên | Email | Mật khẩu |
|---|---|---|
| Sarah Collins | `sarah.collins@privatehire.test` | `Staff@2026` |
| James Patel | `james.patel@privatehire.test` | `Staff@2026` |

**Customers** (tài khoản đầu tiên **phải trùng** tài khoản demo hiện có của app Customer):

| Họ tên | Email | Mật khẩu | Phone |
|---|---|---|---|
| Alex Morgan | `alex.morgan@example.com` | `Password123` | +44 7911 123456 |
| Emily Clarke | `emily.clarke@example.com` | `Password123` | +44 7700 900123 |
| Daniel Brooks | `daniel.brooks@example.com` | `Password123` | +44 7700 900456 |

**Bookings** (dữ liệu khớp với các màn Figma Journey/Availability):

| booking_ref | Khách | Dịch vụ | Pickup | Destination | Thời gian (UK) | Khách | Xe |
|---|---|---|---|---|---|---|---|
| PHC-24051 | Alex | Airport Transfer | Manchester Piccadilly Station, M1 2PB | Manchester Airport Terminal 2, M90 4FF | 25/11/2026 14:30 | 5 | Seven-Seater |
| PHC-24052 | Alex | Local Travel | The Lowry Hotel, M3 5LH | MediaCityUK, Salford Quays, M50 2EQ | 02/12/2026 09:00 | 2 | Saloon 4-Seat |
| PHC-24053 | Emily | Long-Distance | Spinningfields, Manchester M3 3AQ | Etihad Stadium, M11 3FF | 28/11/2026 18:15 | 3 | Saloon 4-Seat |
| PHC-24054 | Daniel | Daily Hire | Manchester Airport Terminal 1, M90 3PY | The Lowry Hotel, M3 5LH | 05/12/2026 08:00 | 6 | Seven-Seater |

**Enquiries** (ít nhất 7 bản, trộn loại và trạng thái; thời gian tạo rải trong 7 ngày gần nhất):
1. Alex – TRIP (PHC-24051) – "Extra luggage for airport transfer" – AWAITING
2. Alex – GENERAL – "Do you provide child seats?" – AWAITING
3. Emily – TRIP (PHC-24053) – "Can I change the pickup time?" – AWAITING
4. Emily – GENERAL – "Invoice for company expenses" – RESOLVED (kèm 1 response SENT)
5. Daniel – TRIP (PHC-24054) – "Driver waiting time at the airport" – AWAITING
6. Daniel – GENERAL – "Accessibility for wheelchair users" – RESOLVED (kèm 1 response SENT)
7. Alex – GENERAL – "Payment methods accepted" – AWAITING (kèm 1 response **FAILED** để demo nút Thử lại)

Nội dung `message` viết tiếng Anh tự nhiên, 2–4 câu, khớp với tiêu đề.

## 7. Backend API

Cổng **4000**, tiền tố `/api`. Body JSON. Mọi lỗi trả về **một dạng duy nhất**:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "fields": { "subject": "Subject is required." } } }
```

Mã lỗi dùng chung: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `INVALID_CREDENTIALS` (401), `ACCOUNT_LOCKED` (423, kèm `minutesLeft`), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `EMAIL_SEND_FAILED` (502), `INTERNAL_ERROR` (500). **Không** trả stack trace ra client.

### 7.1 Phiên đăng nhập
- Đăng nhập thành công → set cookie httpOnly, `SameSite=Lax`, `Path=/`, hết hạn 8 giờ, chứa JWT `{ sub, kind: 'staff' | 'customer' }` ký bằng `JWT_SECRET`.
- Khoá đăng nhập: sai **5 lần** liên tiếp → khoá **15 phút** (giống luật hiện có trong `auth.ts`), lưu ở bảng `login_attempts`, tách theo `scope`.
- Thông báo sai đăng nhập **không** phân biệt "email không tồn tại" và "sai mật khẩu".

### 7.2 Nhóm Customer

| Method & path | Body / Query | Trả về |
|---|---|---|
| `POST /api/customer/auth/register` | `{ fullName, email, homeAddress, phone, cardNumber, expiry, cvv, password, confirmPassword }` | 201 `{ user: { email, fullName } }` — **không** tự đăng nhập (giữ đúng luật SCRUM-12 trong code hiện tại). Validate giống `src/validation/registerValidation.ts`; chỉ lưu `card_last4` |
| `POST /api/customer/auth/login` | `{ email, password }` | 200 `{ user: { email, fullName, loggedInAt } }` + cookie |
| `POST /api/customer/auth/logout` | — | 204, xoá cookie |
| `GET /api/customer/auth/me` | — | 200 `{ user }` hoặc 401 |
| `GET /api/customer/auth/email-exists?email=` | — | 200 `{ exists: boolean }` |
| `GET /api/customer/bookings` | — | 200 `{ bookings: Booking[] }` chỉ của khách đang đăng nhập |
| `POST /api/customer/enquiries` | `{ type, bookingId?, subject, message }` | 201 `{ enquiry: { id, code, status, createdAt } }` |
| `GET /api/customer/enquiries` | — | 200 `{ enquiries: [...] }` của chính khách (id, code, type, subject, status, createdAt) |

### 7.3 Nhóm Staff

| Method & path | Body / Query | Trả về |
|---|---|---|
| `POST /api/staff/auth/login` | `{ email, password }` | 200 `{ staff: { id, fullName, email } }` + cookie `phc_staff` |
| `POST /api/staff/auth/logout` | — | 204 |
| `GET /api/staff/auth/me` | — | 200 `{ staff }` hoặc 401 |
| `GET /api/staff/enquiries` | `type=ALL\|GENERAL\|TRIP`, `status=ALL\|AWAITING\|RESOLVED`, `q` (tìm theo mã ENQ, tên, email khách, tiêu đề), `sort=newest\|oldest`, `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 50) | 200 `{ items: EnquirySummary[], page, pageSize, total, counts: { awaiting, resolved, general, trip } }` |
| `GET /api/staff/enquiries/:id` | — | 200 `{ enquiry, customer, booking \| null, responses: Response[], statusHistory: [...] }` |
| `PATCH /api/staff/enquiries/:id/status` | `{ status: 'AWAITING' \| 'RESOLVED' }` | 200 `{ enquiry }`; ghi `enquiry_status_history` reason `MANUAL`; nếu trạng thái không đổi → 200 không ghi history |
| `POST /api/staff/enquiries/:id/responses` | `{ clientRequestId, subject, body }` | **201** `{ response, enquiry }` khi gửi thành công; **502** `{ error: { code:'EMAIL_SEND_FAILED', message }, response }` khi gửi thất bại (bản ghi FAILED vẫn được lưu) |
| `POST /api/staff/responses/:responseId/retry` | — | 200 `{ response, enquiry }` hoặc 502 như trên. Chỉ cho phép khi `send_status = 'FAILED'`, ngược lại 409 |
| `GET /api/staff/email-settings` | — | 200 `{ provider: 'EMAILJS' \| 'MOCK', testMode: boolean, testRecipient: string \| null }` — để giao diện hiện nhãn |

`EnquirySummary`: `{ id, code, type, subject, status, createdAt, updatedAt, customer: { fullName, email }, bookingRef: string | null, responseCount, lastResponseStatus: 'SENT'|'FAILED'|null }`.

### 7.4 Luồng gửi phản hồi (bắt buộc làm đúng thứ tự)

1. Validate body (mục 9). Enquiry không tồn tại → 404.
2. Nếu `clientRequestId` đã tồn tại → trả lại bản ghi cũ (chống bấm gửi 2 lần), **không** gửi email lần nữa.
3. Insert `enquiry_responses` với `send_status='PENDING'`, `intended_to` = email khách, `provider`, `test_mode`, `delivered_to` = (test mode ? test recipient : email khách).
4. Gọi `EmailProvider.send(...)` với timeout **10 giây**; tăng `attempt_count`.
5. Thành công → `send_status='SENT'`, `sent_at=NOW()`. Nếu enquiry đang `AWAITING` → chuyển `RESOLVED` + ghi history reason `AUTO_AFTER_RESPONSE` (D9). Bước 5 chạy trong **một transaction**.
6. Thất bại → `send_status='FAILED'`, `error_message` = lỗi rút gọn (không chứa key bí mật). Trạng thái enquiry **giữ nguyên**. Trả 502 kèm bản ghi response.
7. Retry dùng lại đúng bản ghi đó (không tạo bản ghi mới), lặp bước 4–6.

### 7.5 Email provider

```ts
interface EmailProvider {
  readonly name: 'EMAILJS' | 'MOCK';
  send(msg: { to: string; toName: string; subject: string; body: string; enquiryCode: string; replyTo: string }): Promise<void>; // throw khi lỗi
}
```

- **EmailJsProvider** (gửi thật): `POST https://api.emailjs.com/api/v1.0/email/send`, body JSON `{ service_id, template_id, user_id: PUBLIC_KEY, accessToken: PRIVATE_KEY, template_params: { to_email, to_name, subject, message, enquiry_code, reply_to } }`. HTTP khác 200 → throw với nội dung text EmailJS trả về.
  - Yêu cầu tài khoản EmailJS **bật cho phép gọi API từ môi trường không phải trình duyệt** (mục *Account → Security*) và **dùng private key**. Nếu tài liệu EmailJS hiện tại khác mô tả này → **dừng lại báo người dùng**.
- **MockEmailProvider** (chỉ dùng khi phát triển/test, **không phải gửi thật**): không gửi gì, ghi log console `[MOCK EMAIL] ...`. Biến `MOCK_EMAIL_FAIL=never|always|next` để ép lỗi khi cần demo/test chức năng thử lại (`next` = chỉ lỗi lần gửi kế tiếp).
- **Test mode** (D5): bọc ngoài provider. Khi `EMAIL_TEST_MODE=true` → địa chỉ nhận thật = `EMAIL_TEST_RECIPIENT`, tiêu đề email được thêm tiền tố `[TEST → <email khách>]`.
- Khởi động server: nếu `EMAIL_PROVIDER=EMAILJS` mà thiếu biến EmailJS → **dừng server** với thông báo rõ ràng. Nếu `EMAIL_TEST_MODE=true` mà thiếu `EMAIL_TEST_RECIPIENT` → dừng server.

### 7.6 Biến môi trường — `server/.env.example`

```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=privatehire
JWT_SECRET=change-me-to-a-long-random-string
SESSION_HOURS=8

EMAIL_PROVIDER=MOCK            # MOCK | EMAILJS
EMAIL_TEST_MODE=true           # true = mọi email chuyển về EMAIL_TEST_RECIPIENT
EMAIL_TEST_RECIPIENT=
EMAIL_REPLY_TO=support@privatehire.test
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
MOCK_EMAIL_FAIL=never          # never | always | next
```

`.env` **không được commit** (thêm `server/.env` vào `.gitignore`). Không bao giờ in giá trị key ra log.

## 8. Thiết kế giao diện Staff Portal

### 8.1 Design tokens (UI Kit PrivateHire Cars) — `staff-portal/src/index.css`

```css
@import "tailwindcss";
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --color-ink: #02284F;            /* Text: headings / body text */
  --color-surface: #FFFFFF;        /* Background: screen / tag backgrounds */
  --color-line: #8999A6;           /* Border: input / card borders */
  --color-error: #FA0702;          /* Error & compulsory entry: text + stroke (100%) */
  --color-error-fill: rgb(250 7 2 / 0.05);   /* Error fill 5% */
  --color-success: #05C1FA;        /* Success text (like selected) / success stroke */
  --color-success-fill: #DEF7FF;   /* Success button / success background */
  --color-primary: #65B3FC;        /* Primary button fill */
  --color-primary-stroke: rgb(2 40 79 / 0.51); /* Primary stroke #02284F 51% */
  --color-primary-pressed: #3F84C4;/* Pressed */
  --color-muted: #D5E2ED;          /* Shadowing, disabled, subtle backgrounds */
}
```

Không viết mã hex trực tiếp trong component, chỉ dùng token. Nếu cần màu không có trong bảng (ví dụ nền trang xám rất nhạt) → **hỏi người dùng**, không tự thêm.

### 8.2 Typography (D11)

| Vai trò | Font | Dùng cho |
|---|---|---|
| Page title | Inter Bold 28px | Tiêu đề trang (chỉ Staff Portal) |
| Heading | Inter Bold 20px | Tiêu đề khối/card |
| Body | Inter Regular 16px | Nội dung |
| Label | Inter Semibold 14px | Nhãn ô nhập, tiêu đề cột bảng |
| Helper | Inter Regular 12px | Ghi chú, thông báo lỗi dưới ô nhập, thời gian |

> 4 cỡ 20/16/14/12 được đọc từ ảnh UI Kit có độ phân giải thấp. Khi bắt đầu Phase 4, nhắc người dùng xác nhận lại 4 cỡ này một lần.

### 8.3 Component theo UI Kit

- **Button**
  - `primary`: nền `primary`, viền `primary-stroke`, chữ trắng; nhấn: nền `primary-pressed`; disabled: nền `muted`, chữ `line`, không bấm được; **loading**: nền `primary-pressed` + spinner + chữ "Sending…" / "Signing in…", không bấm được.
  - `secondary` (D12): nền trắng, viền 1px `ink`, chữ `ink`.
  - `text`: không nền, chữ `ink` semibold, gạch chân khi hover.
  - `icon`: nút vuông 36px cho Back / Close.
  - Bo góc 8px, cao 44px (desktop). Có focus ring rõ ràng (outline 2px `primary-pressed`).
- **TextField / TextArea / Select**: nhãn Label 14px phía trên, dấu `*` màu `error` cho ô bắt buộc; viền `line`; trạng thái **Error**: viền `error`, nền `error-fill`, thông báo lỗi Helper 12px màu `error` ngay dưới ô, `aria-invalid` + `aria-describedby`.
- **Badge**:
  - Loại: `General` (nền `muted`, chữ `ink`), `Trip` (nền `success-fill`, chữ `ink`, viền `success`).
  - Trạng thái: `Awaiting` (viền `primary-pressed`, chữ `primary-pressed`), `Resolved` (nền `success-fill`, chữ `ink`, icon tick màu `success`).
  - Gửi email: `Sent`, `Failed` (nền `error-fill`, chữ `error`), `Pending`.
- **Alert / Feedback message** (theo mục *06 – Feedback Messages* của UI Kit): thanh màu bên trái, tiêu đề đậm, mô tả, 1 hành động dạng text button. Biến thể: `error` (viền trái + chữ tiêu đề `error`, nền `error-fill`), `success` (viền `success`, nền `success-fill`), `info` (viền `ink`, nền `muted`).
- **Card**: nền trắng, viền `muted`, bo 12px, padding 24px.
- **Toast** góc phải dưới cho thông báo ngắn ("Status updated").
- **ConfirmDialog**: dùng `<dialog>` gốc của HTML.
- **Spinner, EmptyState, Skeleton** cho trạng thái đang tải / không có dữ liệu.

### 8.4 Layout chung (desktop, tối thiểu 1280px, co giãn tới 1920px)

- **TopBar** cao 64px, nền trắng, viền dưới `muted`: logo PrivateHire Cars (dùng lại `src/assets/logo.png` của app Customer — copy sang `staff-portal/src/assets/`) + chữ "Staff Portal"; menu "Enquiries"; bên phải: tên + email nhân viên, nút secondary **Log out**.
- **Banner email mode** ngay dưới TopBar, hiện trên mọi trang sau đăng nhập:
  - `MOCK` → Alert info: "**Mock email service** — responses are saved but NO real email is sent."
  - `EMAILJS` + test mode → Alert info: "**Test mode** — all emails are delivered to `<testRecipient>` instead of the customer."
  - `EMAILJS` + không test mode → không hiện banner.
- Nội dung tối đa 1280px, căn giữa, padding 32px.

### 8.5 Các trang

**A. `/login` — Staff Login**
- Card giữa màn hình (rộng 440px): logo, tiêu đề "Staff Portal", phụ đề "Sign in to manage customer enquiries".
- Ô Email, ô Password (có nút Show/Hide), nút primary "Sign in" rộng hết card.
- Đã đăng nhập mà vào `/login` → chuyển sang `/enquiries`.
- Sau đăng nhập → quay về trang người dùng định vào trước đó (nếu có), mặc định `/enquiries`.

**B. `/enquiries` — Enquiry Inbox**
- Tiêu đề "Enquiries" + dòng phụ: "X awaiting · Y resolved".
- Thanh công cụ: tab loại **All / General / Trip-specific** (kèm số lượng); select trạng thái **All / Awaiting / Resolved** (mặc định **Awaiting**); ô tìm kiếm (debounce 300ms) "Search by ID, customer, email or subject"; select sắp xếp Newest/Oldest; nút "Refresh".
- Bảng: **ID** (ENQ-000001) · **Type** (badge) · **Subject** (1 dòng, cắt …) · **Customer** (tên + email nhỏ) · **Trip** (booking_ref hoặc "—") · **Received** (dd/MM/yyyy HH:mm) · **Status** (badge) · **Replies** (số lượng; có icon cảnh báo đỏ nếu lần gửi gần nhất FAILED).
- Click cả dòng (và Enter khi focus) → mở chi tiết. Phân trang dưới bảng.
- Bộ lọc lưu trên URL query (`?type=TRIP&status=AWAITING&q=...&page=2`) để Back/Refresh không mất.
- Trạng thái: đang tải (skeleton 5 dòng), rỗng ("No enquiries match your filters" + nút "Clear filters"), lỗi tải (Alert error + nút "Try again").

**C. `/enquiries/:id` — Enquiry Detail**
- Đầu trang: nút "← Back to inbox" (giữ nguyên bộ lọc cũ), mã ENQ, badge loại, tiêu đề câu hỏi, ngày nhận; bên phải: **điều khiển trạng thái** (segmented Awaiting | Resolved). Đổi trạng thái → gọi PATCH, cập nhật ngay, Toast "Status updated"; lỗi → hoàn lại trạng thái cũ + Toast lỗi.
- Bố cục 2 cột (≈ 5/12 trái, 7/12 phải):
  - **Trái**:
    1. Card **Customer**: họ tên, email (có nút copy), số điện thoại.
    2. Card **Enquiry**: nội dung câu hỏi (giữ xuống dòng), thời gian gửi.
    3. Card **Trip details** — chỉ khi `type=TRIP`: booking ref, dịch vụ, pickup, destination, ngày giờ, số khách, loại xe. Nếu GENERAL → không hiện card.
  - **Phải**:
    1. Card **Reply to customer**: dòng "To: tên <email>" (chỉ đọc; nếu test mode thì thêm dòng "Delivered to (test mode): …"); ô **Subject** (mặc định `Re: [ENQ-000001] <subject gốc>`); ô **Message** (TextArea 10 dòng, đếm ký tự x/5000); nút primary **Send response**; nút text **Discard draft**.
    2. Card **Response history** (mới nhất ở trên): mỗi mục có tiêu đề, nội dung (thu gọn 4 dòng, có "Show more"), người gửi, thời gian, badge Sent/Failed/Pending, "Delivered to …", và khi FAILED: thông báo lỗi + nút **Retry**. Rỗng → "No responses yet".
    3. (nhỏ, dưới cùng) **Status history**: "Awaiting → Resolved · auto after response · 17/11/2026 14:02".
- **Bản nháp**: nội dung đang soạn lưu `sessionStorage` theo từng enquiry; rời trang khi còn nháp → ConfirmDialog "Discard your unsent response?".
- Gửi thành công → Alert success "Response sent to … and saved to history. Enquiry marked as Resolved.", xoá nháp, thêm mục vào history, badge trạng thái cập nhật.
- Gửi thất bại → Alert error "Email could not be sent. Your response was saved as Failed — you can retry." + nút **Retry** ngay trong Alert; **nội dung vừa soạn vẫn giữ** trong ô nhập cho tới khi thử lại thành công.
- ID không tồn tại → trang "Enquiry not found" + nút về Inbox.

**D. `*` → NotFoundPage** (khi đã đăng nhập) / chuyển về `/login` (khi chưa).

### 8.6 Phiên đăng nhập phía frontend
- `AuthContext` gọi `GET /api/staff/auth/me` khi mở app (hiện Spinner toàn màn hình trong lúc chờ).
- Mọi API trả **401** (trừ trang login) → xoá state, chuyển về `/login` kèm thông báo "Your session has expired. Please sign in again."
- Log out → `POST /api/staff/auth/logout` → về `/login`.

## 9. Validation

Validate **ở cả frontend (để báo lỗi ngay) và backend (bắt buộc, nguồn tin cậy)**. Thông báo lỗi bằng tiếng Anh, thống nhất câu chữ giữa hai bên.

| Form | Trường | Quy tắc | Thông báo |
|---|---|---|---|
| Staff login | Email | bắt buộc; đúng định dạng email | "Email address is required." / "Enter a valid email address." |
| | Password | bắt buộc | "Password is required." |
| | (server) | sai thông tin | "Incorrect email or password." |
| | (server) | bị khoá | "Too many failed attempts. Try again in N minutes." |
| Reply | Subject | bắt buộc sau khi trim; 3–150 ký tự | "Subject is required." / "Subject must be between 3 and 150 characters." |
| | Message | bắt buộc sau khi trim; 10–5000 ký tự | "Message is required." / "Message must be at least 10 characters." / "Message must be 5000 characters or fewer." |
| | (server) | email khách không hợp lệ | 400 `VALIDATION_ERROR` "This customer has no valid email address, so a response cannot be sent." — frontend hiển thị Alert error và khoá nút gửi |
| Status | status | chỉ `AWAITING` / `RESOLVED` | 400 |
| Customer enquiry | type | bắt buộc, GENERAL/TRIP | "Choose an enquiry type." |
| | bookingId | bắt buộc khi TRIP; phải là booking của khách | "Choose the trip this enquiry is about." |
| | subject | bắt buộc; 5–120 ký tự | "Subject is required." / "Subject must be between 5 and 120 characters." |
| | message | bắt buộc; 20–2000 ký tự | "Message is required." / "Please describe your enquiry in at least 20 characters." |

Quy tắc email dùng chung **đúng regex đang có** trong `src/validation/` của app Customer (tìm và tái sử dụng logic, không tự viết regex khác).

## 10. Xử lý lỗi & thử lại (yêu cầu 7)

| Tình huống | Xử lý |
|---|---|
| Bỏ trống / sai định dạng | Báo lỗi dưới từng ô, focus ô lỗi đầu tiên, không gọi API |
| Gửi email thất bại (EmailJS lỗi, timeout 10s, mock ép lỗi) | Lưu response FAILED, giữ nội dung, Alert error + nút Retry (cả ở Alert và trong history) |
| Mất mạng / API không phản hồi (fetch lỗi) | Alert error "Can't reach the server. Check your connection and try again." + nút Try again; **không** mất nội dung đang soạn |
| Bấm gửi 2 lần | Nút bị khoá khi đang gửi + `clientRequestId` chống trùng ở server |
| Tải danh sách / chi tiết lỗi | Alert error + nút Try again |
| Đổi trạng thái lỗi | Hoàn lại trạng thái cũ trên UI + Toast lỗi |
| Hết phiên (401) | Về `/login` với thông báo hết phiên |
| Enquiry không tồn tại (404) | Trang Not found |
| Lỗi 500 | Thông báo chung "Something went wrong. Please try again." (không lộ chi tiết kỹ thuật) |

## 11. Thay đổi trong app Customer

> Nguyên tắc: **đụng ít nhất có thể** vào code hiện có. Sau Phase 6, `npm run typecheck` = 0 lỗi và `npm run selftest` phải **15/15 PASS** (nếu test phụ thuộc `localStorage` thì sửa test cho phù hợp — **báo người dùng** trước khi sửa test).

### 11.1 Chuyển auth sang API (D13)
- Thêm proxy vào `vite.config.ts` gốc: `server.proxy['/api'] = 'http://localhost:4000'`.
- Sửa **thân hàm** trong `src/services/auth.ts` thành `fetch('/api/customer/...')`, **giữ nguyên tên hàm, tham số và kiểu trả về** (`LoginResult`, `RegisterResult`, `SessionUser`...).
- Các hàm hiện đang **đồng bộ** (`isEmailRegistered`, `getCurrentUser`, `logout`) không thể giữ đồng bộ khi gọi API. Cách làm:
  - `getCurrentUser()`: vẫn đồng bộ, đọc từ bộ nhớ đệm phiên (cache) được nạp bằng hàm mới `initSession()` (gọi `GET /me`) trước khi render app trong `src/main.tsx`.
  - `logout()`: xoá cache ngay (đồng bộ) và gọi API logout nền.
  - `isEmailRegistered()`: **trước khi sửa, tìm mọi nơi gọi hàm này** và báo người dùng phương án (dự kiến: chuyển sang async + kiểm tra ở server khi submit đăng ký).
- Bỏ `seedDemoAccount()` khỏi `src/main.tsx` (tài khoản demo đã nằm trong seed MySQL). Giữ nguyên tài khoản `alex.morgan@example.com / Password123`.
- **Không** gửi `cardNumber` đầy đủ / `cvv` vào database — server chỉ lưu 4 số cuối như code hiện tại.

### 11.2 Màn Contact Support (D6)
- Route mới `/support` (bọc `RequireAuth`), giao diện mobile 390px đồng bộ các màn hiện có (dùng `MobileFrame`, font và màu như các màn Customer).
- Trang **Profile** thêm 1 mục danh sách: tiêu đề "Contact Support", mô tả "Ask a general question or about a trip" → điều hướng `/support`. Thêm đúng phong cách các mục hiện có, **không sửa** các mục khác.
- Form:
  1. Enquiry type: 2 lựa chọn dạng card (giống Selection Cards trong UI Kit) **General enquiry** / **About a trip**.
  2. Nếu "About a trip": danh sách booking của khách (`GET /api/customer/bookings`) — hiển thị booking ref, pickup → destination, ngày giờ; chọn 1. Khách không có booking → thông báo "You have no trips yet" và không cho chọn loại này.
  3. Subject, Message (đếm ký tự).
  4. Nút "Send enquiry" (loading khi gửi).
- Thành công → màn xác nhận: "Enquiry sent", mã **ENQ-xxxxxx**, "Our team will reply by email to <email>", nút "Back to Profile".
- Lỗi gửi → Alert error + nút "Try again", giữ nguyên nội dung đã nhập.
- (Tuỳ chọn, chỉ làm nếu người dùng đồng ý ở Phase 6) khối "My enquiries" liệt kê enquiry đã gửi kèm trạng thái.

## 12. Các Phase triển khai

Mỗi Phase: làm trên nhánh **`feature/staff-portal`** tạo từ `dev`; commit nhỏ, thông điệp rõ ràng (tiếng Anh, dạng `feat(server): ...`, `feat(staff): ...`, `feat(customer): ...`). Hết Phase → báo người dùng tóm tắt + cách kiểm tra, **chờ xác nhận** rồi mới sang Phase tiếp.

### Phase 0 — Chuẩn bị
- Đọc `README.md`, `src/services/auth.ts`, `src/validation/*`, `src/pages/ProfilePage.tsx`, `src/main.tsx`, `vite.config.ts`, `scripts/selftest.mjs`.
- Kiểm tra máy có Node ≥ 20.19, MySQL 8 đang chạy (`mysql --version`). Thiếu → hướng dẫn người dùng cài, **không** tự cài.
- Liệt kê lại cho người dùng mọi điểm code thực tế khác với file kế hoạch này.
- ✅ Hoàn thành khi: người dùng xác nhận danh sách khác biệt (nếu có) và môi trường sẵn sàng.

### Phase 1 — Database
- `server/sql/001_schema.sql`, `server/scripts/seed.ts`, `server/scripts/db-reset.ts`.
- Lệnh: `npm run db:reset` (tạo lại DB + schema + seed).
- ✅ Hoàn thành khi: chạy `db:reset` 2 lần liên tiếp không lỗi; đếm số dòng: staff 2, customers 3, bookings 4, enquiries ≥ 7, responses ≥ 3 (có 1 FAILED).

### Phase 2 — Backend nền + auth
- `config.ts` (validate .env bằng zod), `db.ts`, `errors.ts`, `app.ts`, `index.ts`, `GET /api/health` (kiểm tra kết nối DB).
- Auth staff + customer, cookie, khoá đăng nhập.
- Lệnh: `npm run dev` (tsx watch), `npm run typecheck`, `npm run build`.
- ✅ Hoàn thành khi: kiểm thử bằng `curl` (ghi lại lệnh trong `server/README.md`): đăng nhập đúng/sai/khoá cho cả 2 loại tài khoản; cookie staff không gọi được API customer và ngược lại; `/me` trả đúng.

### Phase 3 — Backend Enquiry + Email
- Customer: bookings, tạo/lấy enquiry. Staff: list (lọc, tìm, sắp xếp, phân trang, counts), detail, đổi trạng thái, gửi phản hồi, retry, email-settings.
- `MockEmailProvider` + `EmailJsProvider` + test mode.
- ✅ Hoàn thành khi (với `EMAIL_PROVIDER=MOCK`):
  - Tạo enquiry TRIP với booking của người khác → 400.
  - Gửi phản hồi thành công → response SENT, enquiry tự RESOLVED, có status history `AUTO_AFTER_RESPONSE`.
  - `MOCK_EMAIL_FAIL=always` → 502, response FAILED, enquiry vẫn AWAITING; đổi về `never` rồi retry → SENT.
  - Gửi lại cùng `clientRequestId` → không tạo bản ghi mới.
  - Lọc/tìm kiếm/phân trang trả đúng số lượng.

### Phase 4 — Staff Portal: nền tảng + Login
- Tạo app Vite trong `staff-portal/` (port 5174, proxy `/api`), tokens, font Inter, toàn bộ component `components/ui`, AppShell, TopBar, banner email mode, AuthContext, trang Login, Logout.
- Trang `/ui-kit` (chỉ bật khi `import.meta.env.DEV`) hiển thị mọi component + mọi trạng thái để đối chiếu với UI Kit.
- ✅ Hoàn thành khi: đăng nhập đúng/sai/để trống/bị khoá hiển thị đúng thông báo; Logout hoạt động; chưa đăng nhập vào `/enquiries` → về `/login`; người dùng xem `/ui-kit` và **duyệt** màu/chữ/nút.

### Phase 5 — Staff Portal: Inbox + Detail + Reply + History + Status
- Làm theo mục 8.5 B, C, mục 9, mục 10.
- ✅ Hoàn thành khi toàn bộ **kịch bản demo (mục 14)** chạy đúng với `EMAIL_PROVIDER=MOCK`.

### Phase 6 — App Customer
- Mục 11.1 rồi 11.2.
- ✅ Hoàn thành khi: `npm run typecheck` 0 lỗi; `npm run selftest` 15/15 PASS; khách đăng ký → đăng nhập → gửi enquiry ở `/support` → enquiry xuất hiện ngay trong Inbox của Staff Portal với đúng thông tin khách và chuyến.

### Phase 7 — Email thật (EmailJS)
- Hướng dẫn người dùng (từng bước, tiếng Việt) tạo tài khoản EmailJS, Email Service, Email Template với các biến `{{to_email}}`, `{{to_name}}`, `{{subject}}`, `{{message}}`, `{{enquiry_code}}`, `{{reply_to}}`; bật API cho non-browser; lấy Service ID, Template ID, Public key, Private key; điền vào `server/.env`. **Không** yêu cầu người dùng gửi key vào khung chat.
- Chạy với `EMAIL_PROVIDER=EMAILJS`, `EMAIL_TEST_MODE=true`.
- ✅ Hoàn thành khi: hộp thư test nhận được email có tiêu đề `[TEST → khách] Re: [ENQ-...]`; banner Test mode hiện đúng; tắt mạng → gửi thất bại → bật mạng → Retry thành công.

### Phase 8 — Tài liệu & bàn giao
- Cập nhật `README.md` gốc: thêm mục Staff Portal + Backend (cài MySQL, `.env`, thứ tự chạy 3 tiến trình, tài khoản demo, cách chuyển MOCK ⇄ EMAILJS ⇄ test mode).
- `server/README.md`: danh sách API + ví dụ `curl`.
- Script tiện lợi ở gốc (tuỳ người dùng đồng ý): `npm run dev:all` chạy cả 3 tiến trình.
- Tạo Pull Request `feature/staff-portal → dev` (người dùng tự merge).

## 13. Kiểm thử

- **Backend**: `curl`/script kiểm tra theo tiêu chí Phase 2–3 (lưu trong `server/scripts/smoke-test.mjs`, chạy bằng `npm run smoke`).
- **Staff Portal**: script Playwright `staff-portal/scripts/selftest.mjs` (cùng phong cách `scripts/selftest.mjs` của app Customer), chạy với `EMAIL_PROVIDER=MOCK`, bao gồm: login sai/đúng, lọc inbox, mở detail TRIP và GENERAL, gửi để trống (lỗi), gửi thành công (Resolved), ép lỗi → Retry, đổi trạng thái thủ công, logout.
- **App Customer**: `npm run selftest` 15/15 PASS + kịch bản gửi enquiry.
- Kiểm tra truy cập bằng bàn phím: Tab qua toàn bộ form/bảng, focus nhìn thấy rõ, Enter mở dòng bảng, Esc đóng dialog.

## 14. Kịch bản demo (dùng làm tiêu chí nghiệm thu cuối)

1. Mở app Customer (5173) → đăng nhập `alex.morgan@example.com / Password123` → Profile → Contact Support.
2. Bấm Send khi để trống → lỗi hiện dưới từng ô.
3. Chọn "About a trip" → chọn PHC-24051 → nhập tiêu đề + nội dung → gửi → thấy mã ENQ.
4. Mở Staff Portal (5174) → đăng nhập sai → báo lỗi → đăng nhập `sarah.collins@privatehire.test / Staff@2026`.
5. Inbox (lọc Awaiting) → enquiry vừa gửi nằm trên cùng, badge **Trip**, đúng tên Alex.
6. Lọc General / Trip → danh sách đổi đúng; tìm "child seat" → ra đúng enquiry.
7. Mở enquiry vừa gửi → thấy thông tin khách + câu hỏi + **Trip details** đúng PHC-24051.
8. Bấm Send response khi trống → lỗi validation.
9. Bật lỗi gửi (mock `MOCK_EMAIL_FAIL=next` hoặc ngắt mạng khi dùng EmailJS) → gửi → Alert lỗi, history có mục **Failed**, nội dung vẫn còn → bấm **Retry** → **Sent**, trạng thái tự chuyển **Resolved**.
10. Đổi tay Resolved → Awaiting → Toast "Status updated", status history ghi lại.
11. Mở enquiry GENERAL → **không** có khối Trip details.
12. Log out → quay về Login; bấm Back trình duyệt không vào lại được trang trong.

## 15. Bảo mật tối thiểu

- Mật khẩu chỉ lưu bcrypt; không log mật khẩu, cookie, key.
- Mọi truy vấn SQL dùng **tham số hoá** (`?` của mysql2), không ghép chuỗi.
- Cookie httpOnly; JWT_SECRET từ `.env`.
- Khách chỉ đọc được booking/enquiry **của chính mình**.
- Nội dung enquiry/response hiển thị bằng React text (không dùng `dangerouslySetInnerHTML`).
- Private key EmailJS chỉ nằm ở `server/.env`.

## 16. Ngoài phạm vi (KHÔNG làm)

Quản lý tài xế, doanh thu, điều phối xe; quản lý tài khoản nhân viên, phân quyền; đính kèm file; khách trả lời lại qua email (luồng 2 chiều); thông báo realtime/WebSocket; deploy lên host online; sửa giao diện các màn Customer hiện có ngoài mục Contact Support trong Profile.

## 17. Danh sách điểm phải hỏi người dùng khi tới lúc (không tự quyết)

- Phase 0: mọi khác biệt giữa repo thực tế và kế hoạch.
- Phase 4: xác nhận 4 cỡ chữ 20/16/14/12 và duyệt trang `/ui-kit`.
- Phase 6: cách xử lý `isEmailRegistered` (hàm đồng bộ); có sửa test Playwright không; có làm khối "My enquiries" không.
- Phase 7: thông tin EmailJS + địa chỉ hộp thư test (người dùng tự điền vào `.env`).
- Phase 8: có thêm script `dev:all` không.
- Bất kỳ lúc nào cần màu, cỡ chữ, thư viện, bảng/cột DB, endpoint **không có trong file này**.
