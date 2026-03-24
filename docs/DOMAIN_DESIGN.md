# DOMAIN_DESIGN

## 1) Ubiquitous language

- **Budget**: ngân sách được cấp cho Department/Project theo kỳ.
- **Reserved (Encumbrance)**: phần ngân sách giữ chỗ sau khi duyệt nhưng chưa chi.
- **Used (Spent)**: phần ngân sách đã chi thực tế.
- **Available**: số có thể dùng ngay, tính theo công thức chuẩn.
- **Approval Request**: yêu cầu chi cần manager duyệt.
- **Transaction**: nghiệp vụ thu hoặc chi.
- **Cashbook Posting**: bút toán vào/ra quỹ tiền mặt/ngân hàng.
- **Ledger Entry**: dòng sổ cái bất biến.
- **Reversal Entry**: bút toán đảo để sửa sai thay vì sửa/xóa dòng cũ.
- **Reimbursement**: quy trình tạm ứng và quyết toán hoàn ứng.

## 2) Core invariants

1. `available = amount - reserved - used` luôn đúng.
2. Không cho `available < 0` khi hard-stop đang bật.
3. Ledger đã ghi không được sửa/xóa.
4. Nếu cần chỉnh sai, tạo reversal entry.
5. Không module nào update bảng của module khác trực tiếp.

## 3) Aggregates

### Budget aggregate
- Root: `Budget`
- State: `amount`, `reserved`, `used`
- Commands:
  - allocate budget
  - reserve budget
  - release reserve
  - consume budget
  - transfer budget

### Approval aggregate
- Root: `ApprovalRequest`
- State: `PENDING|APPROVED|REJECTED`
- Command: approve/reject
- Side effect: reserve/release budget

### Transaction aggregate
- Root: `Transaction`
- State lifecycle:
  - `DRAFT -> PENDING -> APPROVED -> EXECUTED`
  - hoặc `PENDING/APPROVED -> REJECTED`
  - khi chỉnh sai sau execute: tạo `REVERSED` bằng reversal flow

### Ledger aggregate
- Root: `LedgerEntry`
- Chỉ append.
- Link bắt buộc tới reference (`TRANSACTION`, `BUDGET_TRANSFER`, `REIMBURSEMENT`, ...)

## 4) Bounded contexts

- **Budgeting context**: ngân sách, hạn mức, transfer.
- **Approval context**: yêu cầu và phê duyệt chi.
- **Transaction context**: thu/chi, split/recurring.
- **Cashbook context**: quỹ và đối soát.
- **Ledger context**: sổ cái immutable + reversal.
- **Reporting context**: aggregate read-model.
- **AI context**: RAG truy vấn read-model theo policy read-only.

## 5) Domain events (chuẩn)

- `approval.approved`
- `approval.rejected`
- `budget.reserved`
- `budget.released`
- `transaction.executed`
- `cashbook.posted`
- `ledger.appended`

## 6) Role model

- `EMPLOYEE`: tạo request/submit reimbursement.
- `MANAGER`: duyệt hoặc từ chối yêu cầu.
- `ACCOUNTANT`: execute transaction, cashbook/reconcile.
- `FINANCE_ADMIN`: setup budget, transfer budget, policy.
- `AUDITOR`: read-only audit/ledger/report.

## 7) Data consistency strategy

- Các bước đa module phải chạy trong transaction boundary ở service orchestrator.
- Thao tác ghi ledger xảy ra sau khi domain command chính thành công.
- Với tác vụ async/report, dùng read-model eventual consistency có timestamp rõ ràng.
