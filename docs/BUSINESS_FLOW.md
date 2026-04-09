# BUSINESS_FLOW

## 1) CORE FLOW: EXPENSE (CHI TIỀN)

```txt
[User tạo request]
        ↓
[Expense Request - Approval Module]
        ↓
[Manager APPROVE]
        ↓
Budget Module: reserved += amount
        ↓
[Kế toán thực hiện chi]
        ↓
Transaction Module: create expense transaction
        ↓
Budget Module: reserved -= amount, used += amount
        ↓
Cashbook: balance -= amount
        ↓
Ledger: append entry (immutable)
```

### Rules
- Nếu reject: không được tạo transaction execute.
- Nếu approved nhưng chưa execute: tiền nằm ở `reserved`.
- Không sửa trực tiếp entry ledger.

## 2) INCOME FLOW (THU TIỀN)

```txt
[Kế toán tạo phiếu thu]
        ↓
Transaction Module (INCOME)
        ↓
Budget tracking update (theo chính sách)
        ↓
Cashbook: balance += amount
        ↓
Ledger: append entry
```

## 3) REIMBURSEMENT FLOW

```txt
[Nhân viên xin tạm ứng]
        ↓
[Advance approved + paid]
        ↓
[Nhân viên nộp hóa đơn thực tế]
        ↓
System tính net = advance - actual
        ↓
Nếu net > 0: nhân viên trả lại công ty
Nếu net < 0: công ty trả thêm cho nhân viên
        ↓
Sinh transaction bù trừ
        ↓
Ledger append
```

## 4) BUDGET TRANSFER FLOW

```txt
[Finance Admin tạo lệnh chuyển ngân sách]
        ↓
Validate source available >= amount
        ↓
A.amount -= amount
B.amount += amount
        ↓
Audit log
        ↓
Ledger append
```

## 5) REPORT FLOW

```txt
[User chọn report + bộ lọc]
        ↓
Report Module aggregate read-model
  - Budget
  - Transaction
  - Approval
  - Cashbook
  - Ledger
        ↓
Output:
  - Pie chart cơ cấu chi phí
  - Budget vs Actual
  - Forecast cashflow
```

## 6) BUDGET CONTROL FLOW

- Soft warning khi sử dụng >= 80% ngân sách.
- Hard stop khi available <= 0:
  - khóa nút gửi request chi.
  - chỉ mở khi cấp thêm budget hoặc transfer vào.

## 7) FAILURE/COMPENSATION

- Nếu execute transaction fail sau khi reserved:
  - release reserved.
  - ghi audit log lỗi.
- Nếu cashbook posting fail:
  - rollback transaction boundary.
- Nếu ledger append fail:
  - rollback toàn bộ write-path hoặc đẩy vào retry queue có idempotency key.
