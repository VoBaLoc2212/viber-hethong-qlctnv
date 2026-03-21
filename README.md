# HỆ THỐNG QUẢN LÝ NGÂN SÁCH & THU CHI NỘI BỘ

## Thông tin đề tài
- **Tên đề tài:** Hệ thống Quản lý Ngân sách Chi phí & Thu - Chi Nội bộ
- **Mã đề tài:** 9

## Thành viên thực hiện
1. Hoàng Minh Tuấn Anh
2. Võ Bá Lộc
3. Phạm Thế An
4. Đinh Như Khải

## Mô tả ngắn
Hệ thống hỗ trợ doanh nghiệp theo dõi ngân sách, quản lý thu/chi nội bộ, kiểm soát hạn mức và lập báo cáo tài chính minh bạch theo từng phòng ban hoặc dự án.

## Danh mục chức năng

| STT | Hạng mục (Module) | Yêu cầu Cơ bản | Gợi ý Mở rộng & Nâng cao |
|---|---|---|---|
| 1 | Thiết lập Ngân sách (Budgeting) | - Tạo ngân sách cho Phòng ban/Dự án (ví dụ: Marketing Q1 = 100 triệu).<br>- Theo dõi số dư hiện tại. | - Điều chuyển ngân sách: cắt 10 triệu từ quỹ "Liên hoan" bù sang quỹ "Mua máy tính" (Audit log ghi lại việc chuyển).<br>- Cảnh báo: tự động gửi email khi phòng ban đã tiêu hết 80% ngân sách. |
| 2 | Ghi nhận Thu/Chi (Transaction) | - Tạo phiếu Thu (tiền về) / Phiếu Chi (tiền đi).<br>- Phân loại hạng mục (Tiền điện, Lương, VPP...).<br>- Đính kèm ảnh hóa đơn. | - Thu/Chi định kỳ (Recurring): tự động sinh phiếu chi "Tiền thuê văn phòng" vào ngày 1 hằng tháng.<br>- Chia tách (Split Transaction): hóa đơn siêu thị 5 triệu có thể tách 3 triệu vào "VPP", 2 triệu vào "Tiếp khách". |
| 3 | Quy trình Duyệt chi (Approval) | - Nhân viên tạo yêu cầu chi -> Sếp duyệt -> Kế toán chi tiền. | - Logic "Giữ chỗ" (Encumbrance): khi Sếp duyệt nhưng Kế toán chưa chi, số tiền phải được trừ tạm (Reserved) khỏi ngân sách khả dụng để tránh chi vượt. |
| 4 | Kiểm soát Hạn mức (Budget Control) | - Cho phép chi, nhưng báo đỏ nếu vượt ngân sách. | - Chặn đứng (Hard Stop): nếu ngân sách còn 0 đồng, hệ thống khóa nút "Gửi yêu cầu", không cho tạo phiếu chi mới (trừ khi xin cấp thêm).<br>- Ngân sách con: ví dụ Phòng Marketing 100 triệu, chia Team Content 30 triệu, Team Ads 70 triệu. |
| 5 | Quản lý Quỹ tiền mặt (Cashbook) | - Xem tồn quỹ hiện tại.<br>- Sổ chi tiết các giao dịch. | - Đối soát (Reconcile): so khớp số dư phần mềm với số dư thực tế trong két/ngân hàng; nếu lệch thì tạo phiếu "Điều chỉnh" (Adjustment). |
| 6 | Hoàn ứng (Reimbursement) | - Không yêu cầu. | - Quy trình tạm ứng: nhân viên xin tạm ứng 5 triệu đi công tác -> về nộp hóa đơn 4 triệu -> trả lại công ty 1 triệu (hoặc nhận thêm 1 triệu nếu tiêu lố). Hệ thống tự tính bù trừ. |
| 7 | Đa tiền tệ (Multi-currency) | - Chỉ dùng VND. | - Tỷ giá: nhập chi phí bằng USD, hệ thống tự quy đổi ra VND theo tỷ giá ngày giao dịch để trừ ngân sách. |
| 8 | Báo cáo Tài chính | - Báo cáo tổng thu.<br>- Tổng chi.<br>- Biểu đồ tròn cơ cấu chi phí. | - Báo cáo so sánh (Budget vs. Actual): biểu đồ cột ghép "Kế hoạch" và "Thực tế".<br>- Dự báo dòng tiền: dựa trên các khoản chi định kỳ sắp tới để ước tính nhu cầu tiền tháng sau. |
| 9 | Bảo mật & Nhật ký | - Đăng nhập mới được xem. | - Sổ cái bất biến (Immutable Ledger): không cho sửa/xóa phiếu chi đã chốt; nếu sai phải tạo bút toán đảo chiều (Reversal Entry). |

## Cách chạy dự án (chỉ dùng npm)

### 1) Cài dependencies

```bash
npm install
```

### 2) Chạy Frontend

```bash
npm run dev:frontend
```

Mặc định Vite chạy ở `http://localhost:5173`.

### 3) Chạy Backend

Backend cần biến môi trường `DATABASE_URL` để kết nối PostgreSQL.

Ví dụ (Linux/macOS):

```bash
export DATABASE_URL="postgres://user:pass@localhost:5432/dbname"
npm run dev:backend
```

### 4) Chạy cả Frontend + Backend cùng lúc

```bash
npm run dev
```

### 5) Typecheck

```bash
npm run typecheck
```
