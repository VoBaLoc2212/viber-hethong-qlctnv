# ĐẶC TẢ KIỂM THỬ UI TOÀN DIỆN (FEATURE + WORKFLOW + ROLE)

> Mục tiêu: tập trung 100% vào kiểm thử trên giao diện để xác nhận hệ thống đã **đúng chức năng**, **đúng luồng nghiệp vụ**, **đúng phân quyền role**, và **đủ chi tiết để QA chạy ngay**.

---

## 1) Phạm vi kiểm thử UI

Kiểm thử tất cả màn hình/chức năng chính:

1. Dashboard
2. Budgets / Budgeting Workspace
3. Transactions
4. Approvals
5. Reimbursement
6. Reports
7. Security (User management / role access)
8. Các thành phần dùng chung (navigation, auth session, thông báo lỗi/thành công)

Kiểm thử theo 3 trục bắt buộc:
- **Feature correctness**: thao tác nào thì ra đúng kết quả đó.
- **Workflow correctness**: luồng end-to-end chạy đúng thứ tự nghiệp vụ.
- **Role correctness (RBAC)**: mỗi role chỉ thấy và chỉ làm đúng quyền.

---

## 2) Ma trận role kiểm thử UI

Role cần test đầy đủ:
- EMPLOYEE
- MANAGER
- ACCOUNTANT
- FINANCE_ADMIN
- AUDITOR

### 2.1 Kỳ vọng tổng quan theo role trên UI

- **EMPLOYEE**
  - Được tạo đề nghị chi, tạo reimbursement, theo dõi trạng thái hồ sơ của mình.
  - Không thấy/không bấm được action duyệt, execute, cấu hình budget.

- **MANAGER**
  - Thấy danh sách cần duyệt, thực hiện approve/reject đúng điều kiện.
  - Không được execute giao dịch như accountant.

- **ACCOUNTANT**
  - Được execute giao dịch đã đủ điều kiện.
  - Được thao tác cashbook/reconcile theo quyền.
  - Không được cấu hình policy budget nếu không có quyền admin.

- **FINANCE_ADMIN**
  - Quản trị budget, transfer, hard-stop/policy.
  - Quản lý user/security theo phạm vi cho phép.

- **AUDITOR**
  - Chỉ đọc dữ liệu báo cáo/log/ledger (read-only).
  - Không được tạo/sửa/xóa hay trigger action ghi tài chính.

---

## 3) Bộ test smoke UI bắt buộc (chạy đầu tiên)

### SMK-UI-01 Đăng nhập và điều hướng
- Mỗi role đăng nhập thành công.
- Menu hiển thị đúng theo role.
- Landing page đúng role.

### SMK-UI-02 Guard route
- Truy cập trực tiếp URL không có quyền -> bị chặn (403/redirect hợp lệ).

### SMK-UI-03 Thông báo trạng thái
- Action thành công hiển thị thông báo thành công rõ ràng.
- Action fail hiển thị thông báo lỗi rõ ràng, không crash UI.

### SMK-UI-04 Reload/persist cơ bản
- Reload trang vẫn giữ trạng thái hợp lệ (session/filter cơ bản).

---

## 4) Test chi tiết theo feature UI

## 4.1 Dashboard

### UI-DASH-01 Hiển thị KPI
- Kỳ vọng các card KPI hiển thị đủ số liệu.
- Không lỗi format tiền/tỷ lệ.

### UI-DASH-02 Điều kiện role
- Role không có quyền vẫn chỉ thấy phần được phép (không lộ action ghi dữ liệu).

### UI-DASH-03 Empty/loading/error state
- Loading skeleton/placeholder hoạt động đúng.
- API lỗi: hiển thị error state, không vỡ layout.

---

## 4.2 Budgets / Budgeting Workspace

### UI-BUD-01 Tạo budget
- FINANCE_ADMIN mở form tạo budget, nhập hợp lệ, submit thành công.
- Dòng budget mới xuất hiện đúng danh sách.

### UI-BUD-02 Validation form tạo budget
- Bỏ trống field bắt buộc, số âm, format sai -> hiển thị lỗi đúng field.

### UI-BUD-03 Transfer budget
- Chọn source/target hợp lệ, nhập amount, submit.
- UI cập nhật số liệu ngay sau thao tác.

### UI-BUD-04 Transfer idempotent trên UI
- Bấm submit nhanh 2 lần hoặc retry cùng key logic.
- Kỳ vọng không xuất hiện hiệu ứng chuyển tiền nhân đôi.

### UI-BUD-05 Hard-stop policy
- Bật/tắt hard-stop và warning threshold.
- Kỳ vọng cảnh báo/chặn request chi phản ánh đúng policy.

### UI-BUD-06 Quyền truy cập
- EMPLOYEE/MANAGER/AUDITOR không được thấy nút quản trị budget (hoặc bị disable + thông báo rõ).

---

## 4.3 Transactions

