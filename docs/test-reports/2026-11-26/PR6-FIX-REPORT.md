# Báo cáo sửa lỗi review PR #6 — 2026-11-26

Nhánh: `fix/pr6-review` (local, tạo từ `origin/feature/sprint3-customer-verification` a96e416, đã merge `release/v2`). Chưa push.

## Kết quả từng lỗi
| # | Lỗi | Trạng thái | Cách sửa |
|---|---|---|---|
| 1 | Dockerfile backend thiếu `pricing.ts` | Đã sửa | merge `release/v2` (có dòng COPY) |
| 2 | Lịch sử booking lỗi 500 trên DB chưa có cột thanh toán | Đã sửa | gọi `ensureBookingPaymentColumns()` trước khi đọc |
| 3 | OTP ẩn trên production, nhân viên không xác minh được | Đã sửa (cờ) | cờ `CALLER_OTP_SIMULATION` (mặc định `false`) thay cho việc ẩn theo NODE_ENV |
| 4 | Gửi lại OTP không có thời gian chờ | Đã sửa | chặn gửi lại trong 60 giây, trả 429 kèm `retryAfterSeconds` |
| 5 | Đếm số lần nhập sai không an toàn khi gửi đồng thời | Đã sửa | `attempts = attempts + 1` trong SQL |
| 6 | Script test xoá thiếu bảng `caller_verifications` | Đã sửa | thêm bảng vào hai lệnh DROP |
| 7 | Comment truy vấn gây hiểu lầm | Đã sửa | viết lại comment cho đúng |

## Kiểm tra
- typecheck backend = 0 lỗi.
- unit-scrum106: pass 5, fail 0. unit-scrum107: pass 2, fail 0.
- smoke (privatehire_test, reset demo): 99/99 PASS.
- Luồng nhân viên trên backend 4400 (CALLER_OTP_SIMULATION=true): login 200; tìm khách 1 kết quả; booking trước xác minh 403; gửi OTP 200 (có mã); gửi lại ngay 429 (TOO_MANY_REQUESTS, 60 s); nhập sai 400 còn 2 lần; nhập đúng 200; hồ sơ 200; booking 200.
- Chưa kiểm tra: script live-scrum106/107 (cần DB ở cổng 3308, máy này không có); tính năng với NODE_ENV=production thật.

## Việc còn lại (chưa làm)
- Bật OTP giả lập trên production: thêm `CALLER_OTP_SIMULATION=true` vào `.env.prod` rồi deploy lại web và backend. Chưa làm vì chưa có lệnh deploy riêng.
- Đưa bản sửa lên GitHub: nhánh `fix/pr6-review` chưa push. Cần quyết định push lên nhánh của bạn cùng nhóm hay mở PR.
