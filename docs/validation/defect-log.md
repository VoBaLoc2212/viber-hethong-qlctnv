# Defect Log

## Severity scale
- S0: sai lệch tài chính nghiêm trọng / double posting / ledger inconsistency
- S1: chặn flow nghiệp vụ chính
- S2: lỗi chức năng có workaround
- S3: lệch tài liệu/UX/non-critical

## Defects

## DF-001
- Category: WORKFLOW_BREAK, FINANCIAL_INVARIANT
- Severity: S0
- Title: Execute approval có 2 đường xử lý không đồng nhất side-effects
- Requirement violated: Expense core flow phải tạo đủ budget/cashbook/ledger side-effects khi execute
- Repro (code-level):
  1. So sánh `PATCH /api/approvals/{id}`
  2. So sánh `POST /api/approvals/{id}/action`
- Expected: cả 2 path execute cho kết quả tài chính tương đương
- Actual:
  - Path PATCH dùng `approvalAction`: update status
  - Path action dùng `changeTransactionStatus`: update budget + ledger + cashbook + audit
- Evidence:
  - `src/app/api/approvals/[id]/route.ts`
  - `src/modules/approval/services/approval-service.ts`
  - `src/app/api/approvals/[id]/action/route.ts`
  - `src/modules/transaction/services/transaction-service.ts`
- Status: Closed

## DF-002
- Category: IDEMPOTENCY
- Severity: S1
- Title: Execute yêu cầu idempotency-key nhưng routes không truyền vào service
- Requirement violated: retry execute không được tạo side-effects trùng
- Repro (code-level):
  1. `changeTransactionStatus` check `idempotency-key` cho action execute
  2. routes gọi hàm nhưng không lấy/truyền header
- Expected: route nhận header và forward vào service
- Actual: thiếu propagation
- Evidence:
  - `src/modules/transaction/services/transaction-service.ts`
  - `src/app/api/transactions/[id]/route.ts`
  - `src/app/api/approvals/[id]/action/route.ts`
- Status: Closed

## DF-003
- Category: CONTRACT_DRIFT
- Severity: S1
- Title: Endpoint `/api/transactions/reference-data` được UI gọi nhưng route không tồn tại
- Requirement violated: UI/API sync
- Expected: endpoint tồn tại và trả department + budget reference
- Actual (re-test 2026-03-30): route implemented, runtime trả departments + budgets đúng shape
- Evidence:
  - `src/app/api/transactions/reference-data/route.ts`
  - `scripts/validation/.tmp/runtime-validation-summary.json` (`transactionsAuxiliary.referenceDataDepartments`, `referenceDataBudgets`)
- Status: Closed (fixed + runtime re-test pass on 2026-03-30)

## DF-004
- Category: CONTRACT_DRIFT
- Severity: S1
- Title: Endpoint `/api/transactions/attachments` được UI gọi nhưng route không tồn tại
- Requirement violated: upload hóa đơn phải hoạt động
- Expected: route upload attachment
- Actual (re-test 2026-03-30): route implemented, multipart upload runtime pass
- Evidence:
  - `src/app/api/transactions/attachments/route.ts`
  - `scripts/validation/.tmp/runtime-validation-summary.json` (`transactionsAuxiliary.attachmentUploaded=true`)
- Status: Closed (fixed + runtime re-test pass on 2026-03-30)

## DF-005
- Category: CONTRACT_DRIFT
- Severity: S1
- Title: Endpoints recurring transaction được UI gọi nhưng routes không tồn tại
- Requirement violated: recurring workflow
- Expected:
  - `/api/transactions/recurring`
  - `/api/transactions/recurring/run`
- Actual (re-test 2026-03-30): routes implemented; create/list/run runtime pass
- Evidence:
  - `src/app/api/transactions/recurring/route.ts`
  - `src/app/api/transactions/recurring/run/route.ts`
  - `scripts/validation/.tmp/runtime-validation-summary.json` (`transactionsAuxiliary.recurringRunCreated=1`)
- Status: Closed (fixed + runtime re-test pass on 2026-03-30)

## DF-006
- Category: CONTRACT_DRIFT
- Severity: S1
- Title: Endpoints cashbook được UI gọi nhưng routes không tồn tại
- Requirement violated: cashbook/reconcile workflow
- Expected:
  - `/api/cashbook`
  - `/api/cashbook/reconcile`
- Actual (re-test 2026-03-30): routes implemented; list/reconcile/replay runtime pass
- Evidence:
  - `src/app/api/cashbook/route.ts`
  - `src/app/api/cashbook/reconcile/route.ts`
  - `scripts/validation/.tmp/runtime-validation-summary.json` (`cashbook.reconcileReplay=true`)
- Status: Closed (fixed + runtime re-test pass on 2026-03-30)

