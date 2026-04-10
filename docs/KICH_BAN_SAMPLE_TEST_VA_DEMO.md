# Kịch bản sample test toàn bộ chức năng, role, workflow và hướng dẫn quay demo

## 1) Mục tiêu tài liệu

Tài liệu này cung cấp kịch bản test mẫu theo hướng end-to-end để:

- Kiểm tra đầy đủ các chức năng cốt lõi theo từng vai trò.
- Xác nhận workflow nghiệp vụ chuẩn: Budget → Approval → Transaction → Ledger.
- Đánh giá kết quả đầu ra, ý nghĩa nghiệp vụ và lợi ích vận hành.
- Hướng dẫn chi tiết flow quay video demo cho từng tính năng.

---

## 2) Phạm vi test

## 2.1 Vai trò

- EMPLOYEE
- MANAGER
- ACCOUNTANT
- FINANCE_ADMIN
- AUDITOR

## 2.2 Nhóm chức năng

1. Đăng nhập/đăng xuất và phân quyền menu.
2. Dashboard tổng quan.
3. Giao dịch (thu/chi, danh sách, recurring, cashbook).
4. Quy trình duyệt chi.
5. Hoàn ứng.
6. Điều phối ngân sách + hard-stop/soft-warning.
7. Ngân sách phòng ban.
8. Báo cáo.
9. Bảo mật & nhật ký (audit/ledger/reversal).
10. Quản lý người dùng.
11. Quản lý tỷ giá.
12. Trợ lý AI.

---

## 3) Bộ dữ liệu mẫu (seed test)

## 3.1 Tài khoản mẫu

- `employee01 / ********` (EMPLOYEE)
- `manager01 / ********` (MANAGER)
- `accountant01 / ********` (ACCOUNTANT)
- `financeadmin01 / ********` (FINANCE_ADMIN)
- `auditor01 / ********` (AUDITOR)

## 3.2 Dữ liệu ngân sách

- Budget A (Marketing): 500,000,000 VND
- Budget B (Operations): 300,000,000 VND
- Warning threshold: 80%
- Hard-stop: available <= 0

## 3.3 Dữ liệu giao dịch nền

- 10 giao dịch thu/chi lịch sử để kiểm tra dashboard/report.
- 2 yêu cầu chi đang chờ duyệt.
- 1 hồ sơ hoàn ứng đã duyệt tạm ứng, chưa quyết toán.

---

## 4) Ma trận quyền theo role (test nhanh)

| Chức năng | EMPLOYEE | MANAGER | ACCOUNTANT | FINANCE_ADMIN | AUDITOR |
|---|---:|---:|---:|---:|---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tạo giao dịch | ✓ (phạm vi) | ✓ | ✓ | ✓ | ✗ |
| Duyệt chi | ✗ | ✓ | (thực thi sau duyệt) | ✓ | ✗ |
| Điều phối ngân sách | ✗ | ✓ | ✓ | ✓ | ✗ |
| Quản lý user | ✗ | ✗ | ✗ | ✓ | ✗ |
| Quản lý tỷ giá | ✗ | ✗ | ✗ | ✓ | ✗ |
| Audit/Ledger xem | hạn chế | theo quyền | theo quyền | đầy đủ | theo quyền audit |
| Trợ lý AI chat | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 5) Kịch bản test chi tiết theo chức năng

## TC-01: Đăng nhập & hiển thị menu theo quyền

**Mục tiêu:** Đảm bảo RBAC hoạt động đúng.

**Tiền điều kiện:** Có đủ 5 tài khoản vai trò.

**Bước test:**
1. Đăng nhập lần lượt từng tài khoản.
2. Quan sát menu sidebar.
3. Truy cập thử URL nhạy cảm (ví dụ `/users`) bằng tài khoản không có quyền.

**Kết quả mong đợi:**
- Mỗi role chỉ thấy menu được cấp quyền.
- URL không có quyền bị chặn/403/redirect.

**Ý nghĩa:** Ngăn truy cập trái phép, đảm bảo an toàn vận hành.

---

## TC-02: Dashboard KPI & biểu đồ

**Mục tiêu:** Kiểm tra dashboard phản ánh dữ liệu đúng.

**Bước test:**
1. Đăng nhập MANAGER.
2. Vào `/dashboard`.
3. Đối chiếu KPI tổng ngân sách/tổng chi/tổng thu/số dư.
4. So sánh biểu đồ 6 tháng với dữ liệu mẫu.

