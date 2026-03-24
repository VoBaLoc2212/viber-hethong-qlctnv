# ARCHITECTURE

## 1) Mục tiêu kiến trúc

Xây dựng nền tảng quản lý ngân sách và thu/chi nội bộ theo kiến trúc module, cho phép 4 dev làm song song mà không đụng chéo logic cốt lõi.

Mục tiêu chính:
- Chuẩn hóa kiến trúc theo `src/`.
- Áp dụng contract-first (DB + API + shared types).
- Bảo toàn business flow tài chính chuẩn: Budget -> Approval -> Transaction -> Ledger.
- Hỗ trợ migration incremental từ stack cũ sang stack mới.

## 2) Runtime hiện tại

### Runtime chính
- Web + API: Next.js App Router (`src/app`)
- API layer: Route handlers trong `src/app/api/*`
- Data layer: Prisma (`src/lib/db/prisma/schema.prisma`)
- Contract: `src/lib/api-spec/openapi.yaml`

## 3) Cấu trúc thư mục chuẩn

```txt
src/
├── app/
│   ├── (dashboard)/
│   ├── budgeting/
│   ├── transactions/
│   ├── approvals/
│   ├── reports/
│   └── api/
│       ├── budgeting/
│       ├── transactions/
│       ├── approvals/
│       ├── reports/
│       ├── auth/
│       └── ai/
├── modules/
│   ├── budgeting/
│   ├── ledger/
│   ├── transaction/
│   ├── cashbook/
│   ├── approval/
│   ├── reimbursement/
│   ├── fx/
│   ├── report/
│   ├── ai/
│   └── shared/
├── components/
├── lib/
│   ├── api-spec/
│   ├── auth/
│   ├── storage/
│   └── db/prisma/
└── prisma/
```

## 4) Kiến trúc module

Mỗi module tuân thủ skeleton:
- `services/`: chứa business rules/use cases.
- `repositories/`: chỉ thao tác DB của module đó.
- `contracts/`: interface public cho module khác gọi.
- `types.ts`: domain types của module.
- `index.ts`: export public API.

## 5) Luật phụ thuộc

- `approval` gọi `budgeting` qua service contract.
- `transaction` gọi `approval`, `budgeting`, `cashbook` qua service contract.
- `ledger` chỉ nhận posting events và append immutable entries.
- `report` chỉ đọc read-model (không ghi).
- `ai` chỉ read-only context từ report/ledger views.
- Cấm phụ thuộc vòng tròn (circular dependency).

## 6) Thành phần hạ tầng

- PostgreSQL: lưu dữ liệu nghiệp vụ.
- Prisma: DB schema + migrations + seed.
- OpenAPI: contract API.
- Zod/client generation: đồng bộ input/output typed.
- Nginx: reverse proxy, route toàn bộ request tới web runtime.
- Docker compose: dev/prod orchestration.
- GitHub Actions: typecheck/test/build/security scan.

## 7) Chiến lược migration

Theo incremental:
1. Dựng `src/` scaffold + docs + contracts.
2. Chuyển flow xương sống (budget/approval/ledger) trước.
3. Chuyển module phụ thuộc theo ownership.
4. Cutover traffic sang runtime mới.
5. Gỡ stack legacy sau 1 chu kỳ ổn định.

## 8) Non-functional requirements

- Security: JWT + RBAC + audit log + immutable ledger.
- Reliability: migration an toàn, rollback rõ ràng.
- Observability: structured logs, correlation id.
- Maintainability: module ownership + anti-conflict rules.
