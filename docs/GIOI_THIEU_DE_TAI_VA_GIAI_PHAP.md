# Giới thiệu đề tài, vấn đề thực tế và giải pháp của dự án

## 1) Bối cảnh & vấn đề thực tế

Trong nhiều doanh nghiệp, quản lý ngân sách và thu/chi nội bộ đang gặp các vấn đề phổ biến:

- Dữ liệu phân tán (Excel, email, chat, giấy tờ), khó đối soát.
- Quy trình phê duyệt chậm, phụ thuộc thủ công, khó theo dõi trạng thái.
- Thiếu cơ chế chặn vượt ngân sách theo thời gian thực.
- Nhật ký kiểm toán không đầy đủ hoặc dễ bị chỉnh sửa sau khi phát sinh.
- Báo cáo chậm, thiếu góc nhìn tức thời cho quản lý.
- Khó mở rộng khi doanh nghiệp tăng phòng ban, tăng giao dịch, tăng yêu cầu kiểm soát.

### Hệ quả business

- Quyết định tài chính thiếu dữ liệu tức thời.
- Rủi ro thất thoát và sai sót kế toán tăng.
- Thời gian xử lý nghiệp vụ kéo dài (request → duyệt → chi → đối soát).
- Tăng chi phí vận hành do nhập liệu lặp lại và sửa sai thủ công.

---

## 2) Hạn chế của cách làm truyền thống

## 2.1 Quy trình cũ thường gặp

- Lập đề nghị chi trên file/biểu mẫu rời rạc.
- Duyệt qua email/chat, khó truy vết quyết định.
- Kế toán nhập lại dữ liệu sang phần mềm khác.
- Đối soát cuối kỳ mới phát hiện chênh lệch.

## 2.2 Điểm nghẽn

- Không có luồng dữ liệu xuyên suốt **Budget → Approval → Transaction → Ledger**.
- Không có trạng thái `reserved/used/available` nhất quán theo thời gian thực.
- Không có immutable ledger để đảm bảo tính toàn vẹn chứng từ số.
- Báo cáo phụ thuộc tổng hợp thủ công, độ trễ cao.

---

## 3) Giải pháp của project

Dự án xây dựng hệ thống **Quản lý Ngân sách Chi phí & Thu-Chi Nội bộ** theo kiến trúc module hiện đại, chuẩn hóa theo hướng contract-first.

## 3.1 Mục tiêu giải pháp

- Chuẩn hóa nghiệp vụ tài chính nội bộ trên một nền tảng tập trung.
- Tự động hóa luồng phê duyệt và thực thi thu/chi theo vai trò.
- Kiểm soát ngân sách theo ngưỡng cảnh báo và hard-stop.
- Đảm bảo truy vết đầy đủ bằng audit log + immutable ledger.
- Cung cấp dashboard/báo cáo hỗ trợ quyết định nhanh và chính xác.

## 3.2 Các tính năng chính

### A. Nhóm giao dịch tài chính

- Tạo giao dịch thu (**INCOME**) và chi (**EXPENSE**).
- Quản lý danh sách giao dịch với lọc/truy vấn theo trạng thái, loại, thời gian.
- Hỗ trợ giao dịch định kỳ (recurring).
- Quản lý sổ quỹ (cashbook), theo dõi biến động số dư.

### B. Nhóm phê duyệt chi

- Luồng duyệt yêu cầu chi theo vai trò (Manager/Accountant).
- Trạng thái rõ ràng: chờ duyệt, đã duyệt, từ chối.
- Chỉ thực thi chi khi yêu cầu đã qua bước phê duyệt.

### C. Nhóm ngân sách

- Quản lý ngân sách theo phòng ban/cost center.
- Chuyển ngân sách giữa các quỹ (budget transfer).
- Cơ chế:
  - **Soft warning** khi gần chạm ngưỡng.
  - **Hard-stop** khi hết khả dụng để chặn phát sinh chi vượt mức.

### D. Nhóm hoàn ứng

- Quản lý vòng đời tạm ứng → quyết toán.
- Tự động xác định phần chênh lệch cần hoàn/trả thêm.
- Sinh nghiệp vụ bù trừ và ghi nhận sổ cái.

