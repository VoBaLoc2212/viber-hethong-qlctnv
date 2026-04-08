# Hệ thống Quản lý Ngân sách & Thu/Chi Nội bộ

## 1) Dự án giải quyết bài toán gì?

Hệ thống hỗ trợ doanh nghiệp quản trị tài chính nội bộ theo chu trình khép kín:

- Lập ngân sách theo phòng ban.
- Ghi nhận thu/chi.
- Duyệt chi đa vai trò (Manager/Accountant).
- Kiểm soát hard-stop khi vượt ngân sách.
- Quản lý hoàn ứng từ đề nghị tạm ứng đến quyết toán.
- Sinh báo cáo tổng hợp và lưu vết audit/ledger.

### Nhu cầu thực tế được giải quyết

- Giảm duyệt chi thủ công qua chat/email rời rạc.
- Tránh chi vượt ngân sách (budget control + hard-stop).
- Chuẩn hóa chứng từ và luồng trách nhiệm theo role.
- Minh bạch số liệu cho kế toán/kiểm toán (ledger, log immutable).
- Tạo nền tảng mở rộng AI Assistant cho truy vấn nghiệp vụ.

---

## 2) Kiến trúc & phạm vi

- Runtime: Next.js App Router (thư mục `src/`)
- Database: PostgreSQL + Prisma
- API contract: `src/lib/api-spec/openapi.yaml`
- RBAC/route-api policy: `src/lib/auth/rbac.ts`

### Các màn hình chính

- `/dashboard`
- `/transactions`
- `/approvals`
- `/reimbursement`
- `/budgeting`
- `/budgets`
- `/reports`
- `/security`
- `/users`
- `/fx-rates`
- `/ai-assistant`

---

## 3) RBAC (role-based access)

Nguồn quyền route/API: `src/lib/auth/rbac.ts`.

### 3.1 Role trong hệ thống

- `EMPLOYEE`
- `MANAGER`
- `ACCOUNTANT`
- `FINANCE_ADMIN`
- `AUDITOR`

### 3.2 Landing page theo role

- EMPLOYEE → `/transactions`
- MANAGER → `/budgeting`
- ACCOUNTANT → `/budgeting`
- FINANCE_ADMIN → `/security`
- AUDITOR → `/security`

### 3.3 Tóm tắt quyền theo module

| Module | Vai trò chính |
|---|---|
| Dashboard, Transactions, Reimbursement, AI Assistant | Tất cả role |
| Budgeting, Budgets, Approvals, Reports | MANAGER, ACCOUNTANT, FINANCE_ADMIN, AUDITOR |
| Security | ACCOUNTANT, FINANCE_ADMIN, AUDITOR |
| Users, FX Rates, Hard-stop controls | FINANCE_ADMIN |
| Ledger reversal | FINANCE_ADMIN, ACCOUNTANT |

---

## 4) Feature matrix (Web + API)

| Nhóm chức năng | Web route | API chính | Kết quả đầu ra chính |
|---|---|---|---|
| Dashboard KPI | `/dashboard` | `/api/dashboard/kpis`, `/api/dashboard/expenses-by-month` | KPI tổng quan + chart chi tiêu |
| Transactions | `/transactions` | `/api/transactions`, `/api/transactions/[id]` | Tạo/cập nhật giao dịch thu-chi, theo trạng thái |
| Attachments/Recurring/Reference data | `/transactions` (tab/chức năng phụ) | `/api/transactions/attachments`, `/api/transactions/recurring`, `/api/transactions/recurring/run`, `/api/transactions/reference-data` | Upload chứng từ, lập lịch định kỳ |
| Approvals | `/approvals` | `/api/approvals`, `/api/approvals/[id]`, `/api/approvals/[id]/action` | Duyệt/Từ chối/Execute theo vai trò |
| Reimbursement | `/reimbursement` | `/api/reimbursements/*` | Full lifecycle hoàn ứng và quyết toán |
| Budgeting/Budgets | `/budgeting`, `/budgets` | `/api/budgets/*`, `/api/controls/hard-stop` | Điều phối ngân sách, chuyển ngân sách, chặn vượt hạn mức |
| Reports | `/reports` | `/api/reports` | Budget vs actual, composition, forecast |
| Security/Users | `/security`, `/users` | `/api/logs`, `/api/logs/immutable`, `/api/users/*` | Audit/log và quản trị user |
| Ledger/Cashbook | (qua flow nghiệp vụ + API) | `/api/ledger`, `/api/ledger/[id]/reversal`, `/api/cashbook`, `/api/cashbook/reconcile` | Hạch toán, đối soát, đảo bút toán |
| FX Rates | `/fx-rates` | `/api/fx-rates/*` | Quản lý tỷ giá |
| AI Assistant | `/ai-assistant` | `/api/ai/*`, `/api/ai/knowledge/*` | Chat định tuyến nghiệp vụ + knowledge documents |

