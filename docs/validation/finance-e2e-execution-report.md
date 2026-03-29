# Finance E2E Execution Report

## Execution date
2026-03-30

## Scope executed
- Baseline setup/checks
- Contract drift validation
- Static business-flow verification from code
- Full implementation + runtime re-validation for remaining defects (transactions auxiliary, cashbook, approval reject/not-execute invariant, OpenAPI parity)

## 1) Baseline run results

## 1.1 Initial attempt (before unblock)
- `docker compose up -d postgres`: **PASS** (container postgres running)
- `npm ci`: **FAIL**
  - Error: `EPERM unlink ... node_modules/.prisma/client/query_engine-windows.dll.node`
- `npm run dev`: **FAIL** (`next is not recognized`)
- `npm run typecheck`: **FAIL** (`tsc is not recognized`)

## 1.2 Unblock actions executed
1. Xác định process Node liên quan và dừng process build cũ đang dùng workspace.
2. Re-run `npm ci` để cài lại dependency theo lockfile dự án.
3. Chạy lại Prisma commands bằng CLI trong project (`npm run prisma:*`, không dùng Prisma 7 global/npx).
4. Dừng process đang chiếm port 3001, start lại dev server.

## 1.3 Re-run results (after unblock)
- `npm ci`: **PASS**
- `npm run prisma:validate`: **PASS**
- `npm run prisma:migrate:deploy`: **PASS** (no pending migrations)
- `npm run prisma:seed`: **PASS**
- `npm run typecheck`: **PASS**
- `npm run test`: **PASS** (9 files, 56 tests)
- `npm run build`: **PASS**
- `npm run dev`: **PASS**
- `GET /api/healthz`: **PASS** (200 with authenticated session cookie)
- `GET /api/health`: **PASS** (200 with authenticated session cookie)

## 1.4 Notes
- Health endpoints đang đi qua middleware auth; gọi không có cookie/token sẽ bị redirect 307 đến `/auth`.
- Còn warning non-blocking:
  - Next.js cảnh báo `middleware` convention deprecated (khuyên chuyển sang `proxy`).
  - Node cảnh báo `MODULE_TYPELESS_PACKAGE_JSON` cho `postcss.config.js`.

## 2) Contract / Route / Client validation
Kết quả chi tiết ở: `docs/validation/contract-drift-matrix.md`

Kết luận chính:
- Thiếu route runtime cho nhiều endpoint UI đang gọi (transactions recurring/attachments/reference-data, cashbook).
- OpenAPI thiếu coverage cho modules transactions/approvals/reimbursements/reports/dashboard.

## 3) Runtime re-test after S0/S1 fixes (2026-03-30)

## 3.1 Approval execute flow (PATCH + action) — FIX VERIFIED
- `PATCH /api/approvals/{id}` (Path A):
  - execute thành công (`EXECUTED`)
  - ledger entries cho transaction = **1**
  - budget movement đúng: `reserved -> 0.00`, `used -> 200000.00`
- `POST /api/approvals/{id}/action` (Path B):
  - manager approve = `APPROVED`
  - accountant execute = `EXECUTED`
  - replay execute cùng `idempotency-key` = vẫn `EXECUTED`, không duplicate side-effects
  - ledger entries cho transaction = **1**
  - budget movement đúng: `reserved -> 0.00`, `used -> 250000.00`

Kết luận:
- Hai path execute đã đồng nhất side-effects tài chính theo flow chuẩn transaction-service.

## 3.2 Idempotency propagation — FIX VERIFIED
- Routes execute đã nhận và forward `idempotency-key`:
  - `src/app/api/approvals/[id]/route.ts`
  - `src/app/api/approvals/[id]/action/route.ts`
  - `src/app/api/transactions/[id]/route.ts`
- Runtime chứng minh replay không tạo duplicate posting ở approval action path.

## 3.3 Reimbursement financial postings — FIX VERIFIED
- `pay-advance` và `complete` đã yêu cầu `idempotency-key`.
- Runtime reimbursement flow:
  - finalStatus = `COMPLETED`
  - `netAmount = 50000.00`, `settlementDirection = RETURN_TO_COMPANY`
  - `transactionCountBefore = 22` -> `transactionCountAfter = 24`
  - `ledgerEntriesForReimbursement = 2` (advance + settlement)