### E. Nhóm báo cáo & phân tích

- Dashboard KPI tài chính tổng quan.
- Biểu đồ cơ cấu chi phí, Budget vs Actual.
- Theo dõi thu/chi theo thời gian và dự báo cashflow.

### F. Nhóm bảo mật, kiểm toán và truy vết

- JWT + RBAC phân quyền theo vai trò.
- Audit logs phục vụ truy vết hành động.
- Ledger bất biến (immutable), điều chỉnh qua reversal thay vì sửa trực tiếp.

### G. Nhóm quản trị hệ thống

- Quản lý người dùng/role.
- Quản lý tỷ giá (tra cứu lịch sử).
- Trợ lý AI hỗ trợ hỏi đáp nghiệp vụ theo ngữ cảnh dữ liệu có quyền.

---

## 4) Giá trị mang lại cho người dùng và doanh nghiệp

## 4.1 Với người dùng vận hành

- Giảm thao tác thủ công, giảm nhập liệu lặp.
- Biết rõ trạng thái hồ sơ/giao dịch theo thời gian thực.
- Rút ngắn thời gian xử lý yêu cầu chi.

## 4.2 Với quản lý tài chính

- Có dữ liệu dashboard để ra quyết định nhanh.
- Kiểm soát vượt ngân sách sớm bằng cảnh báo/chặn cứng.
- Dễ theo dõi hiệu quả chi tiêu từng phòng ban.

## 4.3 Với doanh nghiệp

- Nâng mức minh bạch và tuân thủ kiểm toán nội bộ.
- Giảm sai sót vận hành và rủi ro thất thoát.
- Tạo nền tảng dữ liệu tài chính chuẩn hóa để mở rộng số hóa tiếp theo.

---

## 5) Điểm mạnh nổi bật

- Kiến trúc module rõ ownership, dễ phát triển song song.
- Luồng nghiệp vụ chuẩn tài chính: **Budget → Approval → Transaction → Ledger**.
- Tách write-model và read-model, thuận lợi cho báo cáo/scale.
- Contract-first (OpenAPI + shared types) giảm lệch giữa FE/BE/API.
- Có lộ trình migration incremental, giảm rủi ro khi chuyển đổi hệ thống.

---

## 6) Công nghệ sử dụng trong dự án

- **Frontend/Web runtime:** Next.js App Router.
- **Data layer:** PostgreSQL + Prisma.
- **API contract:** OpenAPI.
- **Typed validation/client:** Zod + generated client.
- **Authentication/Authorization:** JWT + RBAC.
- **Storage:** S3-compatible storage (đính kèm chứng từ).
- **Visualization:** Recharts.
- **Deployment/Infra:** Docker Compose + Nginx.
- **CI/CD quality gate:** typecheck/test/build/security scan.

---

## 7) Kiến trúc dự án (tổng quan)

## 7.1 Cấu trúc chính

- `src/app`: UI + API route handlers.
- `src/modules`: business modules (budgeting, approval, transaction, ledger, cashbook, reimbursement, report, ai...).
- `src/lib/db/prisma`: schema/migration dữ liệu.
- `src/lib/api-spec/openapi.yaml`: hợp đồng API.

## 7.2 Luật phụ thuộc quan trọng

- `approval` gọi `budgeting` qua contract.
- `transaction` gọi `approval`, `budgeting`, `cashbook` qua contract.
- `ledger` chỉ append entries (bất biến).
- `report` chỉ đọc read-model.
- `ai` chỉ đọc ngữ cảnh theo quyền, không can thiệp write-path.

---

## 8) Workflow nghiệp vụ chi tiết theo role

## 8.1 Các vai trò

- **EMPLOYEE:** tạo request/giao dịch theo quyền, nộp chứng từ.
- **MANAGER:** duyệt/từ chối yêu cầu.
- **ACCOUNTANT:** thực thi chi, đối soát, settlement.
- **FINANCE_ADMIN:** quản trị tài chính hệ thống, người dùng, tỷ giá, cấu hình.
- **AUDITOR:** theo dõi báo cáo, audit logs, ledger theo phạm vi cấp quyền.

