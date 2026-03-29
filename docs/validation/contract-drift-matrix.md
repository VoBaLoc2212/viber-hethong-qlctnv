# Contract Drift Matrix (UI/API/OpenAPI)

## Summary
Đối chiếu giữa:
- Frontend client endpoint calls: `src/lib/api/endpoints.ts`
- Runtime routes: `src/app/api/**/route.ts`
- OpenAPI: `src/lib/api-spec/openapi.yaml`

Kết luận: có drift đáng kể ở nhóm Transaction/Cashbook/Approval/Reimbursement/Reports.

## Matrix
| Endpoint | Frontend client | Runtime route | OpenAPI | Status | Notes |
|---|---|---|---|---|---|
| /api/transactions | Yes | Yes | No | CONTRACT_DRIFT | Runtime có, OpenAPI thiếu |
| /api/transactions/{id} | (indirect) | Yes | No | CONTRACT_DRIFT | OpenAPI thiếu |
| /api/transactions/reference-data | Yes | No | No | MISSING_ROUTE | UI gọi endpoint không tồn tại |
| /api/transactions/attachments | Yes | No | No | MISSING_ROUTE | UI upload hóa đơn sẽ fail |
| /api/transactions/recurring | Yes | No | No | MISSING_ROUTE | UI recurring sẽ fail |
| /api/transactions/recurring/run | Yes | No | No | MISSING_ROUTE | UI recurring run sẽ fail |
| /api/cashbook | Yes | No | No | MISSING_ROUTE | UI cashbook sẽ fail |
| /api/cashbook/reconcile | Yes | No | No | MISSING_ROUTE | UI reconcile sẽ fail |
| /api/approvals | Yes | Yes | No | CONTRACT_DRIFT | OpenAPI thiếu |
| /api/approvals/{id} | Yes (PATCH) | Yes | No | CONTRACT_DRIFT | OpenAPI thiếu |
| /api/approvals/{id}/action | No (UI hiện dùng PATCH /{id}) | Yes | No | FLOW_DRIFT | 2 path execute khác side-effects |
| /api/reimbursements* | Yes (via api-client hooks) | Yes | No | CONTRACT_DRIFT | OpenAPI thiếu module reimbursement |
| /api/reports | (not from transactions page) | Yes | No | CONTRACT_DRIFT | OpenAPI thiếu |
| /api/dashboard/kpis | (dashboard usage) | Yes | No | CONTRACT_DRIFT | OpenAPI thiếu |
| /api/dashboard/expenses-by-month | (dashboard usage) | Yes | No | CONTRACT_DRIFT | OpenAPI thiếu |
| /api/fx-rates | Yes | Yes | Yes | PARTIAL_DRIFT | Spec mô tả create/update nhưng runtime đang forbid manual update |
| /api/fx-rates/{id} | Yes | Yes | Yes | PARTIAL_DRIFT | PUT route hiện trả FORBIDDEN |
| /api/budgets* | Yes | Yes | Yes | OK | Core budgeting khớp tương đối |
| /api/ledger* | Yes | Yes | Yes | OK | Reversal có idempotency header |
| /api/logs* | Yes | Yes | Yes | PARTIAL | internal immutable endpoint chưa phản ánh rõ trong OpenAPI |

## Evidence pointers
- Client endpoints: `src/lib/api/endpoints.ts`
- Runtime route inventory: `src/app/api/**/route.ts`
- OpenAPI paths hiện có: `/logs`, `/budgets`, `/ledger`, `/fx-rates` (không thấy transactions/approvals/reimbursements/reports/dashboard)

## High-risk drift to fix first
1. `/api/transactions/reference-data` (UI dependency tại transactions page)
2. `/api/transactions/attachments`
3. `/api/transactions/recurring`, `/api/transactions/recurring/run`
4. `/api/cashbook`, `/api/cashbook/reconcile`
5. Chuẩn hóa execute path approvals: `/api/approvals/{id}` vs `/api/approvals/{id}/action`