Kết luận:
- Reimbursement đã phát sinh transaction/ledger/cashbook postings theo các bước tài chính chính.

## 3.4 Missing runtime routes referenced by UI (HIGH)
- `/api/transactions/reference-data`
- `/api/transactions/attachments`
- `/api/transactions/recurring`
- `/api/transactions/recurring/run`
- `/api/cashbook`
- `/api/cashbook/reconcile`

Impact:
- Trang transactions có thể hiển thị warning/lỗi ở các tab recurring/cashbook/upload/reference data.

## 4) Full implementation + re-validation result (2026-03-30)

Đã hoàn tất các hạng mục còn lại theo plan:
- Fix transport cho API client để hỗ trợ đúng `FormData` upload attachment.
- Bổ sung đầy đủ routes runtime mà UI đang gọi:
  - `/api/transactions/reference-data`
  - `/api/transactions/attachments`
  - `/api/transactions/recurring`
  - `/api/transactions/recurring/run`
  - `/api/cashbook`
  - `/api/cashbook/reconcile`
- Đóng financial invariant cho approval reject/not-execute:
  - `PATCH /api/approvals/{id}` (action `not-execute`) đã đi qua unified `changeTransactionStatus(...)` path.
  - reject từ trạng thái `APPROVED` dùng approval status kỳ vọng `APPROVED`, release reserved đúng và không double release.
- Bổ sung test cho invariant reject/not-execute trong transaction service.
- Align OpenAPI với runtime surface mới và idempotency headers.
- Mở rộng runtime validation matrix để cover transactions auxiliary + cashbook + approval not-execute.

## 5) Gates + runtime evidence

### 5.1 Static quality gates
- `npm run typecheck`: **PASS**
- `npm run test`: **PASS** (10 files, 58 tests)
- `npm run build`: **PASS**

### 5.2 Runtime matrix (expanded)
Source: `scripts/validation/.tmp/runtime-validation-summary.json`

- Budgeting transfer idempotency: **PASS**
  - `transfer1Replayed=true`, `transfer2Replayed=true`
- Approval execute path A/B + idempotency replay: **PASS**
  - Path A/B đều `EXECUTED`, mỗi transaction có `ledgerEntries=1`
  - Replay execute giữ trạng thái `EXECUTED`, không duplicate side-effects
- Reimbursement lifecycle + postings: **PASS**
  - `finalStatus=COMPLETED`
  - `ledgerEntriesForReimbursement=2`
  - transaction count tăng đúng theo postings
- Transactions auxiliary routes: **PASS**
  - reference-data trả departments/budgets
  - attachment upload thành công (`attachmentUploaded=true`)
  - recurring create/list/run thành công (`recurringRunCreated=1`)
- Cashbook routes + reconcile idempotency: **PASS**
  - cashbook list trả accounts/postings
  - reconcile replay trả `replayed=true`
- Approval not-execute invariant: **PASS**
  - approval + transaction cùng về `REJECTED`
  - reserved budget được release đúng theo flow reject approved-stage
- Reports/dashboard contract runtime: **PASS**
  - reports có `kpis` + `budgetVsActual`
  - dashboard kpis có `totalBudget`, `totalSpent`, `remainingBalance`, `currency`

## 6) Verification status by module (latest)
- Budgeting: **PASS**
- Transactions: **PASS**
- Approval: **PASS**
- Cashbook: **PASS**
- Reimbursement: **PASS**
- Reports/Dashboard: **PASS**
- Security/Audit/Ledger: **PASS**
- FX: **PARTIAL** (luồng CRUD/convert đã có, nhưng chưa mở rộng scenario runtime chuyên biệt trong script này)

Overall verdict: **READY (major flows pass end-to-end)** cho toàn bộ scope defects đã liệt kê và fix trong vòng này. Chỉ còn backlog mở rộng riêng cho FX deep-runtime scenario nếu cần coverage chuyên sâu hơn.

## 7) Next actions (optional hardening)
1. Thêm block runtime riêng cho FX conversion scenario vào `runtime-validation.ps1`.
2. Bổ sung integration tests cho cashbook/recurring routes để giảm phụ thuộc manual runtime script.
3. Theo dõi warning non-blocking Next.js middleware/proxy migration trong backlog kỹ thuật.