**Kết quả mong đợi:**
- KPI hiển thị đầy đủ, đúng số liệu mẫu.
- Biểu đồ và danh sách giao dịch gần đây không lỗi hiển thị.

**Lợi ích:** Hỗ trợ ra quyết định nhanh bằng dữ liệu tức thời.

---

## TC-03: Tạo giao dịch INCOME

**Mục tiêu:** Đảm bảo luồng thu tiền chuẩn.

**Bước test:**
1. Đăng nhập ACCOUNTANT.
2. Vào `/transactions`, tạo giao dịch loại INCOME.
3. Nhập số tiền 50,000,000 VND, mô tả, ngày.
4. Lưu giao dịch.
5. Kiểm tra cashbook tăng số dư.
6. Kiểm tra ledger append thêm entry mới.

**Kết quả mong đợi:**
- Giao dịch được tạo thành công.
- Số dư cashbook tăng đúng.
- Ledger có entry mới, không bị sửa trực tiếp.

**Ý nghĩa:** Chuẩn hóa ghi nhận thu và truy vết kế toán.

---

## TC-04: Tạo request EXPENSE và duyệt

**Mục tiêu:** Kiểm tra full flow chi từ yêu cầu đến thực thi.

**Bước test:**
1. EMPLOYEE tạo request chi 20,000,000 VND (kèm chứng từ).
2. MANAGER vào `/approvals`, duyệt yêu cầu.
3. Kiểm tra budget: `reserved += 20,000,000`.
4. ACCOUNTANT thực hiện chi.
5. Kiểm tra budget: `reserved -= 20,000,000`, `used += 20,000,000`.
6. Kiểm tra cashbook giảm 20,000,000.
7. Kiểm tra ledger append entry.

**Kết quả mong đợi:**
- Không thể execute nếu chưa duyệt.
- Sau execute, các số liệu budget/cashbook/ledger nhất quán.

**Lợi ích:** Đảm bảo kiểm soát chi tiêu theo đúng quy trình nội bộ.

---

## TC-05: Từ chối yêu cầu chi

**Mục tiêu:** Đảm bảo yêu cầu bị reject không đi tiếp.

**Bước test:**
1. EMPLOYEE tạo yêu cầu chi mới.
2. MANAGER chọn Reject.
3. ACCOUNTANT thử tìm và thực thi yêu cầu đó.

**Kết quả mong đợi:**
- Yêu cầu ở trạng thái từ chối.
- Không thể tạo transaction execute từ yêu cầu đã reject.

**Ý nghĩa:** Tránh chi sai, tăng kỷ luật tài chính.

---

## TC-06: Soft warning ngân sách

**Mục tiêu:** Kiểm tra cảnh báo khi dùng gần ngưỡng.

**Bước test:**
1. Tạo/execute giao dịch để budget đạt >80%.
2. Vào trang ngân sách.

**Kết quả mong đợi:**
- Hệ thống hiển thị cảnh báo soft warning rõ ràng.
- Vẫn có thể thao tác tiếp (theo chính sách).

**Lợi ích:** Cảnh báo sớm giúp quản lý chủ động điều phối.

---

## TC-07: Hard-stop ngân sách

**Mục tiêu:** Xác nhận cơ chế chặn cứng khi hết khả dụng.

**Bước test:**
1. Dùng hết available của Budget A.
2. EMPLOYEE thử gửi yêu cầu chi mới.
3. MANAGER/ACCOUNTANT thử tạo lệnh chuyển ra từ budget này.

**Kết quả mong đợi:**
- Hệ thống chặn thao tác phát sinh mới liên quan budget đã hard-stop.
- Có thông báo nguyên nhân rõ ràng.

**Lợi ích:** Ngăn vượt ngân sách ngay tại thời điểm thao tác.

---

## TC-08: Budget transfer

**Mục tiêu:** Kiểm tra chuyển ngân sách A → B đúng nghiệp vụ.

**Bước test:**
1. Đăng nhập FINANCE_ADMIN.
2. Vào `/budgeting`, tạo lệnh chuyển 30,000,000 từ A sang B.
3. Xác nhận chuyển.
4. Kiểm tra số dư A/B và audit log.
5. Kiểm tra ledger append.

**Kết quả mong đợi:**
- A giảm 30,000,000; B tăng 30,000,000.
- Có audit log và ledger entry tương ứng.

