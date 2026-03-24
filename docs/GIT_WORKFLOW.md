# GIT_WORKFLOW

## 1) Branch model

- `main`: production-ready.
- `develop` (nếu team dùng): integration branch.
- feature branches theo module owner.

Đề xuất naming:
- `feature/dev1-budgeting-ledger`
- `feature/dev2-transaction-cashbook`
- `feature/dev3-approval-reimbursement`
- `feature/dev4-fx-report-ai`

## 2) PR size policy

- 1 PR = 1 module chính.
- Nếu chạm shared files (`openapi.yaml`, `schema.prisma`), phải ghi rõ impact.
- Tránh PR quá lớn khó review.

## 3) Merge policy

- Không merge khi CI fail.
- Shared contract/schema cần ít nhất 2 reviewer khác module.
- Rebase với branch mới nhất trước khi merge.

## 4) Commit convention

- `feat(module): ...`
- `fix(module): ...`
- `refactor(module): ...`
- `docs(module): ...`
- `test(module): ...`

## 5) Anti-conflict rules

1. Không edit module không thuộc owner nếu chưa sync.
2. Không để 2 feature branches cùng sửa sâu 1 file shared trong cùng sprint.
3. Nếu bắt buộc sửa shared file, tạo PR riêng nhỏ cho contract.
4. Ưu tiên merge PR contract trước PR implementation phụ thuộc.

## 6) Definition of done cho PR

- Contract cập nhật đầy đủ.
- Tests liên quan pass.
- Docs liên quan cập nhật.
- Có note migration/rollback nếu đụng DB.
