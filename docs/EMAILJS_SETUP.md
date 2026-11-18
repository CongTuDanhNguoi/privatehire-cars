# Cài đặt gửi email thật qua EmailJS (Phase 7)

Staff Portal gửi phản hồi cho khách **từ backend** (`backend/`) qua REST API của EmailJS, nên Private Key không bao giờ lộ ra
trình duyệt. Mặc định hệ thống chạy **Mock** (không gửi email thật). Làm theo các bước dưới để bật email thật ở **Test mode**
(mọi email đều chuyển về 1 hộp thư của nhóm, không gửi tới khách thật).

> ⚠️ **Không** dán key vào khung chat, README hay commit. Key chỉ nằm trong file `backend/.env` (đã bị `.gitignore` loại ra).

## 1. Tạo tài khoản
1. Vào <https://www.emailjs.com> → **Sign Up** (gói Free: 200 email/tháng là đủ demo).
2. Xác nhận email đăng ký nếu được yêu cầu, rồi đăng nhập vào **Dashboard**.

## 2. Kết nối hộp thư gửi đi (Email Service)
1. Dashboard → **Email Services** → **Add New Service** → chọn **Gmail** (hoặc Outlook…).
2. Bấm **Connect Account**, đăng nhập Gmail của nhóm và cho phép EmailJS gửi thư.
3. Bấm **Create Service**. Ghi lại **Service ID** (dạng `service_xxxxxxx`).

## 3. Tạo mẫu email (Email Template)
Dashboard → **Email Templates** → **Create New Template**, điền như sau:

| Ô trong EmailJS | Giá trị (gõ đúng cả dấu ngoặc nhọn) |
|---|---|
| **Subject** | `{{subject}}` |
| **Content** (Body) | xem khung dưới |
| **To Email** | `{{to_email}}` |
| **From Name** | `PrivateHire Cars Support` |
| **Reply To** | `{{reply_to}}` |

Content: bấm **Edit Content** → chọn **Code editor** (chế độ HTML), **xoá hết** nội dung có sẵn rồi dán đúng **một dòng**:
```
{{{message_html}}}
```

- **3 dấu ngoặc nhọn** là bắt buộc: EmailJS chỉ hiển thị HTML khi dùng `{{{ }}}` (2 ngoặc sẽ in ra mã HTML thô).
- Backend tự dựng sẵn cả email (dải navy "PrivateHire Cars", lời chào, nội dung, khung mã OTP to, chân thư
  "PrivateHire Cars Customer Support" + "Reference: ENQ-…") trong `backend/src/email/htmlTemplate.ts`,
  nên **không** thêm `Hi {{to_name}},`, `Reference`, chữ ký… vào template — sẽ bị lặp.
- Backend vẫn gửi kèm `{{message}}` (bản chữ thường) và `{{enquiry_code}}` cho ai muốn dùng template dạng chữ.

Bấm **Save**. Ghi lại **Template ID** (dạng `template_xxxxxxx`).

Các biến backend gửi sang: `to_email`, `to_name`, `subject`, `message`, `enquiry_code`, `reply_to`.

## 4. Lấy key và cho phép gọi từ server
1. Dashboard → **Account** → tab **General** (hoặc **API keys**): ghi lại **Public Key** và **Private Key**.
2. Dashboard → **Account** → tab **Security**:
   - Bật **Allow EmailJS API for non-browser applications** (bắt buộc — backend Node.js không phải trình duyệt).
   - Bật **Use Private Key (recommended)**.
   - Bấm **Save Changes**.

## 5. Điền vào `backend/.env`
Mở `backend/.env` bằng VS Code, sửa các dòng sau (giữ nguyên các dòng khác):

```
EMAIL_PROVIDER=EMAILJS
EMAIL_TEST_MODE=true
EMAIL_TEST_RECIPIENT=<hộp thư test của nhóm, ví dụ team.privatehire@gmail.com>
EMAILJS_SERVICE_ID=<Service ID>
EMAILJS_TEMPLATE_ID=<Template ID>
EMAILJS_PUBLIC_KEY=<Public Key>
EMAILJS_PRIVATE_KEY=<Private Key>
```

Khởi động lại backend để nạp cấu hình mới:

```bash
docker compose up -d --force-recreate backend
```

Nếu thiếu key hoặc thiếu `EMAIL_TEST_RECIPIENT`, container `backend` sẽ dừng và in rõ thiếu dòng nào:
`docker compose logs backend`.

## 6. Kiểm tra
- Staff Portal (<http://localhost:5174>) hiện banner **Test mode — All emails are delivered to …**.
- Mở 1 enquiry → gửi phản hồi → hộp thư test nhận email có tiêu đề `[TEST → <email khách>] Re: [ENQ-…] …`.
- Lỗi EmailJS (sai key, chưa bật non-browser…) → phản hồi được lưu **Failed** kèm thông báo lỗi; sửa xong bấm **Retry**.

## Chuyển chế độ

| Muốn | Đặt trong `backend/.env` |
|---|---|
| Demo không cần mạng / không gửi thật | `EMAIL_PROVIDER=MOCK` |
| Gửi thật nhưng chỉ tới hộp thư nhóm | `EMAIL_PROVIDER=EMAILJS` + `EMAIL_TEST_MODE=true` |
| Gửi thật tới email khách | `EMAIL_PROVIDER=EMAILJS` + `EMAIL_TEST_MODE=false` |

Sau mỗi lần sửa `.env`: `docker compose up -d --force-recreate backend`.