**Ý nghĩa:** Điều phối nguồn lực tài chính linh hoạt nhưng vẫn truy vết được.

---

## TC-09: Hoàn ứng (advance vs actual)

**Mục tiêu:** Kiểm tra vòng đời tạm ứng-quyết toán-bù trừ.

**Bước test:**
1. EMPLOYEE tạo yêu cầu tạm ứng 10,000,000.
2. MANAGER duyệt, ACCOUNTANT chi tạm ứng.
3. EMPLOYEE nộp chứng từ thực chi 8,500,000.
4. ACCOUNTANT hoàn tất settlement.

**Kết quả mong đợi:**
- Hệ thống tính `net = 1,500,000` nhân viên phải hoàn lại.
- Sinh transaction bù trừ phù hợp.
- Ledger append các entry liên quan.

**Lợi ích:** Tự động hóa quyết toán, giảm sai sót tính tay.

---

## TC-10: Báo cáo tổng hợp và bộ lọc

**Mục tiêu:** Xác nhận report đúng theo thời gian/phòng ban.

**Bước test:**
1. Vào `/reports` bằng MANAGER hoặc FINANCE_ADMIN.
2. Chọn bộ lọc từ ngày/đến ngày/phòng ban.
3. Kiểm tra KPI, pie chart, Budget vs Actual, forecast, bảng tháng.

**Kết quả mong đợi:**
- Dữ liệu thay đổi đúng theo bộ lọc.
- Các biểu đồ và bảng không sai lệch logic.

**Ý nghĩa:** Tăng khả năng phân tích và lập kế hoạch tài chính.

---

## TC-11: Audit logs & ledger & reversal

**Mục tiêu:** Đảm bảo khả năng kiểm toán và bất biến dữ liệu kế toán.

**Bước test:**
1. Đăng nhập AUDITOR/FINANCE_ADMIN vào `/security`.
2. Lọc audit logs theo thời gian/tác nhân/hành động.
3. Mở ledger entry bất kỳ.
4. Thực hiện reversal theo quyền (không sửa trực tiếp entry cũ).

**Kết quả mong đợi:**
- Truy vết được đầy đủ thao tác.
- Ledger entry cũ không bị sửa, chỉ có entry đảo.

**Lợi ích:** Đảm bảo minh bạch và đáp ứng kiểm toán.

---

## TC-12: Quản lý người dùng

**Mục tiêu:** Kiểm tra FINANCE_ADMIN quản trị vòng đời user.

**Bước test:**
1. FINANCE_ADMIN vào `/users`.
2. Tạo user mới (EMPLOYEE).
3. Cập nhật role/trạng thái.
4. Đăng nhập thử user mới.
5. Xóa hoặc khóa user.

**Kết quả mong đợi:**
- CRUD user hoạt động đúng.
- Phân quyền áp dụng ngay theo cấu hình.

**Ý nghĩa:** Bảo đảm quản trị truy cập tập trung.

---

## TC-13: Quản lý tỷ giá

**Mục tiêu:** Xác nhận trang tỷ giá chỉ đọc lịch sử, đúng quyền.

**Bước test:**
1. FINANCE_ADMIN vào `/fx-rates`.
2. Thực hiện lọc/phân trang.
3. Dùng EMPLOYEE truy cập thử.

**Kết quả mong đợi:**
- FINANCE_ADMIN xem được lịch sử tỷ giá.
- Role không quyền không truy cập được.
- Không có thao tác nhập tay trái chính sách.

**Ý nghĩa:** Giảm sai lệch tỷ giá do nhập tay.

---

## TC-14: Trợ lý AI theo ngữ cảnh phân quyền

**Mục tiêu:** Kiểm tra AI chat hỗ trợ nghiệp vụ, có kiểm soát quyền.

**Bước test:**
1. Đăng nhập EMPLOYEE vào `/ai-assistant`, đặt câu hỏi nghiệp vụ.
2. Đăng nhập FINANCE_ADMIN quản lý tài liệu tri thức AI.
3. Kiểm tra role không phải admin không thấy chức năng quản trị tri thức.

**Kết quả mong đợi:**
- Chat hoạt động, phản hồi theo ngữ cảnh cho phép.
- Chỉ FINANCE_ADMIN quản lý knowledge documents.

**Lợi ích:** Nâng hiệu suất tra cứu nghiệp vụ, giảm phụ thuộc hỏi đáp thủ công.

