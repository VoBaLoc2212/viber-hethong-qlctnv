# Tài liệu hướng dẫn sử dụng website quản lý ngân sách & thu/chi

> Phiên bản: 2026-03-30
> Đối tượng: Nhân viên, Quản lý, Kế toán, Quản trị tài chính, Kiểm toán

---

## Mục lục điều hướng nhanh

1. [Bắt đầu nhanh](#1-bắt-đầu-nhanh)
2. [Điều hướng giao diện](#2-điều-hướng-giao-diện)
3. [Phân quyền theo vai trò](#3-phân-quyền-theo-vai-trò)
4. [Tổng quan (Dashboard)](#4-tổng-quan-dashboard)
5. [Giao dịch](#5-giao-dịch)
6. [Quy trình duyệt chi](#6-quy-trình-duyệt-chi)
7. [Hoàn ứng](#7-hoàn-ứng)
8. [Điều phối ngân sách](#8-điều-phối-ngân-sách)
9. [Ngân sách phòng ban](#9-ngân-sách-phòng-ban)
10. [Báo cáo](#10-báo-cáo)
11. [Bảo mật & Nhật ký](#11-bảo-mật--nhật-ký)
12. [Quản lý người dùng](#12-quản-lý-người-dùng)
13. [Quản lý tỷ giá](#13-quản-lý-tỷ-giá)
14. [Trợ lý AI](#14-trợ-lý-ai)
15. [Mẹo vận hành & xử lý lỗi thường gặp](#15-mẹo-vận-hành--xử-lý-lỗi-thường-gặp)
16. [Câu hỏi thường gặp (FAQ)](#16-câu-hỏi-thường-gặp-faq)

---

## 1. Bắt đầu nhanh

### 1.1 Đăng nhập
1. Mở trang **/auth**.
2. Nhập **tên đăng nhập** và **mật khẩu**.
3. Bấm **Đăng nhập**.
4. Hệ thống sẽ tự chuyển đến trang phù hợp theo vai trò.

> Lưu ý: Tự đăng ký tài khoản không mở cho người dùng cuối. Tài khoản do quản trị viên tạo.

### 1.2 Đăng xuất
1. Nhấn vào khu vực thông tin người dùng ở góc phải trên.
2. Chọn **Đăng xuất**.
3. Xác nhận trên hộp thoại.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 2. Điều hướng giao diện

### 2.1 Thanh menu trái
Các mục chính:
- Tổng quan
- Giao dịch
- Điều phối ngân sách
- Ngân sách
- Quy trình duyệt chi
- Hoàn ứng
- Báo cáo
- Bảo mật & Nhật ký
- Quản lý người dùng
- Quản lý tỷ giá
- Trợ lý AI

> Hệ thống chỉ hiển thị các mục bạn có quyền truy cập.

### 2.2 Thanh trên cùng
- **Ô tìm kiếm**: tìm nhanh giao dịch.
- **Chuông thông báo**: xem giao dịch gần đây, đánh dấu đã đọc, ẩn thông báo.
- **Nút giao diện sáng/tối**.
- **Thông tin người dùng** và đăng xuất.

### 2.3 Trợ giúp
- Nút **Tài liệu** ở cuối thanh menu trái dẫn đến trang **/help**.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 3. Phân quyền theo vai trò

### 3.1 Nhân viên (EMPLOYEE)
- Truy cập: Tổng quan, Giao dịch, Hoàn ứng, Trợ lý AI.

### 3.2 Quản lý (MANAGER)
- Truy cập thêm: Điều phối ngân sách, Ngân sách, Quy trình duyệt chi, Báo cáo.
- Có quyền phê duyệt yêu cầu chi và yêu cầu hoàn ứng.

### 3.3 Kế toán (ACCOUNTANT)
- Truy cập tương tự Quản lý + khu vực bảo mật/nhật ký theo quyền.
- Có quyền thực hiện chi, chi tạm ứng, đối soát, xử lý settlement.

### 3.4 Quản trị tài chính (FINANCE_ADMIN)
- Quyền cao nhất về vận hành tài chính.
- Truy cập thêm: Quản lý người dùng, Quản lý tỷ giá, cấu hình hard-stop, quản trị tài liệu tri thức AI.

### 3.5 Kiểm toán (AUDITOR)
- Tập trung vào xem dữ liệu, báo cáo, nhật ký/audit theo phạm vi được cấp.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 4. Tổng quan (Dashboard)

### 4.1 Chức năng chính
- Xem KPI: tổng ngân sách, tổng chi, số dư còn lại, tổng thu.
- Theo dõi biểu đồ thu/chi 6 tháng.
- Xem danh sách giao dịch gần đây.

### 4.2 Mục đích sử dụng
- Nắm nhanh sức khỏe tài chính tổng thể.
- Theo dõi xu hướng thu/chi trước khi ra quyết định.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 5. Giao dịch

Trang **/transactions** gồm nhiều tab chức năng.

### 5.1 Tạo giao dịch
1. Vào tab tạo giao dịch.
2. Chọn loại: **INCOME** (thu) hoặc **EXPENSE** (chi).
3. Nhập thông tin: số tiền, ngày, mô tả, phòng ban/ngân sách liên quan.
4. Thêm tệp đính kèm (PDF/JPG/PNG/WebP) nếu cần.
5. Lưu giao dịch.

### 5.2 Danh sách giao dịch
- Lọc theo trạng thái, loại, từ khóa.
- Theo dõi mã giao dịch, số tiền, ngày, trạng thái.

### 5.3 Giao dịch định kỳ (Recurring)
- Tạo mẫu giao dịch định kỳ.
- Theo dõi danh sách mẫu.
- Chạy mẫu đến hạn.

### 5.4 Sổ quỹ (Cashbook)
- Xem biến động số dư.
- Thực hiện đối soát theo quyền.

### 5.5 Quy tắc quan trọng
- Yêu cầu chi phải qua quy trình duyệt trước khi thực thi.
- Các bút toán đã thực thi/đảo bút toán không được chỉnh sửa trực tiếp.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 6. Quy trình duyệt chi

Trang **/approvals** hỗ trợ luồng phê duyệt chi phí.

### 6.1 Bộ lọc trạng thái
- Tất cả
- Chờ duyệt
- Đã duyệt
- Từ chối

### 6.2 Hành động theo vai trò
- **Quản lý**: Duyệt / Từ chối yêu cầu chờ duyệt.
- **Kế toán**: Thực hiện chi hoặc đánh dấu không thực hiện sau khi đã duyệt.

### 6.3 Thao tác chuẩn
1. Mở chi tiết yêu cầu.
2. Kiểm tra thông tin ngân sách, phòng ban, chứng từ.
3. Chọn hành động phù hợp và ghi chú (nếu cần).

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 7. Hoàn ứng

Trang **/reimbursement** quản lý vòng đời tạm ứng - quyết toán.

### 7.1 Luồng nghiệp vụ
1. Nhân viên tạo yêu cầu tạm ứng.
2. Quản lý duyệt.
3. Kế toán chi tạm ứng.
4. Nhân viên nộp quyết toán thực tế + chứng từ.
5. Kế toán rà soát, hoàn tất hoặc từ chối.

### 7.2 Kết quả quyết toán
- Nếu tạm ứng > thực chi: nhân viên hoàn lại công ty.
- Nếu tạm ứng < thực chi: công ty chi bổ sung.
- Nếu bằng nhau: không phát sinh bù trừ.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 8. Điều phối ngân sách

Trang **/budgeting** dành cho vai trò phân tích tài chính.

### 8.1 Quản lý ngân sách
- Tạo/cập nhật ngân sách.
- Theo dõi mức sử dụng, phần còn lại.

### 8.2 Chuyển ngân sách
1. Chọn ngân sách nguồn và ngân sách đích.
2. Nhập số tiền và lý do.
3. Xác nhận lệnh chuyển.

### 8.3 Cơ chế kiểm soát
- **Soft warning** khi dùng gần ngưỡng cảnh báo.
- **Hard-stop** khi hết khả dụng: chặn gửi thêm yêu cầu chi/chuyển ra.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 9. Ngân sách phòng ban

Trang **/budgets** hiển thị tình trạng ngân sách theo phòng ban.

### 9.1 Thông tin hiển thị
- Ngân sách được cấp
- Đã sử dụng
- Còn lại
- Tỷ lệ sử dụng

### 9.2 Cảnh báo
- Cảnh báo khi gần chạm ngưỡng.
- Cảnh báo vượt ngân sách.

### 9.3 Tạo phòng ban
- Chỉ **FINANCE_ADMIN** có quyền tạo phòng ban mới.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 10. Báo cáo

Trang **/reports** hỗ trợ phân tích tài chính theo bộ lọc.

### 10.1 Bộ lọc
- Từ ngày
- Đến ngày
- Phòng ban

### 10.2 Nội dung báo cáo
- KPI tổng hợp
- Cơ cấu chi phí (biểu đồ tròn)
- Budget vs Actual
- Dự báo cashflow tháng kế tiếp
- Bảng thu/chi theo tháng
- Giao dịch gần đây

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 11. Bảo mật & Nhật ký

Trang **/security** hỗ trợ truy vết nghiệp vụ.

### 11.1 Audit logs
- Xem nhật ký hành động người dùng/hệ thống.
- Lọc theo thời gian, loại hành động, tác nhân.

### 11.2 Ledger
- Xem bút toán bất biến.
- Tạo bút toán đảo (reversal) theo quyền.

### 11.3 Mục tiêu
- Đảm bảo minh bạch.
- Hỗ trợ kiểm toán và điều tra sự cố.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 12. Quản lý người dùng

Trang **/users** (FINANCE_ADMIN).

### 12.1 Chức năng
- Tạo người dùng mới.
- Cập nhật vai trò, trạng thái hoạt động, hồ sơ.
- Đổi mật khẩu.
- Xóa người dùng.

### 12.2 Khuyến nghị quản trị
- Cấp quyền theo nguyên tắc tối thiểu.
- Rà soát tài khoản không còn sử dụng định kỳ.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 13. Quản lý tỷ giá

Trang **/fx-rates** (FINANCE_ADMIN).

### 13.1 Chức năng
- Xem lịch sử tỷ giá.
- Lọc và phân trang dữ liệu.

### 13.2 Lưu ý
- Tỷ giá được cập nhật tự động từ nguồn cấu hình.
- Không hỗ trợ nhập tay tỷ giá trực tiếp từ giao diện vận hành.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 14. Trợ lý AI

Trang **/ai-assistant**.

### 14.1 Đối tượng sử dụng
- Tất cả vai trò có thể chat với AI.

### 14.2 Chức năng
- Tạo và quản lý phiên hội thoại.
- Hỏi đáp nghiệp vụ và dữ liệu theo ngữ cảnh hệ thống.

### 14.3 Quản lý tri thức AI
- Chỉ **FINANCE_ADMIN** được tải lên, quản lý, lưu trữ/ẩn tài liệu tri thức.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 15. Mẹo vận hành & xử lý lỗi thường gặp

### 15.1 Không thấy menu chức năng
- Nguyên nhân: vai trò hiện tại không có quyền.
- Cách xử lý: liên hệ FINANCE_ADMIN để rà soát phân quyền.

### 15.2 Không đăng nhập được
- Kiểm tra tài khoản/mật khẩu.
- Kiểm tra trạng thái tài khoản còn hoạt động.

### 15.3 Không tạo được yêu cầu chi
- Có thể ngân sách đã hard-stop hoặc không đủ khả dụng.
- Kiểm tra mục Điều phối ngân sách/Ngân sách.

### 15.4 Không thực hiện được thao tác duyệt/chi
- Đảm bảo yêu cầu đang ở đúng trạng thái quy trình.
- Đảm bảo bạn có vai trò phù hợp (Manager/Accountant).

### 15.5 Gợi ý vận hành an toàn
- Đính kèm đủ chứng từ cho các khoản chi.
- Ghi rõ lý do khi từ chối hoặc chuyển ngân sách.
- Theo dõi dashboard và báo cáo định kỳ để phát hiện bất thường sớm.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## 16. Câu hỏi thường gặp (FAQ)

### 16.1 Tài khoản nào được tự tạo giao dịch thu/chi?
- **EMPLOYEE**: tạo giao dịch theo phạm vi quyền được cấp.
- **MANAGER/ACCOUNTANT/FINANCE_ADMIN**: có thể tạo giao dịch trong phạm vi nghiệp vụ tương ứng.
- Nếu không thấy nút tạo giao dịch, nguyên nhân thường là thiếu quyền hoặc tài khoản bị khóa.

### 16.2 Vì sao tôi không thấy một số menu dù đã đăng nhập thành công?
- Hệ thống hiển thị menu theo **vai trò hiện tại**.
- Với tài khoản nhiều vai trò (nếu có cấu hình), cần kiểm tra vai trò đang áp dụng.
- Liên hệ **FINANCE_ADMIN** để xác nhận quyền truy cập đúng với vị trí công việc.

### 16.3 Tôi có thể chỉnh sửa giao dịch đã được duyệt/thực thi không?
- Giao dịch đã thực thi và bút toán ledger không chỉnh sửa trực tiếp.
- Khi cần điều chỉnh, dùng luồng nghiệp vụ phù hợp như **reversal** hoặc tạo giao dịch bù trừ mới theo quyền.

### 16.4 Hard-stop là gì và ảnh hưởng thế nào?
- **Hard-stop** là cơ chế chặn thao tác khi ngân sách không còn khả dụng.
- Khi hard-stop kích hoạt, người dùng không thể gửi thêm yêu cầu chi/chuyển ra từ ngân sách đó.
- Cần điều phối bổ sung ngân sách hoặc chờ nạp ngân sách trước khi thao tác lại.

### 16.5 Soft warning khác gì hard-stop?
- **Soft warning**: chỉ cảnh báo ngưỡng rủi ro, vẫn có thể tiếp tục thao tác (tùy chính sách).
- **Hard-stop**: chặn hoàn toàn thao tác vượt giới hạn khả dụng.

### 16.6 Quy trình duyệt chi chuẩn gồm những bước nào?
1. Nhân viên tạo yêu cầu chi và đính kèm chứng từ.
2. Quản lý duyệt/từ chối.
3. Kế toán thực hiện chi hoặc đánh dấu không thực hiện.
4. Hệ thống ghi nhận nhật ký để truy vết.

### 16.7 Trường hợp nào yêu cầu chi bị từ chối nhiều nhất?
- Thiếu/chưa hợp lệ chứng từ.
- Mô tả chi không rõ mục đích.
- Vượt ngân sách hoặc sai phòng ban/ngân sách áp dụng.
- Không tuân thủ quy định nội bộ (định mức, hạn mức, quy trình).

### 16.8 Hoàn ứng xử lý khoản chênh lệch như thế nào?
- **Tạm ứng > thực chi**: nhân viên hoàn lại phần dư.
- **Tạm ứng < thực chi**: công ty chi bổ sung phần thiếu.
- **Tạm ứng = thực chi**: không phát sinh bù trừ.

### 16.9 Tôi có thể xóa người dùng không còn làm việc không?
- Có, nhưng chỉ vai trò **FINANCE_ADMIN** có quyền thao tác tại **/users**.
- Trước khi xóa/khóa tài khoản, nên rà soát giao dịch đang xử lý để tránh gián đoạn nghiệp vụ.

### 16.10 Vì sao báo cáo và dashboard có thể lệch số tạm thời?
- Dashboard ưu tiên hiển thị nhanh theo snapshot gần nhất.
- Báo cáo có thể áp dụng bộ lọc thời gian/phòng ban khác.
- Chênh lệch ngắn hạn thường do thời điểm đồng bộ dữ liệu và trạng thái giao dịch vừa cập nhật.

### 16.11 Tỷ giá có được nhập tay từ giao diện không?
- Không. Mục **/fx-rates** dùng để tra cứu lịch sử.
- Tỷ giá được cập nhật tự động từ nguồn cấu hình hệ thống.

### 16.12 Trợ lý AI có truy cập được mọi dữ liệu tài chính không?
- Trợ lý AI trả lời trong phạm vi quyền truy cập và chính sách dữ liệu của hệ thống.
- Tài liệu tri thức AI chỉ **FINANCE_ADMIN** được tải lên/quản lý.
- Không nhập thông tin ngoài phạm vi cho phép của công ty vào cuộc hội thoại.

### 16.13 Vì sao không tìm thấy giao dịch bằng ô tìm kiếm nhanh?
- Kiểm tra lại mã giao dịch/từ khóa (không dấu, viết tắt, ký tự đặc biệt).
- Kết hợp bộ lọc trạng thái, loại giao dịch, khoảng thời gian.
- Đảm bảo bạn có quyền xem giao dịch thuộc phòng ban đó.

### 16.14 Những kiểm tra tối thiểu trước khi bấm Duyệt là gì?
- Đủ chứng từ hợp lệ, đọc được.
- Đúng ngân sách/phòng ban/cost center.
- Số tiền, mô tả, ngày phát sinh nhất quán.
- Không vi phạm hạn mức hoặc chính sách chi tiêu.

### 16.15 Cần làm gì khi nghi ngờ có thao tác bất thường?
1. Vào **/security** kiểm tra audit logs theo thời điểm/tác nhân.
2. Đối chiếu ledger và các giao dịch liên quan.
3. Thông báo quản trị tài chính/kiểm toán nội bộ theo quy trình sự cố.
4. Tạm khóa tài khoản liên quan nếu có dấu hiệu rủi ro cao (do FINANCE_ADMIN thực hiện).

### 16.16 Tôi nên liên hệ ai khi gặp lỗi hệ thống?
- Lỗi quyền truy cập/tài khoản: **FINANCE_ADMIN**.
- Lỗi nghiệp vụ duyệt chi/hoàn ứng: **MANAGER** hoặc **ACCOUNTANT** phụ trách.
- Lỗi dữ liệu, dashboard, báo cáo: bộ phận tài chính + đội vận hành hệ thống.

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)

---

## Phụ lục A - Bản đồ menu → chức năng

- **Tổng quan** → KPI, biểu đồ, giao dịch gần đây.
- **Giao dịch** → Tạo giao dịch, danh sách, recurring, sổ quỹ.
- **Điều phối ngân sách** → Quản trị budget, hard-stop, transfer.
- **Ngân sách** → Theo dõi ngân sách theo phòng ban.
- **Quy trình duyệt chi** → Duyệt/từ chối/thực hiện chi.
- **Hoàn ứng** → Tạm ứng, quyết toán, bù trừ.
- **Báo cáo** → KPI + biểu đồ + forecast.
- **Bảo mật & Nhật ký** → Audit log, ledger, reversal.
- **Quản lý người dùng** → CRUD user + role.
- **Quản lý tỷ giá** → Tra cứu lịch sử tỷ giá.
- **Trợ lý AI** → Chat hỗ trợ nghiệp vụ; quản trị tri thức (admin).

[⬆ Quay lại mục lục](#mục-lục-điều-hướng-nhanh)
