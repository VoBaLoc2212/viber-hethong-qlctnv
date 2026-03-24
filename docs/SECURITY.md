# SECURITY

## 1) Security baseline

- Bắt buộc đăng nhập để truy cập dữ liệu tài chính.
- JWT dùng secret mạnh, rotate theo policy.
- RBAC theo role nghiệp vụ.

## 2) RBAC tối thiểu

- Employee: tạo request/đề nghị hoàn ứng.
- Manager: duyệt hoặc từ chối.
- Accountant: execute giao dịch, cashbook, reconcile.
- Finance Admin: setup/chuyển ngân sách, policy.
- Auditor: read-only audit + ledger + report.

## 3) Input/output security

- Validate mọi input ở boundary API.
- Sanitize attachment metadata.
- Không expose secret trong logs/response.

## 4) Ledger security

- Ledger immutable: cấm sửa/xóa entry.
- Sai số liệu xử lý bằng reversal entries.
- Ghi audit log cho mọi thao tác sensitive.

## 5) Secret management

- Không commit `.env` thật.
- Dùng `.env.example` làm template.
- Production secrets lấy từ secret store/CI.

## 6) Transport

- Bật HTTPS qua Nginx ở production.
- Forward headers chuẩn (`X-Forwarded-*`).

## 7) AI/RAG security (scope scaffold)

- Chỉ read-only dữ liệu được cấp quyền.
- Chặn prompt injection ở mức policy và context filtering.
- Không cho AI tự ý thực hiện write operations.
