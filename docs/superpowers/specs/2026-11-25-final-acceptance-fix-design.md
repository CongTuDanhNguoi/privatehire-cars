# Sửa test-final-acceptance E2E-11 — design ngắn (Bảo đã chọn phương án A)

- **Vì sao:** `test-final-acceptance` đỏ 11/13. E2E-11 tìm `button[aria-label="Go Back to Service Selection"]`; nhãn này bị bỏ trong commit `0d829d9` (18/11, thiết kế lại Journey). E2E-13 đỏ dây chuyền. App không lỗi.
- **Mục tiêu:** 13/13 mà không đổi code app.
- **Không làm:** không sửa app, không đổi test khác, không push, không deploy.
- **Ràng buộc:** file script được bảo vệ — Bảo đã duyệt đúng 1 dòng này. Selector mới dùng `data-node-id` (thuộc tính được bảo vệ, không bao giờ đổi).
- **Phương án đã cân nhắc:** (A, chọn) đổi selector trong script; (B) thêm lại aria-label vào app — sửa app chỉ để khớp test cũ; (C) chọn theo chữ — dễ vỡ khi đổi câu chữ.
- **Cách làm:** `button[aria-label="Go Back to Service Selection"]` → `button[data-node-id="6:1619"]` (nút "Back to Service Selection" ở cuối màn Journey, `JourneyDetailsPage.tsx`).
- **Kèm theo:** sửa mô tả sai về E2E-11 trong `REPORT.md` (§9, §10); commit các file plan/spec/báo cáo đang để ngoài git.