### UI-TXN-01 Tạo đề nghị chi (expense)
- EMPLOYEE điền đầy đủ form (department, budget, amount, date, description).
- Submit thành công -> xuất hiện trong list với trạng thái ban đầu đúng.

### UI-TXN-02 Validation amount/split
- Tổng split khác amount -> báo lỗi, không cho submit.

### UI-TXN-03 Upload attachment
- Upload file hợp lệ -> hiển thị trong danh sách file đính kèm.
- File không hợp lệ -> báo lỗi rõ.

### UI-TXN-04 Lọc danh sách giao dịch
- Lọc theo status/type/keyword/date -> kết quả đúng.

### UI-TXN-05 Execute giao dịch
- ACCOUNTANT thực hiện execute với giao dịch đủ điều kiện.
- Trạng thái đổi đúng, badge cập nhật đúng.

### UI-TXN-06 Execute sai điều kiện
- Thử execute khi chưa được approve -> UI báo lỗi đúng nghiệp vụ, không đổi trạng thái.

### UI-TXN-07 Tab recurring
- Tạo recurring template, chạy recurring, kiểm tra giao dịch phát sinh.

### UI-TXN-08 Tab cashbook liên quan transaction
- Hiển thị account/postings đúng sau khi execute.

### UI-TXN-09 Quyền role
- EMPLOYEE không thấy action execute.
- MANAGER không được thao tác của accountant nếu không có quyền.

---

## 4.4 Approvals

### UI-APR-01 Danh sách chờ duyệt
- MANAGER thấy đúng các yêu cầu cần duyệt.

### UI-APR-02 Approve
- Bấm approve, ghi chú tùy chọn, xác nhận.
- Trạng thái approval + transaction hiển thị đúng sau refresh.

### UI-APR-03 Reject
- Bấm reject, nhập lý do, xác nhận.
- Trạng thái cập nhật đúng, không còn action trái trạng thái.

### UI-APR-04 Execute/not-execute (nếu có trên UI)
- Chỉ role hợp lệ thấy nút.
- Action xong trạng thái/badge hiển thị đúng.

### UI-APR-05 Chặn role không hợp lệ
- EMPLOYEE/AUDITOR truy cập trang approvals: chỉ thấy phần hợp lệ hoặc bị chặn đúng chính sách.

---

## 4.5 Reimbursement

### UI-RMB-01 Tạo request tạm ứng
- EMPLOYEE tạo reimbursement thành công.

### UI-RMB-02 Pay advance
- Role hợp lệ thực hiện chi tạm ứng.
- Trạng thái chuyển đúng bước workflow.

### UI-RMB-03 Submit settlement
- EMPLOYEE nộp actual amount + ghi chú.
- Validation số tiền hoạt động đúng (không âm, đúng định dạng).

### UI-RMB-04 Review settlement
- MANAGER/ACCOUNTANT (theo quyền) review approve/reject settlement.

### UI-RMB-05 Complete reimbursement
- Hoàn tất hồ sơ, trạng thái cuối đúng.

### UI-RMB-06 Luồng net direction hiển thị rõ
- Trường hợp net > 0 và net < 0 phải hiển thị đúng hướng bù trừ trên UI.

### UI-RMB-07 Chặn thao tác sai trạng thái
- Nút action không hợp lệ phải ẩn/disable theo trạng thái hiện tại.

---

## 4.6 Reports

### UI-RPT-01 Bộ lọc báo cáo
- Filter theo phòng ban/khoảng thời gian áp dụng đúng.

### UI-RPT-02 Chart hiển thị
- Pie/Bar chart render đúng dữ liệu, không sai label.

### UI-RPT-03 Bảng dữ liệu chi tiết
- Số liệu bảng khớp chart/KPI cùng filter.

### UI-RPT-04 Read-only role
- AUDITOR xem được báo cáo nhưng không có nút ghi dữ liệu.

---

## 4.7 Security / User Management UI

### UI-SEC-01 Danh sách user và role
- FINANCE_ADMIN xem danh sách user, role hiển thị đúng.

### UI-SEC-02 Tạo/sửa user (nếu có)
- Validation input đầy đủ, thông báo thành công/lỗi rõ ràng.

### UI-SEC-03 Chặn truy cập trái quyền
- Role không phải admin không thấy hoặc không dùng được chức năng quản trị user.

---

## 5) Workflow E2E trên UI (đầy đủ nghiệp vụ)

## 5.1 WF-UI-01 Expense end-to-end
1. EMPLOYEE tạo request chi.
2. MANAGER approve.
3. ACCOUNTANT execute.
4. Kiểm tra trạng thái cuối trên Transactions/Approvals/Cashbook liên quan.

**Kỳ vọng:** toàn bộ màn hình phản ánh nhất quán một workflow đã hoàn tất.

## 5.2 WF-UI-02 Expense bị reject
1. EMPLOYEE tạo request.
2. MANAGER reject với lý do.
3. Kiểm tra không còn action execute hợp lệ.

