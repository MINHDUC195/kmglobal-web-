# Kế hoạch B2B Doanh nghiệp (KM Global) — Thực hiện sau

> **Trạng thái:** Lên kế hoạch — chưa triển khai  
> **Cập nhật:** 2026-03

---

## 1. Tổng quan

### 1.1 Mục tiêu

- Doanh nghiệp đăng ký → Owner duyệt → Mua gói chương trình (ISO 9001, IATF, v.v.)
- Mỗi gói: 1 program, số user, thời hạn 2 năm, giá cố định
- Admin KM Global **chỉ định** user vào chương trình (user không tự đăng ký)
- User học và nhận chứng chỉ bình thường, không qua checkout
- Admin doanh nghiệp có trang riêng: thông tin, gói, ghế, báo cáo chi tiết

### 1.2 Luồng chính

```
DN đăng ký → Owner duyệt → Thanh toán gói → Tạo License
    → Admin chỉ định User vào chương trình
    → User học (không checkout) → Hoàn thành → Chứng chỉ

Admin DN: Xem thông tin, gói, ghế, báo cáo đăng nhập + học tập + thời lượng
```

---

## 2. Thiết kế Database

### 2.1 Bảng mới

| Bảng | Mô tả |
|------|-------|
| **organizations** | Doanh nghiệp, status (pending/approved/rejected/suspended) |
| **organization_members** | User thuộc org, role (admin/member) |
| **organization_program_licenses** | Gói: program_id, user_limit, valid_from, valid_to, price |
| **organization_program_assignments** | Gán user vào license (≤ user_limit) |
| **login_sessions** | Phiên đăng nhập: logged_at, logged_out_at, country, total/active/idle seconds |
| **org_user_daily_stats** | Tổng hợp theo ngày (giảm dung lượng, retention) |

### 2.2 Schema tóm tắt

```sql
-- organizations
id, name, code, contact_email, contact_phone, status, approved_at, approved_by, created_at, updated_at

-- organization_members
id, organization_id, user_id, role (admin|member), joined_at

-- organization_program_licenses
id, organization_id, program_id, user_limit, price_cents, valid_from, valid_to, payment_id, status

-- organization_program_assignments
id, license_id, user_id, assigned_by, assigned_at

-- login_sessions (tối ưu dung lượng)
id, user_id, logged_at, logged_out_at, country (char 2), organization_id, total_seconds, active_seconds

-- org_user_daily_stats (aggregation)
id, organization_id, user_id, date, login_count, total_session_sec, active_sec, learning_sec
```

### 2.3 Tối ưu dung lượng

- **Không** bảng `session_activity_pings`: client tính active/idle, gửi 1 request khi kết thúc session
- **Thời lượng học**: thêm cột `time_spent_seconds` vào `user_lesson_progress`
- **Geo**: chỉ lưu `country` (2 ký tự)
- **Retention**: xóa login_sessions > 90 ngày sau khi aggregate

---

## 3. Chức năng

### 3.1 Đăng ký & duyệt

- Form đăng ký DN: `/register/enterprise`
- Owner duyệt: `/owner/organizations`
- Tạo License sau thanh toán

### 3.2 Chỉ định user

- Màn hình chỉ định: Admin chọn org → license → thêm/bỏ user
- Ràng buộc ghế: COUNT(assignments) ≤ user_limit
- Logic enrollment: user có assignment → truy cập regular_course trong program → tạo enrollment không cần payment

### 3.3 Admin doanh nghiệp (`/organization`)

- Thông tin DN, gói đăng ký
- Ghế: tổng, đã dùng, còn lại
- Nhân sự đạt chứng chỉ
- Thời hạn gói

### 3.4 Báo cáo

- Tổng quan tháng: đăng nhập, bài HT, chứng chỉ
- Chi tiết theo user: đăng nhập, bài HT, khóa HT, chứng chỉ, địa điểm (country)
- Thời lượng học, active, idle (client tính, gửi summary khi session kết thúc)
- Drill-down phiên đăng nhập
- Xuất PDF/Excel (tùy chọn)

---

## 4. Kiến trúc: Tách app Enterprise riêng

### 4.1 Lý do

- Ranh giới sản phẩm rõ, điều khoản riêng
- Giới hạn phạm vi sự cố
- Giảm rủi ro pháp lý

### 4.2 Phân công

| App | Domain | Chức năng |
|-----|--------|-----------|
| **kmglobal-web** | kmglobal.net | Học, thanh toán, chứng chỉ, Admin KM |
| **kmglobal-enterprise** | enterprise.kmglobal.net | Đăng ký DN, duyệt, chỉ định, Admin DN, báo cáo |

- **Cùng Supabase** (auth, DB)
- **Một nơi quản lý migration** (kmglobal-web)

### 4.3 Rủi ro kỹ thuật 2 app

| Rủi ro | Giải pháp |
|--------|-----------|
| Migration conflict | Chỉ kmglobal-web có supabase/migrations, enterprise không push |
| Auth/session | Cookie domain `.kmglobal.net` hoặc login độc lập |
| Config sai | Checklist deploy, cùng Supabase project |

---

## 5. Rủi ro pháp lý & giảm thiểu

### 5.1 Tối ưu dữ liệu

- Client tính active/idle → tranh chấp báo cáo: **Disclaimer** trong điều khoản
- Không lưu IP → khó điều tra: **Lưu IP 30 ngày** rồi xóa
- Retention ngắn: **Ghi rõ** trong điều khoản, tùy chọn lưu lâu hơn

### 5.2 PDPA / Quyền riêng tư

- Thông báo thu thập dữ liệu khi gán user
- Đồng ý trước khi truy cập
- Privacy Policy cập nhật theo PDPA

### 5.3 Báo cáo & quyết định nhân sự

- Disclaimer: "Báo cáo mang tính tham khảo, DN tự chịu trách nhiệm quyết định"

### 5.4 Chứng chỉ

- Ghi rõ: "Chứng nhận hoàn thành khóa học trong hệ thống KM Global, không phải chứng nhận chuyên môn từ tổ chức cấp ISO/IATF"

---

## 6. Thứ tự triển khai đề xuất

### Phase 1 — Nền tảng

1. Migration: organizations, organization_members, licenses, assignments
2. Form đăng ký DN, duyệt Owner
3. Màn hình chỉ định user
4. Logic enrollment: bypass checkout khi có assignment

### Phase 2 — Admin doanh nghiệp

5. Trang Admin DN
6. login_sessions + Geo (country)
7. Báo cáo cơ bản

### Phase 3 — Thời lượng & báo cáo nâng cao

8. Cột time_spent_seconds trong user_lesson_progress
9. Client gửi active/idle khi session kết thúc
10. Báo cáo thời lượng học, active, idle

### Phase 4 — Tách app Enterprise

11. Tạo kmglobal-enterprise (Next.js)
12. Di chuyển UI Enterprise sang app mới
13. Cấu hình domain, ToS riêng

### Phase 5 — Cải tiến

14. Xuất PDF/Excel
15. Cảnh báo thời hạn, ghế
16. Mời user qua email

---

## 7. Tài liệu tham khảo

- `.env.example` — biến môi trường
- `docs/PRODUCTION_AND_UAT.md` — UAT, env production
- `supabase/README.md` — migrations
- Cuộc thảo luận trong chat — chi tiết thiết kế
