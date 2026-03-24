# Checklist kiểm thử sau deploy (UAT)

Dùng bản này trên **môi trường đã deploy** (URL production hoặc staging). Chuẩn bị trước: **ít nhất 2 tài khoản** (một học viên, một admin hoặc owner), và biết **mật khẩu / email** để đăng nhập. Nếu có thanh toán thật, nên dùng **số tiền nhỏ** hoặc cổng **sandbox** (nếu team đã cấu hình).

---

## A. Trước khi bắt đầu (5 phút)

1. Mở trang chủ bằng trình duyệt thường dùng (Chrome/Edge).
2. Kiểm tra **địa chỉ trang** đúng domain đã deploy (https).
3. **Đăng xuất** hết các phiên cũ (hoặc dùng cửa sổ ẩn danh để thử “khách”).
4. Xác nhận với team: **email xác nhận** (đăng ký) có đến hộp thư không; **thanh toán** đang bật cổng nào (VNPay / MoMo / Stripe).

---

## B. Khách chưa đăng nhập

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| B1 | Vào trang chủ, mở danh sách khóa học / chương trình (nếu có link) | Nội dung hiển thị, không lỗi trắng trang |
| B2 | Mở một khóa học chi tiết (xem mô tả, giá) | Thông tin đọc được, nút đăng ký (nếu có) hoạt động |
| B3 | Thử **Đăng ký tài khoản mới** (email chưa dùng) | Gửi email xác nhận (hoặc hướng dẫn kiểm tra hộp thư) |
| B4 | **Đăng nhập** bằng tài khoản học viên đã có | Vào được khu vực học viên (dashboard) |
| B5 | **Quên mật khẩu** (nếu có) hoặc đổi mật khẩu | Quy trình Supabase/email hoạt động theo cấu hình |

---

## C. Học viên — hồ sơ và tài khoản

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| C1 | Vào **Hồ sơ / Cài đặt học viên** (trang profile) | Xem/sửa họ tên, SĐT, công ty… (theo form) |
| C2 | **Tải ảnh đại diện** (jpg/png, dưới 2MB) | Ảnh hiển thị lại sau khi lưu |
| C3 | Đăng xuất, đăng nhập lại | Ảnh và thông tin vẫn đúng |

---

## D. Học viên — đăng ký khóa và thanh toán

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| D1 | Chọn một khóa **đang mở đăng ký**, bấm đăng ký (không thanh toán nếu có lựa chọn học thử) | Có đường dẫn vào học hoặc yêu cầu thanh toán đúng |
| D2 | Khóa **có phí**: làm **checkout** (thử một cổng team đã bật) | Chuyển sang cổng thanh toán; sau khi thanh toán thành công, quay lại và **vào được bài học** |
| D3 | Thử đăng ký **một khóa khác cùng chương trình nền** khi đang còn khóa cũ (nếu cùng “base course”) | Hệ thống **báo cần hủy khóa cũ** trước (đúng quy định) |
| D4 | Vào **Dashboard học viên** | Thấy khóa đã đăng ký, nút **Vào học** |

---

## E. Học viên — học bài, bài tập, tiến độ

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| E1 | Vào **trang học** của một khóa: xem video (nếu có), tài liệu PDF | Video tải/phát được; PDF xem được (có watermark nếu đã cấu hình) |
| E2 | **Bài có câu hỏi**: làm trắc nghiệm / điền đáp án | Chấm điểm sau khi submit; không thấy đáp án đúng trước khi đủ điều kiện feedback |
| E3 | **Bài không câu hỏi** | Có thông báo rõ; không bị tính điểm “ảo” trên trang tiến độ |
| E4 | **Mục tiến độ** (progress) của khóa | Phần trăm/tổng điểm hợp lý, không lỗi hiển thị |
| E5 | **Hỏi đáp bài học**: gửi câu hỏi (nếu có) | Câu hỏi của bạn xuất hiện trong luồng hỏi đáp |

---

## F. Học viên — thi cuối khóa và chứng chỉ

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| F1 | Khi đủ điều kiện, mở **thi cuối khóa** | Làm bài giới hạn số lần (vd tối đa 2 lần) |
| F2 | Sau khi đạt điểm theo quy định | Có **chứng chỉ** (hoặc thông báo chờ) trong mục chứng chỉ học viên |
| F3 | Trang **Xác minh chứng chỉ** (nếu có link công khai) | Nhập mã chứng chỉ → thấy thông tin đúng |

