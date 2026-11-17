# PrivateHire Cars — App Customer + Staff Portal + Backend

Đồ án môn **UI Design** — mô phỏng app gọi xe riêng tại Vương quốc Anh. Repo gồm **3 phần chạy thật**, dùng chung một backend và database:

| Phần | Thư mục | Cổng | Mô tả |
|---|---|---|---|
| **App Customer** | `app/` | 5173 | Web dạng điện thoại 390 px, chuyển từ Figma (Option B — Coded Interactive Prototype) |
| **Staff Portal** | `web/` | 5174 | Web desktop cho nhân viên quản lý câu hỏi của khách (Enquiry Management) |
| **Backend** | `backend/` | 4000 | Node.js + Express + TypeScript + **MySQL 8**, dùng chung cho cả hai app |

- Thiết kế Figma (app Customer): <https://www.figma.com/design/vcCuk3p2GNdtuF0u3dHFPo/PrivateHire-Cars>
- Kế hoạch + mọi quyết định đã chốt: [`docs/STAFF_PORTAL_PLAN.md`](docs/STAFF_PORTAL_PLAN.md) (bảng P0-x ở đầu file ưu tiên hơn nội dung bên dưới)
- API + lệnh curl: [`backend/README.md`](backend/README.md) · Gửi email thật: [`docs/EMAILJS_SETUP.md`](docs/EMAILJS_SETUP.md)
- Kiểm thử tự động: app Customer **15/15 PASS** · sprint-1 của nhóm **78/79** · Staff Portal **10/10 PASS** · API **47/47 PASS**

---

## Mục lục

