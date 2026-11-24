# Plan cho Haiku: sửa E2E-11, chốt báo cáo, commit tài liệu

> Executor: Haiku (Native). Spec: `docs/superpowers/specs/2026-11-25-final-acceptance-fix-design.md`.

## Global Constraints (đọc kỹ)
- **KHÔNG HỎI BẢO BẤT CỨ ĐIỀU GÌ.** Mọi quyết định đã có trong plan. Gặp lỗi, kết quả lạ hay chỗ không chắc → ghi vào `docs/test-reports/2026-11-24/REPORT.md` mục `## 11` (lệnh đã chạy, kết quả thật, ảnh/log nếu có) rồi **làm tiếp bước sau**. Chỉ được dừng hẳn nếu một lệnh có thể làm mất dữ liệu — trường hợp đó không có trong plan này.
- Chỉ sửa: `app/scripts/test-final-acceptance.mjs` (đúng 1 dòng), `docs/test-reports/2026-11-24/REPORT.md`. Không đụng `src/`, không đụng file khác.
- Không push, không deploy, không chạy `docker`.
- Git Bash. Thư mục gốc `C:/Users/Bao/Desktop/privatehire-react/fe`. Git: `G="$LOCALAPPDATA/GitHubDesktop/app-3.6.10/resources/app/git/cmd/git.exe"`. Commit không có dòng attribution.
- Sửa file bằng `C:/Users/Bao/AppData/Local/Temp/edit.py` (`rep(path, old, new)`, giữ CRLF, báo lỗi nếu đoạn cũ không đúng 1 lần). Nếu `rep` báo lỗi → ghi §11, bỏ qua bước đó, làm tiếp.
- Báo cáo cuối cho Bảo bằng tiếng Việt, ngắn.

## Bước 0 — Môi trường test
1. `netstat -ano | grep -E ":(4400|5190) .*LISTENING" || echo free`. Nếu không `free`: lấy PID và `cmd //c "taskkill /PID <pid> /F"` (chỉ 2 cổng này), rồi tiếp tục.
2. `cd backend && DB_NAME=privatehire_test npm run db:reset -- --demo`
3. Nền: `cd backend && DB_NAME=privatehire_test EMAIL_PROVIDER=MOCK PORT=4400 npx tsx src/index.ts > "$TEMP/be.log" 2>&1 &`
4. Nền: `cd app && API_PROXY_TARGET=http://localhost:4400 npx vite --port 5190 --strictPort > "$TEMP/app.log" 2>&1 &`
5. `sleep 15; curl -s http://localhost:4400/api/health` → có `"database":"up"`. Nếu không → ghi §11 và vẫn làm Bước 1 (sửa file), bỏ qua các bước chạy test.

## Bước 1 — Sửa 1 dòng
`rep("C:/Users/Bao/Desktop/privatehire-react/fe/app/scripts/test-final-acceptance.mjs", 'await page.click(\'button[aria-label="Go Back to Service Selection"]\');', 'await page.click(\'button[data-node-id="6:1619"]\');')`
Kiểm tra: `node --check app/scripts/test-final-acceptance.mjs` → không lỗi.

## Bước 2 — Chạy test (bản tạm, xoá ngay)
Trong `app/scripts`:
- `sed '/executablePath: CHROME_PATH,/d' test-final-acceptance.mjs > _tmp_fa.mjs && BASE_URL=http://localhost:5190 timeout 290 node _tmp_fa.mjs > "$TEMP/fa.log" 2>&1; rm -f _tmp_fa.mjs; grep -E "^\[(PASS|FAIL)\]|TOTAL" "$TEMP/fa.log"` → kỳ vọng `PASSED: 13 | FAILED: 0`.
- Cùng cách với `test-scrum12.mjs` (`_tmp_s12.mjs`) → kỳ vọng `PASSED: 9 | FAILED: 0`.
- `ls _tmp_* 2>/dev/null | wc -l` → `0`.
Nếu còn mục đỏ: chép dòng `[FAIL]` và 3 dòng "Call log" sau nó (`grep -A3 FAIL "$TEMP/fa.log"`) vào §11. **Không sửa thêm**, làm tiếp Bước 3.

## Bước 3 — Sửa báo cáo `REPORT.md`
1. Sửa 2 chỗ ghi sai nguyên nhân E2E-11 (dùng `rep`, đúng nguyên văn):
   - cũ: ``click `change-vehicle-btn` trên màn Availability bị timeout.`` → mới: ``script tìm `button[aria-label="Go Back to Service Selection"]`, nhãn đã bị bỏ trong commit `0d829d9` (18/11); đã sửa ở §11.``
   - cũ: ``click `change-vehicle-btn` timeout trên màn Availability.`` → mới: ``script tìm `button[aria-label="Go Back to Service Selection"]`, nhãn đã bị bỏ trong commit `0d829d9` (18/11); đã sửa ở §11.``
   Nếu `rep` báo không khớp → không sửa dòng cũ, ghi câu đính chính vào §11.
2. Thêm cuối file mục:
```
## 11. Sửa E2E-11 (2026-11-25)
- Đổi selector sang `button[data-node-id="6:1619"]` (commit <hash>).
- test-final-acceptance: <dòng TOTAL thật> · test-scrum12: <dòng TOTAL thật>.
- Ghi chú/lỗi phát sinh: <nếu có, kèm log; nếu không ghi "không có">.
```

## Bước 4 — Commit
1. `"$G" add app/scripts/test-final-acceptance.mjs && "$G" commit -m "test: final-acceptance uses the stable node id for Back to Service Selection"`
2. Điền hash vào §11 (`rep` chuỗi `<hash>`).
3. `"$G" add docs/superpowers docs/test-reports && "$G" commit -m "docs: test plans, specs and test report (2026-11-24/25)"` — chỉ thư mục `docs/`. **Không** add `.claude/`, `.specify/`, `.env*`.
4. `"$G" status --short` → chỉ còn `.claude/` và `.specify/` chưa theo dõi.

## Bước 5 — Dọn và báo cáo
1. Tắt 2 tiến trình ở cổng 4400 và 5190 (PID qua `netstat`, `taskkill`).
2. Trả lời Bảo (tiếng Việt, ≤ 8 dòng): kết quả 2 script (dòng TOTAL thật), 2 commit hash, mọi thứ đã ghi ở §11. Không đặt câu hỏi.
