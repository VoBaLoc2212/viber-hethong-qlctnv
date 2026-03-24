# SHARED_TYPES

## 1) Mục tiêu

Định nghĩa kiểu dữ liệu dùng chung giữa frontend/backend để tránh lệch contract.

## 2) Shared enums

### UserRole
- `EMPLOYEE`
- `MANAGER`
- `ACCOUNTANT`
- `FINANCE_ADMIN`
- `AUDITOR`

### TransactionType
- `INCOME`
- `EXPENSE`

### TransactionStatus
- `DRAFT`
- `PENDING`
- `APPROVED`
- `EXECUTED`
- `REJECTED`
- `REVERSED`

### ApprovalStatus
- `PENDING`
- `APPROVED`
- `REJECTED`

### LedgerEntryType
- `EXPENSE`
- `INCOME`
- `TRANSFER`
- `ADJUSTMENT`
- `REVERSAL`

## 3) Shared value objects

### Money
```ts
{
  amount: string;   // decimal string
  currency: string; // "VND" | "USD" ...
}
```

### ApiErrorShape
```ts
{
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string;
}
```

## 4) Date/time rules

- Lưu và truyền theo ISO-8601 UTC.
- Không dùng local time trong business quyết toán.

## 5) Numeric rules

- DB: Decimal/NUMERIC.
- Service boundary: decimal string cho tiền tệ.
- UI charting có thể cast sang number ở read model, không mutate value gốc.

## 6) Ownership

- Canonical source: OpenAPI + Prisma schema.
- Shared types trong code chỉ là projection của 2 nguồn canonical trên.
