# AI_RULES

## 1) Scope hiện tại

AI module ở pha này chỉ là **scaffold**:
- Có module boundary.
- Có endpoint scaffold.
- Có shared types cho request/response.

Chưa triển khai full ingest/vector production.

## 2) Nguyên tắc an toàn

- AI chỉ read-only dữ liệu đã được cấp quyền.
- Không gọi write API tài chính từ AI.
- Trả lời phải có citation nguồn nội bộ khi có.
- Chặn prompt injection qua input filtering + system policy.

## 3) Data governance

- Không index dữ liệu nhạy cảm ngoài policy.
- Không log raw nội dung nhạy cảm.
- Bắt buộc masking khi cần.

## 4) Contract cho AI endpoint

- Input tối thiểu: `conversationId`, `question`.
- Output tối thiểu: `answer`, `citations[]`.
- Error theo format chuẩn API contract.

## 5) Dev ownership

- Dev4 phụ trách `src/modules/ai`, `src/app/api/ai`, `src/app/reports`.
- Shared files cần review chéo khi chạm OpenAPI/Prisma.
