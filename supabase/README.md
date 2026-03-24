# Supabase Migrations

Chạy các file SQL trong thư mục `migrations/` theo thứ tự trong **Supabase Dashboard → SQL Editor**.

## Thứ tự chạy

1. **20250112000000_initial_schema.sql** – Bảng `profiles` (chỉ dùng cho project mới)
2. **20250112000001_profiles_extra_columns.sql** – Thêm cột cho `profiles` (nếu bảng đã tồn tại)
3. **20250112000002_programs_and_courses.sql** – Chương trình, khóa học cơ bản, khóa học thường
4. **20250112000003_seed_owner.sql** – Tạo tài khoản owner admin@kmglobal.net
5. **20250112000004_fix_auth_users_tokens.sql** – Sửa lỗi "Database error querying schema" (chạy nếu đã seed owner trước đó)
6. **20250112000005_questions.sql** – Bảng questions, question_options, question_attempts (Phase 4)

**Nếu vẫn lỗi:** Dùng `supabase/01_fix_owner_login.sql` – xóa user cũ, tạo mới qua Dashboard, rồi chạy Bước 3.

## Tài khoản Owner cứng

Migration `20250112000003_seed_owner.sql` tự động tạo tài khoản:
- **Email:** admin@kmglobal.net
- **Password:** Nhatminh1609@
- **Role:** owner

Chạy migration trong Supabase SQL Editor. Nếu user đã tồn tại, chỉ cập nhật role thành owner.

## Lưu ý

- Project mới: chạy lần lượt 1 → 2 → 3.
- Project đã có `profiles`: bỏ qua 1, chạy 2 → 3.

## Đề nghị xóa khóa học thường (Admin → Owner)

- **20260320140000_course_deletion_requests.sql** — Bảng `course_deletion_requests` + hàm `approve_course_deletion_request` (phê duyệt xóa an toàn).
- Hoặc chạy một lần: `RUN_MIGRATION_COURSE_DELETION_REQUESTS.sql` trong SQL Editor.

## Khóa chỉnh sửa (Pessimistic Locking)

- **20260320150000_edit_locks.sql** — Bảng `edit_locks` để tránh 2 admin sửa cùng bài học ghi đè lẫn nhau.
- Hoặc chạy một lần: `RUN_MIGRATION_EDIT_LOCKS.sql` trong SQL Editor.

## Giảm giá khóa học

- **20260321100000_regular_courses_discount.sql** — Thêm cột `discount_percent` (1–99%) cho `regular_courses`.
- Hoặc chạy một lần: `RUN_MIGRATION_DISCOUNT.sql` trong SQL Editor.

## RLS bảng `questions` (học viên không SELECT trực tiếp)

- **20260324120000_questions_rls_remove_student_select.sql** — Xóa policy cho phép mọi user đã đăng nhập đọc toàn bộ `questions`; đọc câu hỏi qua API server.
- Hoặc chạy một lần: `RUN_MIGRATION_QUESTIONS_RLS_NARROW.sql` trong SQL Editor.

## Cache catalog (Next.js)

- Sau khi admin cập nhật chương trình/khóa học công khai, có thể gọi **POST** `/api/admin/revalidate-catalog` (đã đăng nhập owner/admin) để làm mới tag `catalog` (trang chủ, `/courses`, `/programs/[id]/courses`).
