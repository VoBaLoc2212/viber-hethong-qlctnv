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
- Bắt buộc system prompt chứa role hiện tại + policy scope trước khi gọi LLM.
- Routing bắt buộc theo thứ tự: SERVICE -> RAG (docs nội bộ) -> Text2SQL fallback.
- Text2SQL chỉ chạy khi vượt qua guardrails: SELECT-only, allowlist bảng, limit bắt buộc, role-scope.

## 3) Data governance

- Không index dữ liệu nhạy cảm ngoài policy.
- Không log raw nội dung nhạy cảm.
- Bắt buộc masking khi cần.

## 4) Contract cho AI endpoint

### Endpoint hiện tại

- `POST /api/ai`: gửi câu hỏi chatbot.
- `GET /api/ai/sessions`: lấy danh sách session chat theo user.
- `GET /api/ai/sessions/{id}`: lấy lịch sử messages theo session.

### Input/Output

- Input chat tối thiểu: `sessionId?`, `message`, `clientMessageId?`.
- Output chat tối thiểu: `sessionId`, `answer`, `intent`, `routeUsed`, `citations[]`, `suggestedActions[]`.
- Error theo format chuẩn API contract.

### Bộ câu hỏi UAT chuẩn

- Truy vấn dữ liệu:
  - "Chi phí tháng 1 của phòng Marketing?"
  - "5 giao dịch EXPENSE gần nhất của tôi?"
- Phân tích:
  - "So sánh chi phí Q1 vs Q2 theo phòng ban."
  - "Vì sao chi phí tháng này tăng so với tháng trước?"
- Dự báo:
  - "Dựa trên recurring transactions, dự báo chi phí tháng tới theo tuần."
  - "Nếu giữ tốc độ chi hiện tại, khi nào ngân sách IT chạm hard stop?"
- Cảnh báo:
  - "Phòng nào sắp vượt ngân sách?"
  - "Có approval nào bị treo quá 3 ngày không?"
- Hướng dẫn:
  - "Làm sao để tạo yêu cầu chi?"
  - "Khi bật hard stop thì điều gì xảy ra?"

## 5) Dev ownership

- Dev4 phụ trách `src/modules/ai`, `src/app/api/ai`, `src/app/reports`.
- Shared files cần review chéo khi chạm OpenAPI/Prisma.