1. [Kiến trúc](#1-kiến-trúc)
2. [Chạy bằng Docker (khuyên dùng)](#2-chạy-bằng-docker-khuyên-dùng)
3. [Chạy không dùng Docker](#3-chạy-không-dùng-docker)
4. [Tài khoản demo và dữ liệu mẫu](#4-tài-khoản-demo-và-dữ-liệu-mẫu)
5. [Gửi email: Mock / EmailJS / Test mode](#5-gửi-email-mock--emailjs--test-mode)
6. [App Customer: màn hình và route](#6-app-customer-màn-hình-và-route)
7. [Staff Portal: chức năng](#7-staff-portal-chức-năng)
8. [Cấu trúc thư mục](#8-cấu-trúc-thư-mục)
9. [Quy tắc kiểm tra dữ liệu nhập](#9-quy-tắc-kiểm-tra-dữ-liệu-nhập)
10. [Figma → code (app Customer)](#10-figma--code-app-customer)
11. [Kiểm thử tự động](#11-kiểm-thử-tự-động)
12. [Kịch bản demo](#12-kịch-bản-demo)
13. [Quy trình Git](#13-quy-trình-git)
14. [Giới hạn hiện tại](#14-giới-hạn-hiện-tại)
15. [Xử lý sự cố](#15-xử-lý-sự-cố)

---

## 1. Kiến trúc

```
App Customer (Vite :5173, mobile)          Staff Portal (Vite :5174, desktop)
        │  /api/customer/*                          │  /api/staff/*
        └────────────── Vite proxy /api ────────────┘
                              ▼
                backend/  Express + TypeScript :4000 ──► EmailJS REST API (email thật, gọi từ server)
                cookie phc_customer / phc_staff ──► MockEmailProvider (không gửi thật)
                              ▼
                       MySQL 8 (database: privatehire)
```

- Hai app gọi API qua **proxy của Vite** nên cookie là cùng nguồn, không cần CORS.
- Hai loại phiên **tách biệt**: cookie `phc_customer` (khách) và `phc_staff` (nhân viên), JWT httpOnly, hết hạn 8 giờ.
- Email được gửi **từ backend**: Private Key EmailJS không bao giờ ra trình duyệt; mỗi lần gửi được lưu lịch sử + kết quả.

| Hạng mục | Lựa chọn |
|---|---|
| Frontend (cả hai app) | React 19 + TypeScript strict + Vite 7 + Tailwind CSS v4 + react-router-dom 7 |
| Backend | Express 5, mysql2, bcryptjs, jsonwebtoken, zod, chạy bằng `tsx` |
| Database | MySQL 8, giờ lưu UTC |
| Email | EmailJS (thật) hoặc Mock (giả lập), Test mode chuyển mọi email về 1 hộp thư |
| Kiểm thử | Playwright (2 app) + smoke test API |
| Chạy | Docker Compose (db + backend + web + app) |

## 2. Chạy bằng Docker (khuyên dùng)

**Yêu cầu:** Docker Desktop đang chạy (góc dưới cửa sổ Docker Desktop hiện *Engine running*).

```bash
git clone https://github.com/CongTuDanhNguoi/privatehire-cars.git
cd privatehire-cars
docker compose up -d
```

Lần đầu mất vài phút (tải image + cài thư viện). Sau đó mở:

| Địa chỉ | Là gì |
|---|---|
| <http://localhost:5173> | App Customer (bật F12 → Ctrl + Shift + M → iPhone 12 Pro để xem như điện thoại) |
| <http://localhost:5174> | Staff Portal |
| <http://localhost:4000/api/health> | Kiểm tra backend + database (`{"status":"ok","database":"up"}`) |
| `localhost:3307` | MySQL (user `root`, mật khẩu `privatehire`) — cổng 3307 để không đụng MySQL cài trên máy |

Database được **tự tạo + nạp dữ liệu mẫu** ở lần chạy đầu (`db:init`), các lần sau giữ nguyên dữ liệu.

| Lệnh | Tác dụng |
|---|---|
| `docker compose up -d` | Bật cả hệ thống |
| `docker compose ps` | Xem trạng thái 4 container (`db`, `backend`, `web`, `app`) |
| `docker compose logs -f backend` | Xem log backend (email Mock được in ở đây) |
| `docker compose exec backend npm run db:reset` | **Xoá sạch** dữ liệu rồi nạp lại dữ liệu mẫu — chạy trước mỗi buổi demo |
| `docker compose up -d --force-recreate backend` | Khởi động lại backend sau khi sửa `backend/.env` |
| `docker compose down` | Tắt (dữ liệu vẫn giữ) |
| `docker compose down -v` | Tắt **và xoá** database + thư viện đã cài |

Mã nguồn được gắn thẳng vào container nên sửa code không cần build lại image.
Cấu hình email đọc từ `backend/.env` nếu có (xem [mục 5](#5-gửi-email-mock--emailjs--test-mode)); không có file này thì mặc định Mock.

## 3. Chạy không dùng Docker

Yêu cầu: Node.js ≥ 20.19 và MySQL 8 cài trên máy. Mỗi phần có `package.json` riêng, mở **3 terminal**:

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env        # điền DB_PASSWORD (MySQL của máy) và JWT_SECRET (chuỗi ngẫu nhiên ≥ 32 ký tự)
npm run db:reset            # tạo database + dữ liệu mẫu
npm run dev                 # http://localhost:4000

# Terminal 2 — app Customer
cd app
npm install
npm run dev                 # http://localhost:5173

# Terminal 3 — Staff Portal
cd web
npm install
npm run dev                 # http://localhost:5174
```

## 4. Tài khoản demo và dữ liệu mẫu

Mật khẩu được băm bcrypt khi nạp dữ liệu, không lưu dạng thô.

| Loại | Email | Mật khẩu | Dùng ở |
|---|---|---|---|
| Nhân viên | `sarah.collins@privatehire.test` | `Staff@2026` | Staff Portal |
| Nhân viên | `james.patel@privatehire.test` | `Staff@2026` | Staff Portal |
| Khách | `alex.morgan@example.com` | `Password123` | App Customer (có 2 chuyến PHC-24051, PHC-24052) |
| Khách | `emily.clarke@example.com` | `Password123` | App Customer (chuyến PHC-24053) |
| Khách | `daniel.brooks@example.com` | `Password123` | App Customer (chuyến PHC-24054) |

Dữ liệu mẫu có **7 enquiry** (General + Trip, Awaiting + Resolved) và **3 phản hồi**, trong đó 1 phản hồi **Failed**
(ENQ-000001) để demo nút **Retry**. Staff Portal không có trang đăng ký nhân viên (theo kế hoạch: tài khoản seed sẵn).

**Dữ liệu hợp lệ để điền nhanh form Đăng ký** (dữ liệu test, không phải thẻ thật):

| Ô | Giá trị |
|---|---|
| Full Name / Cardholder Name | `Alex Morgan` |
| Email Address | email chưa đăng ký, ví dụ `bao.demo@example.com` |
| Home Address | `221B Baker St, London NW1 6XE` (nhập gì cũng được) |
| Phone Number | `+44 7911 123456` hoặc `0912 345 678` |
| Card Number | `4242 4242 4242 4242` |
| Expiry Date | `08/28` (gõ `0828` hoặc `08/2028` đều được) |
| CVV / CVC | `123` |
| Password / Confirm Password | `Password123` |

## 5. Gửi email: Mock / EmailJS / Test mode

Đặt trong `backend/.env`, rồi `docker compose up -d --force-recreate backend`:

| Muốn | `backend/.env` | Staff Portal hiện |
|---|---|---|
| Demo không gửi email thật (mặc định) | `EMAIL_PROVIDER=MOCK` | Banner "Mock email service — responses are saved but NO real email is sent." |
| Gửi thật nhưng chỉ tới hộp thư nhóm | `EMAIL_PROVIDER=EMAILJS`, `EMAIL_TEST_MODE=true`, `EMAIL_TEST_RECIPIENT=<hộp thư>` | Banner "Test mode — all emails are delivered to …"; tiêu đề email có tiền tố `[TEST → <email khách>]` |
| Gửi thật tới khách | `EMAIL_PROVIDER=EMAILJS`, `EMAIL_TEST_MODE=false` | (không có banner) |
| Demo nút Retry với Mock | thêm `MOCK_EMAIL_FAIL=next` (lần gửi kế tiếp thất bại) hoặc `always` | |

Cài EmailJS từng bước: [`docs/EMAILJS_SETUP.md`](docs/EMAILJS_SETUP.md). Backend **dừng ngay khi khởi động** nếu chọn
EMAILJS mà thiếu key, hoặc bật Test mode mà thiếu hộp thư nhận — xem lỗi bằng `docker compose logs backend`.

## 6. App Customer: màn hình và route

```
Welcome ──Log In──► Login ──đúng──────────────────────────────────► Home
   └────Sign Up───► Registration ──hợp lệ──► Verify Email (mã OTP 6 số qua email) ──đúng mã──► Registration Complete ──Go to Login──► Login (email điền sẵn) ──► Home

Home ──Book a Ride / View All Services──► Service Selection ──Continue──► Journey Details
                                              ▲                               │
                                              └──────────── Change ───────────┘
Home ──tab Profile──► My Profile ──Log Out──► Login
(gõ đường dẫn) /support ──► Contact Support: gửi câu hỏi + My enquiries
```

| Đường dẫn | Màn | Quyền truy cập |
|---|---|---|
| `/` | Welcome | Chỉ khi **chưa** đăng nhập (đã đăng nhập → tự sang `/home`) |
| `/login` | Login | Chỉ khi chưa đăng nhập |
| `/register` | Registration | Chỉ khi chưa đăng nhập |
| `/verify-email` | Nhập mã OTP xác nhận email | Chỉ khi chưa đăng nhập; ngay sau khi đăng ký, hoặc khi đăng nhập bằng tài khoản chưa xác nhận |
| `/register/complete` | Registration Complete | Ngay sau khi đăng ký (chưa đăng nhập — bấm "Go to Login") |
| `/home` | Home | **Bắt buộc đăng nhập** |
| `/services` | Service Selection | **Bắt buộc đăng nhập** |
| `/journey` | Journey Details | **Bắt buộc đăng nhập** + đã chọn dịch vụ (chưa chọn → `/services`) |
| `/vehicle` | Vehicle Size (Standard tối đa 4 khách, Seven-Seater tối đa 6) | **Bắt buộc đăng nhập** (sprint-1 của nhóm) |
| `/availability` | Kiểm tra xe còn trống (dữ liệu đội xe giả lập) | **Bắt buộc đăng nhập** (sprint-1 của nhóm) |
| `/profile` | My Profile | **Bắt buộc đăng nhập** |
| `/support` | **Contact Support** (gửi enquiry + danh sách "My enquiries") | **Bắt buộc đăng nhập** — **không có nút dẫn tới**, gõ thẳng `localhost:5173/support` |
| `/gallery`, `/gallery/:slug` | Xem các màn Figma tĩnh chưa nối luồng | Ai cũng xem được |
| `*` | → `/` | |

- Đăng nhập / đăng ký lưu trong **MySQL** qua API (`app/src/services/auth.ts` giữ nguyên tên hàm + kiểu trả về như bản giả lập cũ).
  Phiên là cookie httpOnly; `getCurrentUser()` đọc bộ nhớ đệm được nạp bằng `initSession()` khi mở app.
- Đăng ký xong **không tự đăng nhập** (SCRUM-12 / DEF-05): Registration Complete → **Go to Login** → email được điền sẵn → nhập mật khẩu → Home.
- **Xác nhận email bằng OTP (P0-18):** sau Create Account, mã 6 số được gửi thật (EmailJS) tới email vừa đăng ký — kể cả khi bật Test mode. Mã hết hạn sau 10 phút, sai 5 lần phải bấm **Resend code** (cho bấm lại sau 60 giây). Chưa nhập mã thì đăng nhập (đúng mật khẩu) sẽ được chuyển sang màn nhập mã. Email `@example.com` (dùng trong self-test) không gửi thật — mã đọc qua `/api/dev/last-verification-code` (chỉ khi không phải production).
- Email trùng được báo **khi bấm Create Account** (server trả lỗi), không còn báo khi rời ô.
- Sai mật khẩu 5 lần liên tiếp → khoá 15 phút (lưu ở server).
- Phần chuyển sang MySQL không đổi giao diện màn nào; thay đổi giao diện của sprint-1 (Registration Complete, Login điền sẵn email, Journey Details, Vehicle Size, Availability) là của nhóm. `/support` là màn mới.
- **Không có** màn Booking Confirmation / Payment — đúng phạm vi đồ án.

**Contact Support (`/support`)**: chọn *General enquiry* hoặc *About a trip* (chọn 1 chuyến của chính mình, giờ hiển thị
theo giờ UK), nhập Subject + Message → **Send enquiry** → hiện mã **ENQ-xxxxxx**. Câu hỏi xuất hiện ngay trong Inbox
của Staff Portal; khi nhân viên trả lời, "My enquiries" hiện **Resolved**.

## 7. Staff Portal: chức năng

| Trang | Chức năng |
|---|---|
| `/login` | Đăng nhập nhân viên (báo lỗi để trống / sai định dạng / sai mật khẩu / bị khoá), Show/Hide mật khẩu |
| `/enquiries` | **Inbox**: lọc loại (All / General / Trip-specific, có số đếm), lọc trạng thái (mặc định **Awaiting**), tìm theo mã ENQ / tên / email / tiêu đề, sắp xếp, phân trang, Refresh. Bộ lọc lưu trên URL |
| `/enquiries/:id` | **Detail**: thông tin khách (copy email), nội dung câu hỏi, **Trip details** (chỉ enquiry loại Trip, giờ UK), đổi trạng thái **Awaiting ⇄ Resolved**, soạn + gửi phản hồi, **Response history** (Sent / Failed / Pending, Retry), Status history |

- Gửi thành công → phản hồi **Sent**, enquiry **tự chuyển Resolved**. Gửi thất bại → lưu **Failed**, giữ nội dung đang soạn, có nút **Retry**.
- Bản nháp lưu theo từng enquiry; rời trang khi còn nháp → hỏi "Discard your unsent response?".
- Bấm gửi 2 lần / mất mạng giữa chừng không tạo email trùng (mỗi lần gửi có `clientRequestId`).
- Mất kết nối server → "Can't reach the server…" + Try again; hết phiên → về Login với thông báo.
- Trang `/ui-kit` (chỉ khi chạy dev) hiển thị toàn bộ component + màu + cỡ chữ của UI Kit để đối chiếu.

## 8. Cấu trúc thư mục

```
privatehire-cars/
├── docker-compose.yml         db + backend + web + app (chế độ dev)
├── README.md
├── docs/
│   ├── STAFF_PORTAL_PLAN.md   kế hoạch + bảng quyết định P0-x
│   └── EMAILJS_SETUP.md       hướng dẫn cài email thật
│
├── app/                       APP CUSTOMER (mobile 390 px)
│   ├── index.html, package.json, vite.config.ts (proxy /api)
│   ├── public/figma-assets/   ảnh + icon tải từ Figma
│   ├── scripts/
│   │   ├── download-figma-assets.mjs
│   │   └── selftest.mjs       self-test Playwright 15 tiêu chí
│   └── src/
│       ├── main.tsx           initSession() rồi mới vẽ app
│       ├── App.tsx            route + chặn quyền truy cập
│       ├── components/        RouteGuards, FigmaClickable, BottomNav, Icon, MobileFrame
│       ├── context/BookingContext.tsx   dịch vụ đang chọn (sessionStorage)
│       ├── data/services.ts   6 dịch vụ
│       ├── services/
│       │   ├── auth.ts        đăng nhập / đăng ký qua API
│       │   └── support.ts     bookings, gửi enquiry, My enquiries
│       ├── validation/        rules, loginValidation, registerValidation, enquiryValidation, format
│       ├── pages/             Welcome, Login, Register, RegistrationComplete, Home, ServiceSelection,
│       │                      JourneyDetails, Profile, Support, Gallery
│       ├── screens/           ⚠️ code Figma xuất ra — KHÔNG sửa tay
│       └── manifest/          danh sách màn Figma (dùng cho /gallery)
│
├── web/                       STAFF PORTAL (desktop)
│   ├── index.html, package.json, vite.config.ts (cổng 5174, proxy /api)
│   ├── scripts/selftest.mjs   self-test Playwright (10 bước)
│   └── src/
│       ├── api/               client (lỗi chuẩn hoá) + enquiries + staff
│       ├── auth/              AuthContext, RequireStaff / GuestOnly
│       ├── components/ui/     Button, Field, Badge, Alert, Card, Segmented, ConfirmDialog, Toast, Spinner, CopyButton…
│       ├── components/layout/ AppShell, TopBar, banner email
│       ├── features/enquiries/ bảng Inbox, thẻ thông tin, ô soạn phản hồi, lịch sử, bản nháp
│       ├── lib/               announce, format, storage, useAsync
│       └── pages/             Login, Inbox, EnquiryDetail, NotFound, UiKit
│
└── backend/                   BACKEND dùng chung (xem backend/README.md)
    ├── .env.example           mẫu cấu hình (file .env thật không commit)
    ├── sql/001_schema.sql     7 bảng MySQL
    ├── scripts/               db-reset, db-init, seed, smoke-test
    └── src/                   config, db, errors, middleware, routes, services, email/, validation/
```

Mỗi thư mục `app/`, `web/`, `backend/` có `package.json` riêng (cài riêng bằng `npm install` trong thư mục đó).
Luật kiểm tra dữ liệu được **dùng chung** để câu báo lỗi luôn giống nhau:
`app/src/validation/*` (app ↔ backend), `backend/src/validation/staffLogin.ts` và `reply.ts` (backend ↔ web).

## 9. Quy tắc kiểm tra dữ liệu nhập

Câu báo lỗi là **yêu cầu của đề** — không sửa chữ, không thêm dấu câu.

**Khi nào báo lỗi:** lỗi định dạng khi rời ô (nếu ô không trống) và khi bấm gửi; lỗi bỏ trống chỉ khi bấm gửi;
lỗi từ server (sai mật khẩu, email trùng, bị khoá) sau khi gửi; gõ lại vào ô sẽ xoá lỗi của ô đó.

### App Customer — Login

| Ô | Trường hợp | Câu báo lỗi |
|---|---|---|
| Email | bỏ trống | `Email address is required.` |
| Email | có dấu cách | `Email cannot contain spaces.` |
| Email | sai định dạng | `Please enter a valid email address.` |
| Password | bỏ trống | `Password is required.` |
| — | sai email **hoặc** mật khẩu (không nói rõ cái nào) | `Incorrect email or password. Please try again.` |
| — | sai 5 lần liên tiếp cùng email | `Too many attempts. Please try again in 15 minutes.` |
| — | không kết nối được server | `Can't reach the server. Check your connection and try again.` |

### App Customer — Registration

| Ô | Quy tắc → câu báo lỗi |
|---|---|
| Full Name | trống → `Full name is required.` · < 2 ký tự → `Name must be at least 2 characters.` · > 50 → `Name must be 50 characters or fewer.` · có số/ký hiệu → `Name can only contain letters, spaces, hyphens and apostrophes.` |
| Email | như Login + đã đăng ký (khi bấm Create Account) → `This email address is already registered. Please use a different email or log in.` |
| Home Address | trống → `Home address is required.` (nhập gì cũng được) |
| Phone Number | trống → `Phone number is required.` · không phải số → `Phone number can only contain digits.` (mọi quốc gia; bỏ qua dấu cách, `-`, `()`, dấu `+` ở đầu) |
| Cardholder Name | như Full Name, trống → `Cardholder name is required.` |
| Card Number | trống → `Card number is required.` · không phải số → `Card number can only contain digits.` · < 13 số → `Card number is incomplete.` · > 19 số → `Card number is invalid.` |
| Expiry Date | trống → `Expiry date is required.` · sai dạng → `Use the format MM/YY.` · tháng sai → `Invalid month.` · đã qua → `Card has expired` |
| CVV / CVC | trống → `CVV is required.` · không phải số → `CVV can only contain digits.` · sai độ dài → `CVV must be 3 digits.` (Amex 34/37 cần 4 số) |
| Password | trống → `Password is required.` · < 8 → `Password must be at least 8 characters.` · thiếu chữ hoa → `Password must include an uppercase letter.` · thiếu số → `Password must include a number.` · trùng email → `Password cannot be the same as your email.` |
| Confirm Password | trống → `Please confirm your password.` · không khớp → `Passwords do not match.` |

Tự định dạng khi gõ: số thẻ cách nhóm 4 số (tối đa 19 số); ngày hết hạn tự thêm `/`, tháng không vượt 12, `12/2028` → `12/28`.
Server chỉ lưu **4 số cuối thẻ** — không lưu số thẻ đầy đủ, CVV hay tên chủ thẻ.

### App Customer — Contact Support

| Ô | Câu báo lỗi |
|---|---|
| Loại | `Choose an enquiry type.` |
| Chuyến (khi "About a trip") | `Choose the trip this enquiry is about.` |
| Subject (5–120 ký tự) | `Subject is required.` · `Subject must be between 5 and 120 characters.` |
| Message (20–2000 ký tự) | `Message is required.` · `Please describe your enquiry in at least 20 characters.` · `Message must be 2000 characters or fewer.` |

### Staff Portal

| Form | Câu báo lỗi |
|---|---|
| Login | `Email address is required.` · `Enter a valid email address.` · `Password is required.` · `Incorrect email or password.` · `Too many failed attempts. Try again in N minutes.` |
| Phản hồi — Subject (3–150) | `Subject is required.` · `Subject must be between 3 and 150 characters.` |
| Phản hồi — Message (10–5000) | `Message is required.` · `Message must be at least 10 characters.` · `Message must be 5000 characters or fewer.` |

## 10. Figma → code (app Customer)

| Màn | Làm từ | Muốn sửa thì |
|---|---|---|
| Welcome, Home | code Figma trong `app/src/screens/**` bọc bởi `FigmaClickable` | chỉ thêm/sửa hành động trong `actions` của page |
| Login, Journey Details | bản chép code Figma trong `app/src/pages/` + state | chỉ sửa phần động, giữ class và `data-node-id` |
| Registration, Registration Complete, Service Selection, Profile, Contact Support | dựng tay theo ảnh thiết kế | giữ màu/khoảng cách đang dùng |

```tsx
<FigmaClickable actions={{ "6:1101": () => navigate("/services") }}>
  <HomeScreen />
</FigmaClickable>
```

**Không được xoá hoặc đổi tên:** `data-node-id` (FigmaClickable dùng), `data-testid` (self-test dùng) và `id` các ô nhập.

Staff Portal **không** dùng Figma: giao diện tự thiết kế theo UI Kit PrivateHire Cars (màu `ink #02284F`, `primary #65B3FC`,
font Inter, cỡ chữ 28/20/16/14/12) — xem `web/src/index.css` và trang `/ui-kit`.

## 11. Kiểm thử tự động

Chạy khi hệ thống đang bật (`docker compose up -d`). Lần đầu cần tải trình duyệt test: `npx playwright install chromium`.

| Bộ test | Lệnh | Kết quả mong đợi | Ghi chú |
|---|---|---|---|
| App Customer (15 tiêu chí AC-01…AC-15) | `cd app && npm run selftest` | **15/15 PASS** | Chạy lại nhiều lần được (email đăng ký ngẫu nhiên mỗi lần). Kết quả: `app/selftest/report.html` + `report.pdf` |
| Staff Portal (S01…S10) | `cd web && npm run selftest` | **10/10 PASS** | Cần `backend/.env`: `EMAIL_PROVIDER=MOCK`, `MOCK_EMAIL_FAIL=next` + `db:reset` trước (xem đầu file `web/scripts/selftest.mjs`) |
| API (47 bước) | `docker compose exec backend npm run smoke` | **47/47 PASS** | Tự reset DB, tự bật server riêng cổng 4100 với Mock. Chạy xong nên `db:reset` |
| Kiểu TypeScript | `cd app && npm run typecheck` · `cd web && npm run typecheck` · `cd backend && npm run typecheck` | 0 lỗi | |
| Bộ test sprint-1 của nhóm (SCRUM-12/16/17/18 + final acceptance) | `cd app && node scripts/test-scrum12.mjs` … `node scripts/test-final-acceptance.mjs` | 78/79 PASS (17/11) | Script gọi Chrome theo đường dẫn cố định `C:/Program Files/Google/Chrome/Application/chrome.exe` — máy không có Chrome thì phần trình duyệt bị bỏ qua. T09 (SCRUM-12) còn kiểm tra key `phc_session` của localStorage cũ, nay phiên là cookie httpOnly |

Tiêu chí app Customer: AC-01 khách chưa đăng nhập bị chặn · AC-02 Welcome → Login/Register · AC-03 lỗi Login ·
AC-04 Login → Home · AC-05 Book a Ride → Services · AC-06 Continue tắt khi chưa chọn · AC-07 6 dịch vụ, chọn đúng 1 ·
AC-08 Continue → Journey đúng dịch vụ · AC-09 Change → Journey cập nhật · AC-10 Home ↔ Profile · AC-11 Log Out ·
AC-12 lỗi Register · AC-13 email trùng · AC-14 Register → Complete → Go to Login → Home · AC-15 không có Confirmation/Payment.

## 12. Kịch bản demo

Trước buổi demo: `docker compose up -d` → `docker compose exec backend npm run db:reset`. Chọn chế độ email ở [mục 5](#5-gửi-email-mock--emailjs--test-mode)
(muốn demo lỗi + Retry với Mock thì đặt `MOCK_EMAIL_FAIL=next`).

1. App Customer (5173) → đăng nhập `alex.morgan@example.com / Password123` → **gõ `localhost:5173/support`** (không có nút trong Profile).
2. Bấm **Send enquiry** khi để trống → lỗi hiện dưới từng ô.
3. Chọn **About a trip** → PHC-24051 → nhập tiêu đề + nội dung → gửi → thấy mã **ENQ-000008**.
4. Staff Portal (5174) → đăng nhập sai → báo lỗi → đăng nhập `sarah.collins@privatehire.test / Staff@2026`.
5. Inbox (lọc Awaiting) → enquiry vừa gửi nằm trên cùng, badge **Trip**, tên Alex.
6. Lọc General / Trip-specific → danh sách đổi đúng; tìm "child seat" → ra đúng 1 enquiry.
7. Mở enquiry vừa gửi → thông tin khách + câu hỏi + **Trip details** PHC-24051.
8. Bấm **Send response** khi Message trống → lỗi validation.
9. Gửi khi đang ép lỗi (Mock `MOCK_EMAIL_FAIL=next`) → Alert lỗi, lịch sử có **Failed**, nội dung vẫn còn → **Retry** → **Sent**, trạng thái tự **Resolved**.
10. Đổi tay Resolved → Awaiting → toast "Status updated", Status history ghi lại.
11. Mở enquiry GENERAL (ví dụ "Do you provide child seats?") → **không** có Trip details.
12. Log out → về Login; bấm Back không vào lại trang trong.
13. (Thêm) Quay lại `localhost:5173/support` → "My enquiries" hiện trạng thái mới.

Demo 15 tiêu chí của app Customer: làm theo bảng AC-01…AC-15 ở [mục 11](#11-kiểm-thử-tự-động) (hoặc chạy `cd app && npm run selftest`
và mở `app/selftest/report.html` để có ảnh từng bước).

## 13. Quy trình Git

| Nhánh | Dùng cho |
|---|---|
| `main` | Bản ổn định, dùng để demo / nộp bài |
| `dev` | Nhánh làm việc hằng ngày |
| `feature/staff-portal` | Staff Portal + Backend + Docker → gộp vào `dev` qua Pull Request |

Trước khi gộp: typecheck 0 lỗi, selftest app Customer 15/15, selftest Staff Portal 10/10, smoke API 47/47.
Không commit `backend/.env` (chứa mật khẩu MySQL và key EmailJS — đã có trong `.gitignore`).

## 14. Giới hạn hiện tại

- Không có Booking Confirmation, Payment; không quản lý tài xế, doanh thu, điều phối xe (ngoài phạm vi).
- Booking cho Contact Support / Staff Portal là **dữ liệu mẫu** trong MySQL; luồng Vehicle Size / Availability của app dùng dữ liệu đội xe giả lập phía trình duyệt, chưa ghi booking vào database.
- `/support` không có nút dẫn tới từ màn cũ (yêu cầu không đổi UI) — phải gõ đường dẫn.
- Staff Portal: chỉ 2 tài khoản seed, không có trang quản lý tài khoản / phân quyền; khách chưa trả lời lại được qua email (1 chiều).
- Tab Activity / Alerts, các mục Profile (Personal Information, Saved Addresses, Payment Details), Forgot Password,
  Continue to Vehicle Selection chưa có màn đích.
- Backend chạy bằng `tsx` (không xuất file JS); `npm run build` của `backend/` chỉ kiểm tra kiểu.
- Hệ thống dành cho demo trên localhost — chưa cấu hình HTTPS / deploy.

## 15. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `docker` báo `cannot find dockerDesktopLinuxEngine` | Docker Desktop chưa chạy engine: mở Docker Desktop, hoặc chạy `docker desktop start` |
| Container "Up" nhưng trình duyệt không vào được 5173/5174/4000 | Docker Desktop vừa khởi động lại làm hỏng chuyển tiếp cổng: `docker compose up -d --force-recreate` |
| Staff Portal báo "Can't reach the server" | Backend chưa chạy: `docker compose ps`, `docker compose logs backend` |
| Backend không khởi động sau khi sửa `backend/.env` | `docker compose logs backend` — server in rõ thiếu / sai biến nào (không in giá trị key) |
| Email không tới | Xem lỗi trong mục Failed của Response history; kiểm tra lại [`docs/EMAILJS_SETUP.md`](docs/EMAILJS_SETUP.md) (non-browser API, Service ID, Template ID); kiểm tra thư mục Spam |
| Đăng nhập báo "Too many attempts…" | Chờ 15 phút hoặc `docker compose exec backend npm run db:reset` |
| Muốn dữ liệu sạch như ban đầu | `docker compose exec backend npm run db:reset` |
| Selftest báo thiếu trình duyệt | `npx playwright install chromium` (trong thư mục tương ứng) |
| Ảnh/icon app Customer không hiện | Kiểm tra `app/public/figma-assets/`; thêm màn Figma mới thì chạy `npm run figma-assets` |
| Giao diện nền tối khác thiết kế | Trình duyệt đang ép chế độ tối — tắt *Force dark mode* hoặc tiện ích dark mode |
