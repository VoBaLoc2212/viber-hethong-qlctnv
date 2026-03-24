# HỆ THỐNG QUẢN LÝ NGÂN SÁCH & THU CHI NỘI BỘ

## Tổng quan

Dự án chạy theo kiến trúc module/feature chuẩn `src/`.

- Runtime: Next.js App Router trong `src/`
- Database: PostgreSQL
- Contract: `src/lib/api-spec/openapi.yaml`
- DB schema: `src/lib/db/prisma/schema.prisma`

## Khởi chạy nhanh

```bash
npm install
cp .env.example .env
docker-compose up -d
```

### Chạy ứng dụng local

```bash
npm run dev
```

## Cấu trúc quan trọng

- `src/`: runtime + modules + contracts
- `docs/`: toàn bộ tài liệu chuẩn cho team
- `docker-compose.yml`, `docker-compose.prod.yml`: môi trường dev/prod
- `nginx.conf`: reverse proxy cấu hình production

## Tài liệu chuẩn

Xem [docs/README.md](docs/README.md) để vào đầy đủ:
- Architecture
- Domain Design
- Business Flow
- API Contract
- Shared Types
- Security / Testing / Coding Standards
- Git workflow / Contributing
- AI rules / Agent collaboration

## Team ownership

- Dev1: Budgeting + Budget Control + Security/Ledger
- Dev2: Transactions + Cashbook
- Dev3: Approvals + Reimbursement
- Dev4: Multi-currency + Reports + AI RAG (scaffold)