## DF-007
- Category: WORKFLOW_BREAK
- Severity: S1
- Title: Reimbursement flow chưa tích hợp financial postings theo flow nghiệp vụ
- Requirement violated: reimbursement complete cần bút toán bù trừ + ledger append
- Expected: tạo transaction/cashbook/ledger ở các bước cần thiết
- Actual: service chủ yếu đổi status + audit
- Evidence:
  - `src/modules/reimbursement/services/reimbursement-service.ts`
  - `docs/BUSINESS_FLOW.md` (Reimbursement flow)
- Status: Closed

## DF-008
- Category: CONTRACT_DRIFT
- Severity: S2
- Title: OpenAPI thiếu coverage modules transactions/approvals/reimbursements/reports/dashboard
- Requirement violated: contract tests và tài liệu API runtime phải khớp
- Expected: OpenAPI mô tả đầy đủ runtime surface
- Actual: openapi.yaml chủ yếu có budgets/controls/logs/ledger/fx
- Evidence:
  - `src/lib/api-spec/openapi.yaml`
  - route inventory `src/app/api/**/route.ts`
- Status: Closed

## DF-009
- Category: ENVIRONMENT
- Severity: S1
- Title: Không chạy được baseline do dependency/toolchain mismatch
- Requirement violated: quality gate phải chạy được (typecheck/test/build/dev)
- Expected: run scripts thành công
- Actual (initial):
  - npm ci EPERM unlink prisma engine dll
  - dev/typecheck fail vì next/tsc missing
  - prisma validate fail do prisma CLI 7 incompatible schema style project hiện tại
- Resolution:
  - dừng process Node liên quan đang giữ lock
  - cài lại dependency bằng `npm ci`
  - chạy lại toàn bộ gates thành công
- Evidence:
  - command outputs trong phiên kiểm thử
- Status: Closed

## DF-010
- Category: FINANCIAL_INVARIANT, WORKFLOW_BREAK
- Severity: S0
- Title: Execute qua `PATCH /api/approvals/{id}` không tạo side-effects kế toán
- Requirement violated: expense execute phải tạo ledger + chuyển budget reserved->used
- Repro (runtime):
  1. Tạo expense
  2. Manager approve bằng `PATCH /api/approvals/{id}`
  3. Accountant execute bằng `PATCH /api/approvals/{id}`
- Expected:
  - transaction EXECUTED
  - ledger entry EXPENSE được tạo
  - budget reserved giảm, used tăng
- Actual (re-test 2026-03-30):
  - transaction EXECUTED
  - ledger entries cho transaction = 1
  - reserved giảm về 0.00, used tăng đúng amount
- Evidence:
  - `scripts/validation/.tmp/runtime-validation-summary.json`
  - `src/app/api/approvals/[id]/route.ts`
  - `src/modules/transaction/services/transaction-service.ts`
- Status: Closed (fixed + runtime re-test pass on 2026-03-30)

## DF-011
- Category: IDEMPOTENCY, WORKFLOW_BREAK
- Severity: S1
- Title: Execute qua `POST /api/approvals/{id}/action` fail 400 do thiếu idempotency-key
- Requirement violated: execute flow phải chạy được qua endpoint action
- Repro (runtime):
  1. Tạo expense
  2. Manager approve bằng `/api/approvals/{id}/action`
  3. Accountant execute bằng `/api/approvals/{id}/action`
- Expected: execute thành công, tạo ledger/cashbook/budget side-effects
- Actual (re-test 2026-03-30): execute thành công với `idempotency-key`; replay cùng key không duplicate posting
- Evidence:
  - `scripts/validation/.tmp/runtime-validation-summary.json`
  - `src/app/api/approvals/[id]/action/route.ts`
  - `src/app/api/transactions/[id]/route.ts`
  - `src/modules/transaction/services/transaction-service.ts`
- Status: Closed (fixed + runtime re-test pass on 2026-03-30)

## DF-012
- Category: WORKFLOW_BREAK, DATA_CONSISTENCY
- Severity: S1
- Title: Reimbursement complete không phát sinh transaction/accounting postings
- Requirement violated: flow reimbursement yêu cầu bút toán bù trừ tài chính
- Repro (runtime):
  1. Employee create reimbursement
  2. Manager approve
  3. Accountant pay advance
  4. Employee submit settlement
  5. Accountant review + complete
- Expected: phát sinh transaction/posting tương ứng net settlement
- Actual (re-test 2026-03-30): transactionCount tăng 22 -> 24; ledgerEntriesForReimbursement = 2 (advance + settlement)
- Evidence:
  - `scripts/validation/.tmp/runtime-validation-summary.json`
  - `src/modules/reimbursement/services/reimbursement-service.ts`
  - `src/app/api/reimbursements/[id]/pay-advance/route.ts`
  - `src/app/api/reimbursements/[id]/complete/route.ts`
- Status: Closed (fixed + runtime re-test pass on 2026-03-30)