---

## 5) Hướng dẫn chạy project (đầy đủ lệnh)

## 5.1 Chuẩn bị môi trường

- Node.js 20+
- Docker + Docker Compose
- NPM

## 5.2 Chạy local (khuyến nghị cho dev)

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run dev
```

- App: `http://localhost:3001`

## 5.3 Chạy full Docker dev (web + postgres + pgAdmin)

```bash
docker compose up -d
```

- Web: `http://localhost:3001`
- pgAdmin: `http://localhost:5050`

## 5.4 Chạy production-like bằng compose file riêng

`docker-compose.prod.yml` dùng biến môi trường, tối thiểu cần cấu hình:

- `DB_PASSWORD`
- `DOMAIN`
- `WEB_IMAGE`
- `DATABASE_URL`
- SMTP/JWT biến liên quan

Chạy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

Stop:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

## 5.5 Prisma lifecycle commands

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run prisma:seed
```

## 5.6 Quality gates local

```bash
npm run typecheck
npm run test
npm run build
```

## 5.7 Health check

```bash
# cần session hợp lệ nếu middleware auth đang bật cho health endpoints
curl -i http://localhost:3001/api/health
curl -i http://localhost:3001/api/healthz
```

---

## 6) Workflow pipeline nghiệp vụ chuẩn

## 6.1 Expense flow (request -> approve -> execute)

1. Employee tạo giao dịch `EXPENSE` (status ban đầu PENDING).
2. Manager duyệt (`approve`) hoặc từ chối (`reject`).
3. Nếu approved: Accountant thực hiện chi (`execute`) hoặc không chi (`not-execute`).
4. Hệ thống cập nhật transaction status + side effects tài chính liên quan.

Trạng thái/logic chính nằm trong:
- `src/modules/approval/services/approval-service.ts`

## 6.2 Reimbursement flow (advance -> settlement -> complete)

1. Employee tạo đề nghị tạm ứng (`PENDING_APPROVAL`).
2. Manager duyệt (`ADVANCE_APPROVED`).
3. Accountant chi tạm ứng (`ADVANCE_PAID`) — yêu cầu `idempotency-key`.
4. Employee nộp quyết toán (`SETTLEMENT_SUBMITTED`).
5. Accountant review (`SETTLEMENT_REVIEWED`).
6. Accountant complete (`COMPLETED`) — yêu cầu `idempotency-key`.

Trạng thái/logic chính nằm trong:
- `src/modules/reimbursement/services/reimbursement-service.ts`

## 6.3 Budget control flow

1. Thiết lập ngân sách theo phòng ban.
2. Bật/tắt hard-stop policy.
3. Khi available <= 0, chặn tạo chi mới.
4. Budget transfer hỗ trợ idempotency để tránh ghi nhận trùng.

---

## 7) End-to-end use cases theo role (step-by-step)

> Các kịch bản dưới đây bám theo `docs/validation/finance-e2e-test-plan.md` và execution report ngày `2026-03-30`.

## 7.1 Use case A — Employee tạo đề nghị chi

**Input**
- Role: EMPLOYEE
- API: `POST /api/transactions`
- Payload tối thiểu: `type=EXPENSE`, `amount`, `departmentId`, `description`, `budgetId`

**Steps**
1. Đăng nhập EMPLOYEE.
2. Vào `/transactions`.
3. Tạo giao dịch EXPENSE với budget hợp lệ.

**Expected output**
- API trả giao dịch mới (thường `PENDING`).
- Bản ghi hiển thị trong danh sách giao dịch chờ duyệt.
- Dữ liệu ngân sách phản ánh phần reserved theo flow.

## 7.2 Use case B — Manager duyệt/từ chối đề nghị chi

**Input**
- Role: MANAGER
- API: `PATCH /api/approvals/[id]` hoặc `POST /api/approvals/[id]/action`
- Action: `approve`/`reject`

**Steps**
1. Đăng nhập MANAGER.
2. Vào `/approvals`.
3. Chọn phiếu `PENDING`, thực hiện `approve` hoặc `reject`.

**Expected output**
- Approval status cập nhật đúng.
- Transaction status đồng bộ tương ứng.

## 7.3 Use case C — Accountant execute chi

**Input**
- Role: ACCOUNTANT
- API: `PATCH /api/approvals/[id]` hoặc `POST /api/approvals/[id]/action`
- Action: `execute` (hoặc `not-execute`)

**Steps**
1. Đăng nhập ACCOUNTANT.
2. Mở phiếu ở trạng thái `APPROVED`.
3. Execute chi.

**Expected output**
- Transaction về `EXECUTED`.
- Ledger/cashbook/budget side-effects phát sinh đúng flow.
- Replay với cùng idempotency-key không tạo duplicate side-effects (đã được runtime validation xác nhận).

## 7.4 Use case D — Full reimbursement lifecycle

**Input**
- Employee tạo request: `POST /api/reimbursements`
- Manager duyệt: `POST /api/reimbursements/[id]/approve`
- Accountant trả tạm ứng: `POST /api/reimbursements/[id]/pay-advance` (header `idempotency-key`)
- Employee quyết toán: `POST /api/reimbursements/[id]/submit-settlement`
- Accountant review: `POST /api/reimbursements/[id]/review-settlement`
- Accountant complete: `POST /api/reimbursements/[id]/complete` (header `idempotency-key`)

**Steps**
1. Employee tạo đề nghị tạm ứng.
2. Manager duyệt.
3. Accountant chi tạm ứng.
4. Employee nộp actual amount + chứng từ.
5. Accountant review và complete.

**Expected output**
- Trạng thái chạy đúng chuỗi lifecycle.
- Net settlement và direction tính đúng (`RETURN_TO_COMPANY`/`PAY_TO_EMPLOYEE`/`NO_CHANGE`).
- Có financial postings tương ứng theo từng bước tài chính.

## 7.5 Use case E — Budget hard-stop + transfer idempotency

**Input**
- FINANCE_ADMIN/ANALYST roles
- APIs: `/api/controls/hard-stop`, `/api/budgets/[id]/transfer`

**Steps**
1. Bật hard-stop policy.
2. Tạo tình huống available budget <= 0.
3. Thử tạo EXPENSE mới.
4. Thực hiện transfer cùng idempotency-key 2 lần.

**Expected output**
- Bước 3 bị chặn (422/UNPROCESSABLE theo flow).
- Transfer không bị ghi nhận trùng hiệu ứng tài chính.

---

## 8) Input/Output mẫu cho kiểm thử nhanh

## 8.1 Expense create (sample)

```json
{
  "type": "EXPENSE",
  "amount": "200000.00",
  "currency": "VND",
  "departmentId": "<department-id>",
  "budgetId": "<budget-id>",
  "description": "Chi mua vật tư"
}
```

**Output mong đợi**
- Transaction được tạo.
- Trạng thái ban đầu phù hợp policy/workflow.

## 8.2 Approval action (sample)

```json
{
  "action": "approve",
  "note": "Duyệt chi theo đề xuất"
}
```

hoặc

```json
{
  "action": "execute",
  "note": "Đã thực chi"
}
```

**Output mong đợi**
- Approval + Transaction đồng bộ trạng thái.
- Side-effects tài chính đúng và không duplicate khi replay idempotent flow.

## 8.3 Reimbursement settlement submit (sample)

```json
{
  "actualAmount": "150000.00",
  "settlementNote": "Quyết toán công tác phí",
  "attachments": [
    {
      "fileName": "receipt.pdf",
      "fileUrl": "https://example.local/receipt.pdf"
    }
  ]
}
```

**Output mong đợi**
- Reimbursement chuyển sang `SETTLEMENT_SUBMITTED`.
- Tính `netAmount` + `settlementDirection` chính xác.

---

## 9) Test strategy và kịch bản kiểm thử

## 9.1 Lệnh test

```bash
npm run test
npm run test:unit
npm run test:watch
npm run typecheck
npm run build
```

## 9.2 Kịch bản test bắt buộc (theo tài liệu)

- Expense core flow (request -> approve -> execute -> ledger)
- Budget hard-stop
- Budget transfer idempotency
- Income + cashbook increment
- Reimbursement netting
- Reports aggregate consistency
- RBAC boundaries
- Ledger reversal

Xem chi tiết:
- `docs/TESTING.md`
- `docs/validation/finance-e2e-test-plan.md`

## 9.3 Trạng thái thực thi gần nhất

Theo `docs/validation/finance-e2e-execution-report.md` (execution date `2026-03-30`):

- Typecheck/Test/Build: PASS
- Runtime matrix major flows: PASS
- FX: PARTIAL 

---

## 10) CI/CD workflow pipeline

## 10.1 CI (`.github/workflows/ci.yml`)

- Trigger: push/PR vào `main`, `develop`
- Jobs chính:
  - `lint-and-test`
  - `build` (Docker image to GHCR)
  - `security-scan` (Trivy + SARIF upload)

## 10.2 Deploy (`.github/workflows/deploy.yml`)

- Trigger: `workflow_run` khi `CI/CD Pipeline` thành công trên `main`
- Deploy qua SSH tới server:
  - `docker login ghcr.io`
  - `docker pull <image>:latest`
  - `docker compose -f docker-compose.yml up -d web`

---

## 11) Kịch bản quay video demo chi tiết (chuẩn pipeline)

Mục tiêu video: chứng minh end-to-end toàn bộ luồng chính theo role, có đầu vào/đầu ra rõ ràng.

## 11.1 Chuẩn bị trước khi quay

1. Chạy local theo mục **5.2**.
2. Seed dữ liệu mẫu (`npm run prisma:seed`).
3. Chuẩn bị sẵn tài khoản cho 5 role (theo dữ liệu seed hoặc DB của bạn).
4. Mở sẵn Postman/Insomnia hoặc browser devtools để show API response.

## 11.2 Timeline quay đề xuất

### Phase A — Setup & health (1 màn hình)
1. Quay terminal: chạy lệnh start + health check.
2. Quay browser: vào app thành công.

### Phase B — Expense pipeline theo role
1. EMPLOYEE tạo expense.
2. MANAGER approve.
3. ACCOUNTANT execute.
4. Show kết quả: status transaction + dữ liệu dashboard/report thay đổi.

### Phase C — Reimbursement pipeline
1. EMPLOYEE tạo reimbursement request.
2. MANAGER approve advance.
3. ACCOUNTANT pay advance (show idempotency-key).
4. EMPLOYEE submit settlement.
5. ACCOUNTANT review + complete.
6. Show output: final status + net amount + settlement direction.

### Phase D — Budget control + security
1. Bật hard-stop.
2. Tạo tình huống vượt budget, submit expense bị chặn.
3. Thử action trái quyền với role không phù hợp để chứng minh RBAC (403).

### Phase E — Report/Audit wrap-up
1. Mở `/reports` chứng minh số liệu tổng hợp.
2. Mở khu vực security/log/ledger (role phù hợp) để chứng minh traceability.

## 11.3 Checklist pass/fail cho video

- [ ] Chạy được app và health endpoint.
- [ ] Expense flow đi hết request -> approve -> execute.
- [ ] Reimbursement flow đi đủ lifecycle.
- [ ] Hard-stop hoạt động.
- [ ] RBAC boundary có bằng chứng 403 khi sai role.
- [ ] Có màn hình reports/audit/ledger để kết luận nghiệp vụ.

---

## 12) Quick Demo 10 phút (script rút gọn)

Mục tiêu: demo nhanh luồng giá trị cốt lõi end-to-end theo pipeline, đủ để thuyết trình với stakeholder.

## 12.1 Chuẩn bị (1 phút)

1. Chạy nhanh môi trường:

```bash
docker compose up -d postgres
npm run prisma:migrate:deploy
npm run prisma:seed
npm run dev
```

2. Mở sẵn:
- App: `http://localhost:3001`
- 3 tài khoản: EMPLOYEE, MANAGER, ACCOUNTANT

