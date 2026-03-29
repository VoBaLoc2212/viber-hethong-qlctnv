# API_CONTRACT

## 1) Nguyên tắc

- API contract source of truth: `src/lib/api-spec/openapi.yaml`.
- Mọi thay đổi endpoint phải cập nhật OpenAPI trước, sau đó mới code.

## 2) Versioning

- `info.version` theo semantic version.
- Breaking change bắt buộc tăng major + ghi migration note.
- Không đổi nghĩa field cũ theo cách silent.

## 3) Chuẩn request/response

### Request
- JSON UTF-8.
- Riêng endpoint upload file (`/api/transactions/attachments`) dùng `multipart/form-data`.
- Date/time: ISO-8601 UTC.
- Money: dùng decimal string ở service boundary nếu cần tránh sai số.

### Response success
```json
{
  "data": {},
  "meta": {}
}
```

### Response error
```json
{
  "code": "BUDGET_NOT_ENOUGH",
  "message": "Ngân sách khả dụng không đủ",
  "details": {},
  "correlationId": "..."
}
```

## 4) Status code policy

- `200`: read/update thành công.
- `201`: tạo mới thành công.
- `400`: input sai format/validation.
- `401`: chưa xác thực.
- `403`: không đủ quyền.
- `404`: không tìm thấy.
- `409`: conflict trạng thái/domain invariant.
- `422`: nghiệp vụ không thỏa điều kiện.
- `500`: lỗi hệ thống.

## 5) Contract workflow trong PR

Checklist bắt buộc:
1. Update OpenAPI.
2. Regenerate zod/client.
3. Update handler/service.
4. Update tests.
5. Update docs liên quan (`SHARED_TYPES.md`, `BUSINESS_FLOW.md` nếu đổi hành vi).

## 6) Endpoint groups chuẩn

- `/api/healthz`
- `/api/budgeting/*`
- `/api/approvals/*`
- `/api/transactions/*`
- `/api/reports/*`
- `/api/auth/*`
- `/api/ai/*`

## 7) Idempotency

Các API write quan trọng (`execute transaction`, `budget transfer`, `reimbursement settle`) cần idempotency key để tránh double posting.

## 8) Authorization matrix (rút gọn)

- Employee: tạo request/reimbursement.
- Manager: duyệt/reject approval.
- Accountant: execute transaction, cashbook.
- Finance Admin: budget setup/transfer/policy.
- Auditor: read-only logs/reports/ledger.
