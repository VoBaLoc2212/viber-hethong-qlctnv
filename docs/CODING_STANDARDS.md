# CODING_STANDARDS

## 1) Nguyên tắc chung

- Ưu tiên đơn giản, đúng yêu cầu, không over-engineer.
- Tách module rõ ràng, không gọi vòng tròn.
- Không update DB module khác trực tiếp.

## 2) Quy ước cấu trúc module

Mỗi module gồm:
- `services/`: orchestration + business rules.
- `repositories/`: đọc/ghi DB của chính module.
- `contracts/`: interface public.
- `types.ts`: domain types.
- `index.ts`: export public.

## 3) Naming

- File: `kebab-case.ts`.
- Type/interface: `PascalCase`.
- Function/variable: `camelCase`.
- Enum literal: `UPPER_SNAKE_CASE`.

## 4) Error handling

- Dùng error shape chuẩn (`code`, `message`, `details`, `correlationId`).
- Không nuốt lỗi im lặng.
- Không trả stack trace nội bộ ra public API.

## 5) Validation

- Input API validate bằng Zod generated từ OpenAPI.
- Không duplicate validation trái nhau giữa FE/BE.

## 6) Money và time

- Money: decimal string ở service boundary.
- Time: ISO-8601 UTC.

## 7) Logging

- Structured logs, có context theo request.
- Redact thông tin nhạy cảm (auth token/cookie).

## 8) Testing

- Unit test cho service rules.
- Integration test cho flow qua nhiều module.
- E2E smoke cho flow nghiệp vụ chính.