## 8.2 Luồng chi (expense)

1. Employee tạo yêu cầu chi.
2. Manager duyệt.
3. Budget tăng `reserved`.
4. Accountant thực hiện chi.
5. Budget giảm `reserved`, tăng `used`.
6. Cashbook trừ số dư.
7. Ledger append bút toán bất biến.

## 8.3 Luồng thu (income)

1. Accountant tạo phiếu thu.
2. Cập nhật giao dịch/cashbook.
3. Ledger append entry.

## 8.4 Luồng hoàn ứng

1. Nhân viên xin tạm ứng.
2. Duyệt và chi tạm ứng.
3. Nhân viên nộp quyết toán thực tế.
4. Hệ thống tính chênh lệch, sinh bù trừ.
5. Ledger append.

---

## 9) So sánh với mô hình truyền thống

| Tiêu chí | Truyền thống (Excel + email + nhập tay) | Giải pháp dự án |
|---|---|---|
| Theo dõi trạng thái | Rời rạc, khó đồng bộ | Xuyên suốt theo workflow |
| Kiểm soát ngân sách | Cuối kỳ mới phát hiện | Realtime + soft warning + hard-stop |
| Truy vết kiểm toán | Thiếu nhất quán | Audit log + immutable ledger |
| Tốc độ xử lý | Phụ thuộc thủ công | Tự động hóa theo role |
| Báo cáo quản trị | Chậm, tổng hợp tay | Dashboard/report gần realtime |
| Khả năng mở rộng | Khó scale | Module-based, contract-first |

---

## 10) Nghiệp vụ business được giải quyết

- Quản trị vòng đời ngân sách từ cấp phát → sử dụng → điều phối.
- Chuẩn hóa quy trình duyệt chi đa vai trò.
- Kiểm soát thực thi thu/chi gắn với chứng từ và phân quyền.
- Đảm bảo tính toàn vẹn sổ cái phục vụ kiểm toán.
- Tạo lớp dữ liệu báo cáo cho quản lý chiến lược.

---

## 11) Sản phẩm tương tự trên thị trường & hướng học hỏi

## 11.1 Nhóm sản phẩm tham chiếu chức năng

- SAP Concur (expense management).
- Oracle NetSuite (financial operations).
- Odoo Accounting/Expenses.
- Zoho Expense.

## 11.2 Hướng cải tiến có thể học hỏi

- OCR tự động trích xuất hóa đơn/chứng từ.
- Rule engine phê duyệt linh hoạt theo ngưỡng, phòng ban, loại chi.
- Cảnh báo bất thường chi tiêu bằng mô hình ML.
- Mở rộng tích hợp ERP/HRM/Banking API.
- Mobile-first workflow cho tác vụ phê duyệt nhanh.

---

## 12) Roadmap scale, migrate, nâng cấp tương lai

## 12.1 Scale kỹ thuật

- Tách read-model chuyên biệt cho analytics/reporting.
- Thêm queue + idempotency cho các bước posting/ledger.
- Tối ưu chỉ mục DB theo truy vấn báo cáo lớn.
- Mở rộng cache chiến lược cho dashboard.

## 12.2 Nâng cấp nghiệp vụ

- Multi-entity/multi-company.
- Multi-currency sâu hơn (revaluation, FX gain/loss).
- Chính sách ngân sách theo kịch bản và forecast nâng cao.
- Workflow phê duyệt đa cấp động.

## 12.3 Migration/cutover

- Chuyển dần từng module nghiệp vụ trọng yếu.
- Chạy song song (parallel run) để đối soát số liệu trước cutover.
- Xác nhận ổn định theo chu kỳ rồi tháo bỏ legacy.

---

## 13) Kết luận

Giải pháp của dự án không chỉ số hóa thao tác thu/chi, mà còn chuẩn hóa toàn bộ chuỗi nghiệp vụ tài chính nội bộ với tính kiểm soát, minh bạch và khả năng mở rộng. Đây là nền tảng phù hợp để doanh nghiệp chuyển từ vận hành thủ công sang quản trị tài chính dữ liệu hóa, sẵn sàng cho các bước tự động hóa và phân tích nâng cao trong tương lai.
