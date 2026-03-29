# Finance E2E Test Plan

## 1) Scope
Xác thực toàn bộ hệ thống Quản lý Ngân sách & Thu/Chi theo các chiều:
- Business requirements
- Input/Output contracts
- Workflow liên thông module
- Đồng bộ UI - API - DB
- Security/RBAC/Audit/Immutable behavior

Modules trong scope:
- Budgeting
- Transaction (Thu/Chi)
- Approval
- Budget Control
- Cashbook
- Reimbursement
- FX / Multi-currency
- Reports
- Security & Audit / Ledger

## 2) Environment run/start
### 2.1 Setup chuẩn
1. `npm ci`
2. `docker compose up -d postgres`
3. `npm run prisma:generate`
4. `npm run prisma:validate`
5. `npm run prisma:migrate:deploy`
6. `npm run prisma:seed`
7. `npm run dev`

### 2.2 Quality gates
1. `npm run typecheck`
2. `npm run test`
3. `npm run build`
4. `GET /api/healthz`
5. `GET /api/health`

## 3) Test matrix theo module

## 3.1 Budgeting & Budget Control
### TC-BUD-01: Tạo budget
- Preconditions: FINANCE_ADMIN token, department hợp lệ
- Action: POST /api/budgets
- Expected API: 201 + budget object
- Expected DB: Budget row mới, reserved=0, used=0
- Expected UI: xuất hiện trong trang budget

### TC-BUD-02: Hard stop khi available <= 0
- Preconditions: policy hard-stop enabled, budget available <= 0
- Action: POST /api/transactions (EXPENSE)
- Expected API: 422 UNPROCESSABLE
- Expected DB: không tạo transaction mới
- Expected UI: báo lỗi, chặn submit

### TC-BUD-03: Budget transfer idempotency
- Preconditions: 2 budgets hợp lệ
- Action: POST /api/budgets/{id}/transfer với cùng idempotency-key 2 lần
- Expected API: lần 2 replay/no duplicate effect
- Expected DB: 1 BudgetTransfer logic effect, số dư thay đổi đúng 1 lần
- Expected UI: hiển thị đúng lịch sử chuyển

## 3.2 Transactions
### TC-TXN-01: Expense create reserve
- Preconditions: EMPLOYEE token, budget đủ
- Action: POST /api/transactions (EXPENSE)
- Expected API: status PENDING
- Expected DB: Budget.reserved tăng theo amount
- Expected UI: hiển thị ở danh sách giao dịch chờ duyệt

### TC-TXN-02: Income executed path
- Preconditions: ACCOUNTANT token
- Action: POST /api/transactions (INCOME, status=EXECUTED)
- Expected DB:
  - Transaction EXECUTED
  - Ledger entry type INCOME
  - Cashbook posting IN
- Expected UI: tổng thu cập nhật

### TC-TXN-03: Split validation
- Preconditions: payload có splits
- Action: POST /api/transactions với tổng splits != amount
- Expected API: INVALID_INPUT
- Expected DB: không lưu transaction

## 3.3 Approval
### TC-APR-01: Manager approve/reject
- Preconditions: Approval ở PENDING
- Action: PATCH /api/approvals/{id} action approve/reject
- Expected API: approval status cập nhật
- Expected DB: transaction status tương ứng

### TC-APR-02: Accountant execute
- Preconditions: Approval APPROVED
- Action A: PATCH /api/approvals/{id} action execute
- Action B: POST /api/approvals/{id}/action action execute
- Expected: A và B phải tạo side-effect kế toán tương đương (budget/cashbook/ledger)

## 3.4 Cashbook
### TC-CBK-01: Read cashbook
- Preconditions: ACCOUNTANT/FINANCE_ADMIN/AUDITOR token
- Action: GET /api/cashbook
- Expected: trả accounts + postings

### TC-CBK-02: Reconcile
- Preconditions: account tồn tại
- Action: POST /api/cashbook/reconcile
- Expected: adjustment transaction/posting/ledger theo delta

## 3.5 Reimbursement
### TC-RMB-01: Full lifecycle
- Preconditions: employee request mới
- Action: approve advance -> pay advance -> submit settlement -> review -> complete
- Expected API: trạng thái đúng thứ tự
- Expected DB: net settlement tính đúng
- Expected cross-module: có financial postings tương ứng

### TC-RMB-02: Settlement invalid amount
- Preconditions: ADVANCE_PAID
- Action: submit settlement actualAmount <= 0
- Expected API: INVALID_INPUT

## 3.6 FX / Multi-currency
### TC-FX-01: USD expense auto-conversion
- Preconditions: rate source available
- Action: POST /api/transactions EXPENSE với fxCurrency=USD + fxAmount
- Expected DB: lưu fxRate/fxAmount/baseAmount + amount VND

## 3.7 Reports
### TC-RPT-01: Overview consistency
- Preconditions: có dữ liệu thu/chi
- Action: GET /api/reports + dashboard endpoints
- Expected: tổng hợp khớp dữ liệu ledger/transactions

## 3.8 Security / Audit / Ledger
### TC-SEC-01: RBAC boundaries
- Action: gọi endpoint bằng role không đủ quyền
- Expected: 403

### TC-LED-01: Reversal
- Action: POST /api/ledger/{id}/reversal
- Expected DB: tạo REVERSAL entry, cập nhật trạng thái transaction liên quan theo rule

## 4) Cross-module invariants (bắt buộc)
1. Expense execute:
   - Budget.reserved giảm đúng amount
   - Budget.used tăng đúng amount
   - 1 ledger entry EXPENSE
   - 1 cashbook posting OUT
2. Reject expense:
   - release reserved
   - không có execute side-effects
3. Idempotency:
   - cùng key không tạo duplicate posting/ledger
4. Reimbursement settlement:
   - net = advance - actual
   - direction đúng với dấu net

## 5) Defect taxonomy
- CONTRACT_DRIFT
- WORKFLOW_BREAK
- FINANCIAL_INVARIANT
- IDEMPOTENCY
- AUTH_RBAC
- DATA_CONSISTENCY

Severity:
- S0: sai lệch tài chính / double posting
- S1: block workflow chính
- S2: lỗi chức năng có workaround
- S3: lệch tài liệu/UX
