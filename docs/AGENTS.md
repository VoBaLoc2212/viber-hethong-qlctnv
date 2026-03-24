# AGENTS

## 1) Mục tiêu

Định nghĩa cách phối hợp giữa dev và AI coding agents để giảm conflict và giữ đúng context nghiệp vụ tài chính.

## 2) Quy tắc giao việc

- Mỗi agent chỉ xử lý 1 module chính trong 1 phiên.
- Không để 2 agent sửa cùng file shared cùng lúc.
- Nếu cần sửa shared contract/schema, tạo task riêng có reviewer chỉ định.

## 3) Context bắt buộc khi giao task cho agent

- Module owner (Dev1..Dev4).
- Business flow liên quan.
- Contract files bị ảnh hưởng (`openapi.yaml`, `schema.prisma`, shared types).
- Invariants cần giữ.

## 4) Guardrails

- Không tự ý đổi business rule tài chính.
- Không thêm fallback phá invariant.
- Không bỏ qua bước update docs contract.

## 5) Review checklist cho output của agent

- Có vi phạm module boundary không?
- Có nguy cơ circular dependency không?
- Có đụng ledger immutable không?
- Có cập nhật tests/docs tương ứng không?
