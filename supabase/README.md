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

## Tài khoản Owner bootstrap

Migration `20250112000003_seed_owner.sql` tự động tạo tài khoản:
- **Email:** admin@kmglobal.net
- **Password:** lấy từ script/migration bootstrap cũ (không dùng mặc định này cho môi trường thật)
- **Role:** owner

Chạy migration trong Supabase SQL Editor. Nếu user đã tồn tại, chỉ cập nhật role thành owner.
Ngay sau khi bootstrap, hãy đổi mật khẩu owner trong Supabase Dashboard và không chia sẻ mật khẩu qua repo.

## Lưu ý

- Project mới: chạy lần lượt 1 → 2 → 3.
- Project đã có `profiles`: bỏ qua 1, chạy 2 → 3.

## Đề nghị xóa khóa học thường (Admin → Owner)

- **20260320140000_course_deletion_requests.sql** — Bảng `course_deletion_requests` + hàm `approve_course_deletion_request` (phê duyệt xóa an toàn).
- Hoặc chạy một lần: `ops/RUN_MIGRATION_COURSE_DELETION_REQUESTS.sql` trong SQL Editor.

## Khóa chỉnh sửa (Pessimistic Locking)

- **20260320150000_edit_locks.sql** — Bảng `edit_locks` để tránh 2 admin sửa cùng bài học ghi đè lẫn nhau.
- Hoặc chạy một lần: `ops/RUN_MIGRATION_EDIT_LOCKS.sql` trong SQL Editor.

## Giảm giá khóa học

- **20260321100000_regular_courses_discount.sql** — Thêm cột `discount_percent` (1–99%) cho `regular_courses`.
- Hoặc chạy một lần: `ops/RUN_MIGRATION_DISCOUNT.sql` trong SQL Editor.

## RLS bảng `questions` (học viên không SELECT trực tiếp)

- **20260324120100_questions_rls_remove_student_select.sql** — Xóa policy cho phép mọi user đã đăng nhập đọc toàn bộ `questions`; đọc câu hỏi qua API server.
- Hoặc chạy một lần: `ops/RUN_MIGRATION_QUESTIONS_RLS_NARROW.sql` trong SQL Editor.

## Cột `profiles` cho agree-terms và hồ sơ học viên

- **20260325100000_profiles_consent_address_phone_verify.sql** — Thêm `data_sharing_consent_at`, `address_street_number`, `address_street_name`, `address_ward`, `phone_verified_at`. **Bắt buộc** nếu trang `/auth/agree-terms` báo không cập nhật được (thiếu cột trong DB).

- **20260326120000_profile_gate_province.sql** — Thêm `address_province`, `profile_completion_required` (học viên cũ có giá trị `false`, tài khoản mới `true`; gate hồ sơ chỉ áp dụng khi `true`).

## Đăng nhập OAuth + Email

Ứng dụng dùng `/auth/callback` (OAuth Google/Apple/Microsoft) và `/auth/confirm` (xác nhận email) trong luồng auth. Trong **Supabase Dashboard → Authentication → URL configuration**:

- **Site URL:** URL production (ví dụ `https://your-domain.com`) hoặc `http://localhost:3000` khi dev.
- **Redirect URLs:** thêm từng dòng (không thiếu đường dẫn):
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `https://<domain-của-bạn>/auth/callback`
  - `https://<domain-của-bạn>/auth/confirm`

Trong **Authentication → Providers**:

- **Google**: bật provider, cấu hình OAuth Client ID/Secret từ Google Cloud.
- **Apple**: bật provider, cấu hình Service ID / Key từ Apple Developer.
- **Azure (Microsoft)**: bật provider, cấu hình tenant/client từ Microsoft Entra ID.

**Lỗi trình duyệt / JSON `Unsupported provider: provider is not enabled`:** provider tương ứng (ví dụ Google) đang **tắt** trong Dashboard — bật công tắc provider đó và lưu. Trong **Google Cloud Console** (Credentials → OAuth 2.0 Client), **Authorized redirect URIs** phải có `https://<project-ref>.supabase.co/auth/v1/callback` (đúng `project-ref` của project Supabase, không phải URL app Next.js).
- **Email**: giữ đăng nhập email + mật khẩu; có thể bật **Confirm email** nếu cần.

## Cache catalog (Next.js)

- Sau khi admin cập nhật chương trình/khóa học công khai, có thể gọi **POST** `/api/admin/revalidate-catalog` (đã đăng nhập owner/admin) để làm mới tag `catalog` (trang chủ, `/courses`, `/programs/[id]/courses`).

## Dọn payments / hóa đơn sau khi xóa user (Auth)

- **`ops_cleanup_payments_deleted_users.sql`** — Xem và xóa các dòng `payments` có `user_id IS NULL` (user đã xóa trong Auth; cột `invoice_exported_at` nằm trên `payments`). Chạy **SELECT** trước, rồi mới **DELETE** trong SQL Editor.

## Supabase types cho app (TypeScript)

- Sinh file `types/database.generated.ts` bằng:
  - `npm run types:supabase`
- File generated là nguồn sự thật cho `Database`/`Json`; không sửa tay.
- Quy trình an toàn khi đổi schema:
  1. Apply migration DB trước.
  2. Regenerate type (`npm run types:supabase`).
  3. Commit migration + file generated.
  4. Build/check rồi mới deploy app.