---

## 6) Kịch bản workflow tổng hợp liên role (demo chuẩn)

## WF-01: Chuỗi chi đầy đủ 4 vai trò

1. EMPLOYEE tạo request chi + chứng từ.
2. MANAGER duyệt.
3. ACCOUNTANT thực hiện chi.
4. AUDITOR kiểm tra audit/ledger.
5. FINANCE_ADMIN theo dõi dashboard/report.

**Kết quả cần chốt:**
- Một giao dịch đi trọn vòng đời, dữ liệu nhất quán ở mọi màn hình.

---

## WF-02: Sự cố và bù trừ

1. Tạo tình huống execute fail sau khi reserve.
2. Kiểm tra hệ thống release reserve + ghi audit lỗi.
3. Tạo tình huống ledger append fail (môi trường test), xác nhận rollback/retry theo thiết kế.

**Kết quả cần chốt:**
- Không để dữ liệu ở trạng thái nửa vời, đảm bảo toàn vẹn nghiệp vụ.

---

## 7) Hướng dẫn quay video demo chi tiết

## 7.1 Chuẩn bị trước khi quay

- Reset dữ liệu theo seed chung.
- Đăng nhập sẵn 5 tài khoản trên 5 profile trình duyệt hoặc incognito riêng.
- Chuẩn bị script lời thoại ngắn cho từng cảnh.
- Bật hiển thị thời gian thao tác (nếu cần minh chứng tốc độ).

## 7.2 Cấu trúc video đề xuất

### Phần A – Mở đầu (1–2 phút)

- Nêu vấn đề thực tế và mục tiêu hệ thống.
- Giới thiệu vai trò và luồng tổng quát.

### Phần B – Demo chức năng theo luồng nghiệp vụ (8–15 phút)

1. Đăng nhập theo role, show menu khác nhau.
2. Tạo request chi (EMPLOYEE).
3. Duyệt chi (MANAGER).
4. Execute chi (ACCOUNTANT).
5. Kiểm tra budget/cashbook/ledger.
6. Demo soft warning + hard-stop.
7. Demo budget transfer.
8. Demo hoàn ứng.
9. Demo báo cáo dashboard.
10. Demo audit log + reversal.
11. Demo quản lý user, fx-rates, AI assistant.

### Phần C – Kết thúc (1–2 phút)

- Tổng hợp lợi ích đạt được.
- Nhấn mạnh tính minh bạch, kiểm soát và khả năng mở rộng.

## 7.3 Checklist quay cho từng tính năng

- Có hiển thị URL/trang chức năng.
- Có hiển thị role thực hiện thao tác.
- Có bước nhập liệu đầu vào.
- Có kết quả đầu ra (status, số liệu, log, biểu đồ).
- Có giải thích ngắn: “tính năng này giúp gì cho nghiệp vụ”.

## 7.4 Mẫu lời thoại ngắn cho mỗi cảnh

- **Mục tiêu cảnh:** “Đây là bước duyệt chi để đảm bảo không chi trước khi được phê duyệt.”
- **Thao tác:** “Manager kiểm tra chứng từ và bấm Approve.”
- **Kết quả:** “Budget chuyển sang reserved, chưa trừ used cho đến khi kế toán execute.”
- **Ý nghĩa:** “Giảm rủi ro chi sai và tăng khả năng truy vết.”

---

## 8) Tiêu chí nghiệm thu (acceptance)

- 100% test case trọng yếu pass (TC-01 → TC-14).
- Không có lỗi quyền nghiêm trọng (critical RBAC defect).
- Không có sai lệch số liệu giữa budget/cashbook/ledger trong flow chuẩn.
- Video demo thể hiện đủ:
  - ít nhất 5 vai trò,
  - ít nhất 2 workflow đầy đủ,
  - ít nhất 1 tình huống cảnh báo/chặn cứng,
  - ít nhất 1 tình huống audit/ledger/reversal.

---

## 9) Kết luận

Bộ kịch bản này giúp kiểm chứng hệ thống theo đúng nghiệp vụ tài chính thực tế, đồng thời tạo bộ demo nhất quán để trình bày với stakeholder. Việc test theo role + workflow đảm bảo vừa đúng chức năng, vừa đúng mục tiêu quản trị: minh bạch, kiểm soát, truy vết, và sẵn sàng mở rộng.
