# Đề xuất sửa file bảo vệ (CHƯA ÁP DỤNG — chờ Bảo ghi "duyệt")

Nguồn: `REPORT.md` BUG-01 (`docs/test-reports/2026-11-24/REPORT.md`). Hai script của nhóm còn đợi luồng đăng ký cũ
(Create Account → `/register/complete`). Luồng hiện tại (AC-14) có thêm bước nhập mã OTP ở `/verify-email`.
`selftest.mjs` (dòng 255–275) đã làm đúng bước này; đề xuất chép lại cách đó, **không đổi** câu kiểm tra nào khác.

Điều kiện chạy: backend phải ở chế độ MOCK (như khi chạy selftest) để đọc mã qua `/api/dev/last-verification-code`.

## 1. `app/scripts/test-scrum12.mjs`

Thêm hàm này ngay trước dòng `// T04: Fill valid form data` (cùng phạm vi với `page`, `wait`, `assert`, `BASE_URL`):

```js
  // Luồng AC-14: sau Create Account phải nhập mã OTP. Email thử không nhận được thư thật,
  // backend MOCK giữ mã ở /api/dev (giống selftest.mjs).
  async function enterOtp(email) {
    await page.waitForURL("**/verify-email", { timeout: 5000 });
    const res = await page.request.get(`${BASE_URL}/api/dev/last-verification-code?email=${encodeURIComponent(email)}`);
    assert(res.ok(), `Cannot read the OTP (HTTP ${res.status()})`);
    const { code } = await res.json();
    await page.fill("#code", code);
    await page.click('[data-testid="verify-code"]');
    await wait(800);
  }
```

**T04** — chèn một dòng sau `await page.click("button[type=submit]"); await wait(400);` (trước `const currentUrl = page.url();`):

```diff
     await page.click("button[type=submit]");
     await wait(400);
+    await enterOtp(testEmail);
 
     const currentUrl = page.url();
```

**T08** — chèn một dòng trước câu kiểm tra `Must be on /register/complete`:

```diff
     await page.click("button[type=submit]");
     await wait(400);
+    await enterOtp(secondEmail);
 
     assert(new URL(page.url()).pathname === "/register/complete", "Must be on /register/complete");
```

T05, T06, T07, T09 giữ nguyên (T05 và T09 đang đỏ chỉ vì dây chuyền từ T04).

## 2. `app/scripts/test-final-acceptance.mjs`

Thêm cùng hàm `enterOtp` ngay trước dòng `await test("E2E-01", "Register -> Login -> Home flow", async () => {`,
rồi chèn một dòng trong E2E-01:

```diff
     await page.click("button[type=submit]");
     await wait(400);
+    await enterOtp(auditEmail);
 
     assert(new URL(page.url()).pathname === "/register/complete", "Expected /register/complete");
```

E2E-02…E2E-13 giữ nguyên (đang đỏ do dây chuyền từ E2E-01).

## 3. Kiểm tra sau khi áp dụng

1. Chạy lại bằng bản tạm bỏ dòng `executablePath: CHROME_PATH,` với `BASE_URL=http://localhost:5190` và backend MOCK:
   - `test-scrum12` kỳ vọng `PASSED: 9 | FAILED: 0`.
   - `test-final-acceptance` kỳ vọng `PASSED: 13 | FAILED: 0`.
2. Nếu vẫn còn mục đỏ sau E2E-01 thì nguyên nhân không phải dây chuyền — ghi thành lỗi mới, **không** sửa tiếp khi chưa hỏi.
3. `selftest.mjs` vẫn `15/15`.

## 4. Còn chờ duyệt từ trước

- Thay khối AC-15 trong `selftest.mjs` và sửa tài liệu: xem `docs/superpowers/plans/2026-11-24-ac15-proposal.md`.
