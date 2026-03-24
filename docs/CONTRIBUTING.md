# CONTRIBUTING

## 1) Setup nhanh

```bash
npm install
cp .env.example .env
docker-compose up -d
```

Chạy runtime local:
```bash
npm run dev
```

## 2) Quy trình đóng góp

1. Tạo feature branch theo module owner.
2. Update contract trước (nếu có API/DB change).
3. Code + tests.
4. Update docs liên quan.
5. Mở PR theo template.

## 3) Quy tắc bắt buộc

- Không chỉnh DB module khác trực tiếp.
- Không merge nếu CI fail.
- Không merge nếu thiếu docs contract khi có thay đổi API/DB.

## 4) Tài liệu chuẩn

Đọc đầy đủ trong thư mục `docs/`:
- `ARCHITECTURE.md`
- `DOMAIN_DESIGN.md`
- `BUSINESS_FLOW.md`
- `API_CONTRACT.md`
- `SHARED_TYPES.md`
- `ERD_LEDGER.md`
- `GIT_WORKFLOW.md`
- `CODING_STANDARDS.md`
- `SECURITY.md`
- `TESTING.md`
- `AI_RULES.md`
- `AGENTS.md`
