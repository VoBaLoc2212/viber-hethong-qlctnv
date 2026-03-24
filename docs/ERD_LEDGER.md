# ERD_LEDGER

## 1) Mục tiêu

Mô tả cấu trúc dữ liệu cốt lõi cho flow:
Budget -> Approval -> Transaction -> Cashbook -> Ledger (immutable)

## 2) Entities chính

- `users`
- `departments`
- `budgets`
- `approvals`
- `transactions`
- `cashbook_accounts`
- `cashbook_postings`
- `ledger_entries`
- `budget_transfers`
- `reimbursements`
- `audit_logs`

## 3) Quan hệ logic

```txt
Department 1---n Budget
Budget 1---n Approval (qua transaction/request)
Approval 1---1 Transaction (expense path)
Transaction 1---n CashbookPosting
Transaction 1---n LedgerEntry (qua reference)
BudgetTransfer -> LedgerEntry
Reimbursement -> Transaction -> LedgerEntry
User 1---n (transaction createdBy, approval approver, ledger createdBy)
```

## 4) Nguyên tắc ledger bất biến

- `ledger_entries` chỉ INSERT.
- Không cho UPDATE/DELETE ở tầng service.
- Khi cần chỉnh sai: tạo entry type `REVERSAL` tham chiếu entry cũ.

## 5) Trường bắt buộc của ledger entry

- `entryCode` (unique)
- `type`
- `amount`
- `currency`
- `referenceType`
- `referenceId`
- `createdBy`
- `createdAt`

## 6) Audit

Mọi thao tác nhạy cảm (approve, execute, transfer, reversal) phải ghi `audit_logs`.

## 7) Tương thích migration

Trong giai đoạn migration incremental:
- dữ liệu legacy có thể map sang schema mới bằng bridge id/reference.
- không xóa bảng legacy cho đến khi migration data hoàn tất và pass regression.