---

## G. Học viên — hủy đăng ký và trường hợp đặc biệt

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| G1 | Chọn **Hủy đăng ký** khóa (có xác nhận 2 bước) | Đăng ký chuyển trạng thái hủy; về dashboard không còn “đang học” khóa đó |
| G2 | (Tuỳ chọn) **Đăng ký lại** cùng khóa khi vẫn trong thời hạn và đủ điều kiện | Có thể vào học lại; tiến độ giữ đúng theo quy định (nếu có thanh toán / chưa vượt hạn hủy) |
| G3 | (Chỉ kiểm khi có kịch bản) **Tạm khóa tài khoản 3 ngày** (nếu chức năng bật) | Không vào khu học viên; sau thời hạn hoặc theo quy trình mở lại |

---

## H. Admin (không phải Owner)

Đăng nhập bằng tài khoản **admin**.

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| H1 | Vào **/admin** | Truy cập được; học viên thông thường **không** vào được (bị chuyển về dashboard học viên) |
| H2 | Quản lý **chương trình / khóa cơ bản / khóa thường** (theo quyền) | Xem danh sách, tạo/sửa theo quy trình (draft, gửi duyệt nếu có) |
| H3 | **Thư viện câu hỏi / bài thi cuối** (nếu được phân quyền) | Tạo/sửa câu hỏi, gắn vào khóa |
| H4 | **Hỏi đáp bài học**: xem câu hỏi học viên và **trả lời** | Trả lời hiển thị; trạng thái cập nhật (đã trả lời) |
| H5 | **Đề nghị xóa khóa** / yêu cầu liên quan (nếu có) | Luồng gửi và trạng thái đúng |

---

## I. Owner

Đăng nhập **owner**.

| Bước | Việc cần làm | Kết quả mong đợi |
|------|----------------|------------------|
| I1 | Vào **/owner** | Chỉ owner vào được; admin/học viên bị chuyển |
| I2 | **Quản lý học viên**: xem danh sách, chi tiết (mã HV, khóa học) | Dữ liệu khớp thực tế |
| I3 | **Quản lý admin**: tạo / sửa / xóa admin (theo quy trình) | Thao tác thành công; audit log nếu team theo dõi |
| I4 | **Phê duyệt chương trình / khóa** (nếu có luồng pending) | Trạng thái chuyển đúng |
| I5 | **Báo cáo thanh toán / xuất hóa đơn** (nếu dùng) | File hoặc màn hình đúng |
| I6 | **Mở khóa abuse** (nếu có học viên bị khóa tài khoản theo quy định hủy) | Sau khi mở, học viên đăng nhập lại bình thường |

---

## J. Kiểm tra nhanh trải nghiệm & lỗi giao diện

1. **Điện thoại** (hoặc thu nhỏ cửa sổ): trang chủ, đăng nhập, dashboard học viên, một trang học — không bị vỡ layout nặng.
2. **Ngôn ngữ**: chữ hiển thị cho người dùng là **tiếng Việt**, dễ đọc.
3. **Lỗi chung**: không có trang trắng không lời giải thích; nếu lỗi 403/404 có thông báo rõ khi có thể.

---

## K. Ghi nhận kết quả (khuyến nghị)

Mỗi mục ghi **Đạt / Không đạt** và **ghi chú ngắn** (ví dụ: “Thanh toán MoMo: lỗi sau khi quay lại”). Ảnh chụp màn hình giúp dev lập lại lỗi.

---

## Ghi chú kỹ thuật ngắn (không bắt buộc khi test)

- **CSRF / origin**: sau deploy cần đảm bảo biến `NEXT_PUBLIC_SITE_URL` (hoặc `NEXT_PUBLIC_APP_URL`) đúng domain production; nếu thiếu, một số thao tác (đăng ký hồ sơ, thanh toán, upload…) có thể báo **Invalid origin**.
- **Chạy script kiểm tra env** (nếu team dùng): `npm run check:env` trên máy có file `.env` production.

---

## Phạm vi không bắt buộc trong một lần test

- Soát toàn bộ từng màn admin sâu (clone khóa, cải tiến khóa) — có thể chia nhiều đợt.
- Kiểm tra tải **cực lớn** (stress test) — thường do kỹ thuật viên.
