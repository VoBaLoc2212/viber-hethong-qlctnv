# TESTING

## 1) Mục tiêu

Đảm bảo đúng business flow tài chính, đặc biệt các flow có ràng buộc ngân sách và ledger immutable.

## 2) Test pyramid

- Unit tests: service/domain rules.
- Integration tests: API + DB + nhiều module.
- E2E smoke tests: flow end-to-end theo use case chính.

## 3) Các flow bắt buộc test

1. Expense core flow (request -> approve -> execute -> ledger).
2. Budget hard-stop khi available = 0.
3. Budget transfer + audit + ledger.
4. Income flow + cashbook increment.
5. Reimbursement netting.
6. Report aggregate (budget vs actual + pie + forecast).

## 4) Contract tests

- OpenAPI phải khớp response runtime.
- Generated zod/client phải được regenerate khi contract đổi.

## 5) DB tests

- Migration apply/rollback trên test DB.
- Invariants: không âm available, ledger không update/delete.

## 6) CI gates

- Typecheck
- Test suite
- Build legacy + build Next scaffold
- Security scan

## 7) Definition of quality gate

Không merge nếu:
- Contract drift
- Invariant fail
- CI fail
- Thiếu test cho flow mới thêm
