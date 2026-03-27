# Checklist & kịch bản kiểm thử — Whitelist + Clone regular + Overlap ngày

**Đặc tả tham chiếu:** whitelist (bỏ domain), import Excel, 0đ, một suất/base (hoặc theo spec cuối), trượt → trả phí, clone chỉ nhập ngày, overlap khoảng **đăng ký** và khoảng **khóa** (cùng `base_course_id`), chuẩn hóa `[00:00:00, 23:59:59]` theo timezone hệ thống đã chốt.

**Môi trường:** _ghi rõ (local / UAT / prod)_  

**Tài khoản:** Owner, học viên trong whitelist, học viên ngoài list, tài khoản owner (nếu test loại trừ).

---

## Phần A — Checklist nhanh (Pass / Fail / N/A)

### A1. Import whitelist

- [ ] Import file đúng định dạng cột (email, mật khẩu hoặc flow đặt mật khẩu, mã học viên, tên).
- [ ] Dòng lỗi (email sai, trùng) được báo rõ; không làm hỏng cả đợt (hoặc đúng policy rollback).
- [ ] User tạo ra có role student; không promote admin/owner qua file.
- [ ] Audit log: ai import, khi nào, số dòng thành công/thất bại.
- [ ] File import không lưu vĩnh viễn nếu policy là xóa sau xử lý (khi đã implement).

### A2. Đăng nhập & chính sách

- [ ] Lần đầu đăng nhập: bắt buộc đồng ý điều khoản/chính sách (không bypass).
- [ ] Ghi nhận phiên bản điều khoản đã chấp (nếu có).
- [ ] User ngoài whitelist không được quyền miễn phí whitelist.

### A3. Clone regular & overlap (cùng base)

- [ ] Chỉ nhập ngày; hệ thống gán `00:00:00` và `23:59:59` đúng timezone.
- [ ] Không cho tạo/sửa nếu **khoảng ngày đăng ký** overlap regular khác cùng base.
- [ ] Không cho tạo/sửa nếu **khoảng ngày khóa** overlap regular khác cùng base.
- [ ] Sửa regular (đổi ngày): không tính trùng chính bản ghi đó.

### A4. Miễn phí / suất / trượt

- [ ] Mỗi học viên chỉ **một** lượt miễn phí theo quy tắc đã chốt (per base hoặc per regular — điền đúng spec).
- [ ] Ghi danh tạo payment 0đ + metadata nguồn (whitelist).
- [ ] Sau trượt / hết lượt: lần ghi danh sau yêu cầu **trả phí** bình thường.

### A5. Hóa đơn

- [ ] Xuất hóa đơn / chứng từ cho giao dịch 0đ đúng rule Owner (nếu áp dụng).

### A6. Loại trừ Owner

- [ ] Tài khoản role owner không nhận miễn phí whitelist (nếu đã spec).

### A7. Xóa đợt / chính sách (nếu có)

- [ ] Đã enrolled: học nốt, không bị thu phí hồi tố.
- [ ] Chưa ghi danh: không còn miễn phí theo list; giá hiển thị có phí.

---

## Phần B — Kịch bản chi tiết (Given / When / Then)

### B1. Import — happy path

**Given:** file Excel hợp lệ, 3 học viên mới.  
**When:** Owner import.  
**Then:** 3 user tồn tại; profile đúng mã/tên; có thể đăng nhập (hoặc nhận email đặt mật khẩu — đúng spec).

### B2. Import — email trùng user đã có

**Given:** email đã tồn tại trong hệ thống.  
**When:** import cùng email.  
**Then:** đúng policy (từ chối dòng / gộp / cập nhật profile) + thông báo rõ.

### B3. Đăng nhập — bắt đồng ý điều khoản

**Given:** user vừa import, chưa từng accept terms.  
**When:** đăng nhập lần đầu.  
**Then:** redirect tới màn đồng ý; không vào được học tập cho đến khi accept.

### B4. Clone — không overlap

**Given:** base B đã có regular R1 (đăng ký T1–T2, khóa D1–D2).  
**When:** clone R2 với đăng ký **không** giao T1–T2 và khóa **không** giao D1–D2.  
**Then:** tạo thành công.

### B5. Clone — overlap đăng ký

**Given:** R1 đăng ký 01/06–15/06.  
**When:** tạo R2 đăng ký 10/06–20/06 (cùng base).  
**Then:** lỗi validation; không tạo được.

### B6. Clone — overlap khóa (độc lập đăng ký)

**Given:** R1 khóa 01/07–31/07.  
**When:** tạo R2 khóa 20/07–10/08 (cùng base), đăng ký R2 không overlap R1.  
**Then:** lỗi validation theo **khóa**.

### B7. Whitelist — một suất

**Given:** user trong list, đủ điều kiện miễn phí khóa X.  
**When:** ghi danh lần 1 thành công.  
**Then:** 0đ (hoặc đúng chứng từ).  
**When:** ghi danh lần 2 cùng quy tắc “một suất”.  
**Then:** bị từ chối miễn phí hoặc yêu cầu trả phí (đúng spec).

### B8. Trượt → trả phí

**Given:** đã có enrollment miễn phí; hệ thống ghi nhận **không đạt** (theo định nghĩa).  
**When:** ghi danh lại cùng khóa/base (đúng spec).  
**Then:** checkout giá thường; không áp whitelist.

### B9. Học viên không trong list

**Given:** email không thuộc đợt.  
**When:** ghi danh regular thuộc base đã gắn whitelist.  
**Then:** không miễn phí whitelist; giá/trả phí như thường.

### B10. Owner

**Given:** user role owner, email trong list (nếu test được).  
**When:** thử nhận miễn phí whitelist.  
**Then:** không áp dụng (nếu đã spec).

### B11. Xóa đợt / chính sách (nếu có)

**Given:** user đã có enrollment đang học từ miễn phí list.  
**When:** Owner xóa đợt/policy.  
**Then:** vẫn học được; không phát sinh “đòi trả phí” cho enrollment hiện có.

### B12. Biên ngày & timezone

**Given:** hai khoảng liền kề (không overlap).  
**When:** tạo regular sát biên (ví dụ kết thúc ngày N, bắt đầu ngày N+1).  
**Then:** không báo overlap sai.

---

## Phần C — Dữ liệu test gợi ý

| ID      | Mô tả ngắn                                      |
| ------- | ----------------------------------------------- |
| BC-001  | Base course có ≥2 regular để test overlap       |
| WL-001  | File Excel 1 dòng hợp lệ                        |
| WL-002  | File có 1 dòng lỗi email                       |
| RC-001  | Regular mở đăng ký, đúng ngày                  |

---

## Phần D — Ký xác nhận UAT

| Ngày | Người test | Môi trường | Kết quả tổng thể | Ghi chú |
| ---- | ---------- | ---------- | ---------------- | ------- |
|      |            |            |                  |         |

---

**Lưu ý:** Một số mục phụ thuộc tính năng **chưa triển khai** — đánh **N/A** cho đến khi có build; cập nhật Pass/Fail theo từng sprint.