## 5.3 WF-UI-03 Reimbursement full lifecycle
1. EMPLOYEE tạo reimbursement.
2. MANAGER approve.
3. ACCOUNTANT pay advance.
4. EMPLOYEE submit settlement.
5. Role duyệt settlement.
6. Complete.

**Kỳ vọng:** trạng thái đi đúng thứ tự, không cho “nhảy bước”.

## 5.4 WF-UI-04 Budget hard-stop + transfer mở khóa
1. Tạo tình huống budget cạn.
2. EMPLOYEE thử tạo request chi -> bị chặn.
3. FINANCE_ADMIN transfer budget vào nguồn thiếu.
4. EMPLOYEE tạo lại request -> cho phép nếu đủ điều kiện.

---

## 6) Checklist “đúng/chính xác/đủ chi tiết” cho mỗi màn hình

Mỗi test case UI phải xác nhận đủ 10 điểm:

1. Đúng hiển thị dữ liệu ban đầu
2. Đúng quyền hiển thị action theo role
3. Đúng validation phía người dùng
4. Đúng thông báo success/error
5. Đúng đổi trạng thái sau action
6. Đúng hành vi khi reload trang
7. Đúng hành vi khi mạng lỗi/API lỗi
8. Đúng empty state/loading state
9. Không có action trái workflow
10. Không có lộ thông tin/chức năng vượt quyền

---

## 7) Bộ test negative UI bắt buộc

### NEG-UI-01 Không có token hoặc token hết hạn
- Kỳ vọng chuyển login hoặc báo unauthorized rõ ràng.

### NEG-UI-02 Role không đủ quyền
- Truy cập URL trực tiếp trang cấm -> bị chặn đúng.

### NEG-UI-03 Double click submit
- Không tạo 2 bản ghi trùng trên UI.

### NEG-UI-04 API 500
- UI hiển thị lỗi, không treo, có thể retry.

### NEG-UI-05 Mất mạng giữa chừng
- Thao tác thất bại có thông báo rõ, không hiển thị success giả.

### NEG-UI-06 Dữ liệu không hợp lệ
- Toàn bộ form chính đều báo lỗi đúng field (amount/date/required/select).

---

## 8) Ma trận coverage UI theo role

| Màn hình | EMPLOYEE | MANAGER | ACCOUNTANT | FINANCE_ADMIN | AUDITOR |
|---|---|---|---|---|---|
| Dashboard | Xem | Xem | Xem | Xem | Xem (read-only) |
| Budgets | Hạn chế | Hạn chế | Hạn chế | Toàn quyền quản trị | Read-only (nếu policy cho phép) |
| Transactions | Tạo + xem | Xem | Execute + cashbook liên quan | Quản trị theo policy | Read-only |
| Approvals | Hạn chế | Approve/Reject | Execute/not-execute (theo quyền) | Theo policy | Read-only/blocked |
| Reimbursement | Tạo + submit settlement | Duyệt bước manager | Pay/complete theo quyền | Theo policy | Read-only |
| Reports | Xem theo quyền | Xem | Xem | Xem | Xem read-only |
| Security | Không | Không | Không | Quản trị | Không |

> Khi chạy thực tế, nếu policy hiện hành khác một ô nào trong bảng trên, cập nhật ngay matrix để bám đúng `rbac.ts` và hành vi thực tế.

---

## 9) Tiêu chí hoàn thành kiểm thử UI

Được xem là “đúng, chính xác, chi tiết, đầy đủ” khi:

1. 100% test case critical của tất cả màn hình pass.
2. 100% workflow E2E bắt buộc pass.
3. 100% kiểm thử role boundary pass (không có lộ quyền).
4. Không còn lỗi Severity 1/2 trên UI.
5. Tất cả negative UI quan trọng pass.
6. Có báo cáo coverage theo role + theo workflow.

---

## 10) Kế hoạch thực thi đề xuất

### Vòng 1: Smoke & RBAC
- Chạy mục 3 + mục 8.

### Vòng 2: Feature deep test
- Chạy mục 4 toàn bộ module.

### Vòng 3: Workflow E2E
- Chạy mục 5.

### Vòng 4: Negative/Resilience
- Chạy mục 7.

### Vòng 5: Regression nhanh hằng ngày
- SMK-UI-01, UI-TXN-01, UI-APR-02, UI-RMB-03, UI-BUD-03, UI-RPT-01, NEG-UI-02.

---

## 11) Kết luận

Tài liệu này đã chuyển trọng tâm hoàn toàn sang **kiểm thử UI tất cả feature + workflow + role** để trả lời đúng câu hỏi: “UI đã đúng, chính xác, chi tiết, đầy đủ chưa?”.

Khi QA chạy theo tài liệu này, có thể xác định rõ:
- Chức năng nào đúng/sai
- Luồng nào bị đứt
- Role nào bị thừa/thiếu quyền
- Mức độ hoàn thiện UI theo chuẩn nghiệp vụ tài chính.