## 12.2 Kịch bản quay 10 phút

### Phút 0-1: Mở đầu
- Giới thiệu bài toán: quản lý ngân sách + kiểm soát thu/chi + duyệt chi theo vai trò.
- Show dashboard nhanh (`/dashboard`).

### Phút 1-4: Expense pipeline (EMPLOYEE -> MANAGER -> ACCOUNTANT)
1. EMPLOYEE vào `/transactions`, tạo 1 giao dịch EXPENSE.
2. MANAGER vào `/approvals`, `approve` phiếu vừa tạo.
3. ACCOUNTANT vào `/approvals`, `execute` phiếu đã duyệt.

**Điểm cần nói khi quay**
- Pipeline chuẩn: request -> approve -> execute.
- Trạng thái giao dịch thay đổi đúng theo role.

### Phút 4-7: Reimbursement pipeline
1. EMPLOYEE vào `/reimbursement`, tạo đề nghị tạm ứng.
2. MANAGER duyệt tạm ứng.
3. ACCOUNTANT pay advance (nhấn mạnh idempotency-key ở API flow).
4. EMPLOYEE submit settlement.
5. ACCOUNTANT review + complete.

**Điểm cần nói khi quay**
- Luồng hoàn ứng đầy đủ từ đề nghị đến quyết toán hoàn tất.
- Kết quả có net amount + settlement direction.

### Phút 7-8.5: Budget control + RBAC
1. Bật hard-stop policy (role phù hợp).
2. Tạo tình huống vượt budget -> submit expense bị chặn.
3. Gọi 1 action sai quyền để show 403.

### Phút 8.5-10: Kết luận giá trị
1. Mở `/reports` để show tổng hợp budget vs actual.
2. Mở `/security` hoặc log/ledger tương ứng role để chứng minh traceability.
3. Chốt: hệ thống đảm bảo kiểm soát ngân sách, phân quyền rõ, luồng tài chính xuyên suốt.

## 12.3 Checklist pass nhanh khi demo

- [ ] Tạo và duyệt/execute được 1 expense.
- [ ] Hoàn tất được 1 reimbursement lifecycle.
- [ ] Có bằng chứng hard-stop chặn vượt ngân sách.
- [ ] Có bằng chứng RBAC (403 khi sai quyền).
- [ ] Có màn hình báo cáo/audit để kết luận.

---

## 13) Tài liệu tham chiếu

- [docs/README.md](docs/README.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/validation/finance-e2e-test-plan.md](docs/validation/finance-e2e-test-plan.md)
- [docs/validation/finance-e2e-execution-report.md](docs/validation/finance-e2e-execution-report.md)
- [src/lib/auth/rbac.ts](src/lib/auth/rbac.ts)
- [src/modules/approval/services/approval-service.ts](src/modules/approval/services/approval-service.ts)
- [src/modules/reimbursement/services/reimbursement-service.ts](src/modules/reimbursement/services/reimbursement-service.ts)