# KM Global Academy – Báo cáo trạng thái dự án

**Cập nhật:** 19/03/2026  
**Công nghệ:** Next.js 16, TypeScript, Tailwind CSS, Supabase, Bunny.net

---

## Tổng quan

| Trạng thái | Mô tả |
|------------|-------|
| **MVP** | ~90% hoàn thành |
| **Sản xuất** | Gần sẵn sàng (UAT thanh toán, env production, tùy chọn QR/template chứng chỉ) |

---

## Đã hoàn thành

### 1. Landing & Marketing
- [x] Trang chủ với Hero, About, Khóa học, Quy trình
- [x] Thiết kế màu Gold (#D4AF37) + Đen/Trắng
- [x] Nav, Footer, Logo
- [x] Trang điều khoản, chính sách bảo mật

### 2. Xác thực (Auth)
- [x] Đăng ký / Đăng nhập (Supabase Auth)
- [x] Xác nhận email (`/auth/confirm`)
- [x] Check email (`/auth/check-email`)
- [x] Phân quyền: `student` | `admin` | `owner`
- [x] Security agreement cho user mới

### 3. Khóa học (Courses)
- [x] Trang danh sách khóa học `/courses` (lấy từ DB)
- [x] Trang chi tiết `/courses/[id]`
- [x] Schema: Programs → Base Courses → Regular Courses
- [x] Chapters, Lessons (video_url, document_url)

### 4. Thanh toán (Payments)
- [x] Checkout `/checkout?courseId=...`
- [x] VNPay: init, return URL, webhook
- [x] Momo: webhook
- [x] Stripe: webhook (có lib, cần test UAT)
- [x] Success/Cancel/Failed pages
- [x] Enrollments (đăng ký sau khi thanh toán)

### 5. Học (Learn)
- [x] Dashboard học viên `/student`
- [x] Trang khóa học `/learn/[enrollmentId]` (chapters, lessons)
- [x] Trang bài học `/learn/preview/[lessonId]` (hỗ trợ `?enrollmentId=` để ghi tiến độ)
- [x] Video Bunny.net (signed URL)
- [x] PDF viewer với watermark động
- [x] Ghi nhận tiến độ (lesson_progress)
- [x] Quiz: Single choice, Multiple choice, Fill blank

### 6. Admin
- [x] Dashboard Admin `/admin`
- [x] Chương trình (Programs): CRUD
- [x] Khóa học cơ bản (Base courses): CRUD
- [x] Khóa học thường (Regular courses): CRUD
- [x] Chỉnh sửa bài học (Lessons): video, PDF, quiz
- [x] Thư viện câu hỏi (Question library)
- [x] Quản lý bài thi cuối (`/admin/base-courses/[id]/final-exam`): gắn câu hỏi từ thư viện

### 7. Owner
- [x] Trang Owner `/owner`

---

## Chưa hoàn thành / Cần bổ sung

### 1. Xác minh chứng chỉ (`/verify`)
- [x] Trang `/verify` tra cứu theo mã chứng chỉ (`?code=...`)
- [x] API `GET /api/verify/certificate?code=...` hiển thị thông tin chứng chỉ
- [ ] Mã QR xác thực (tùy chọn)

### 2. Thi cuối khóa (Final Exam)
- [x] UI thi cuối `/learn/exam/[enrollmentId]`
- [x] Logic tính điểm tổng hợp (chapter + final exam)
- [x] Điều kiện cấp chứng chỉ (≥70%)
- [x] Admin gắn câu hỏi vào bài thi từ thư viện

### 3. Chứng chỉ (Certificates)
- [x] Schema bảng `certificates` (migration `20250324000001`)
- [x] Phát chứng chỉ khi đạt ≥70% bài thi cuối
- [x] Mã chứng chỉ `KM-` + 12 ký tự hex
- [ ] Template chứng chỉ (PDF/HTML) – có thể bổ sung sau

---

## Cấu trúc Database (Supabase)

Danh sách đầy đủ: thư mục [`supabase/migrations`](supabase/migrations). Hướng dẫn chạy / migration gần đây: [`supabase/README.md`](supabase/README.md).

### Migration cốt lõi (ban đầu)

| Migration | Nội dung |
|-----------|----------|
| `20250112000000` | profiles, auth trigger |
| `20250112000001` | profiles extra columns |
| `20250112000002` | programs, base_courses, regular_courses, chapters, lessons, homework, final_exams |
| `20250112000003` | seed owner |
| `20250112000004` | fix auth tokens |
| `20250112000005` | questions |
| `20250312000001` | questions_code |
| `20250312000002` | payments, subscriptions |
| `20250312000003` | enrollments |
| `20250312000004` | questions_program_difficulty |
| `20250322000001` | lesson_progress |
| `20250323000001` | handle_new_user_security |
| `20250324000001` | certificates, final_exam_questions, final_exam_attempts |

### Bổ sung (chọn lọc – đã có trong repo)

| Chủ đề | File migration (ví dụ) |
|--------|-------------------------|
| Chứng chỉ / điều kiện đạt / mẫu PDF | `20250331000001` … `20250338000001`, `20260319200000`, `20260320110000` |
| Programs phê duyệt, visibility khóa theo ngày | `20250330000001`, `20250332000001` |
| Admin/Owner, invoice, student code, avatar | `20250325000001` … `20250329000001`, `20260319120000` … |
| Giảm giá `regular_courses` | `20260321100000_regular_courses_discount` |
| RLS `questions` (học viên không SELECT trực tiếp) | `20260324120100_questions_rls_remove_student_select` |
| Xóa khóa (Owner), edit locks, audit, legal pages | `20260320140000`, `20260320150000`, `20260319140000`, `20260320130000` |

**Lưu ý:** Môi trường production cần **đã apply** toàn bộ migration tương ứng với code hiện tại (bao gồm discount, RLS questions, v.v.).

---

## API Routes

| Route | Chức năng |
|-------|-----------|
| `/api/bunny/signed-url` | Signed URL cho Bunny video |
| `/api/checkout/init` | Khởi tạo thanh toán VNPay/Momo/Stripe |
| `/api/checkout/return/vnpay` | Xử lý return VNPay |
| `/api/courses/[id]` | Chi tiết khóa học |
| `/api/learn/progress` | Ghi nhận tiến độ bài học |
| `/api/lessons/[id]` | Chi tiết bài học |
| `/api/pdf/watermark` | PDF với watermark động |
| `/api/quiz/questions` | Lấy câu hỏi (lesson/chapter/final exam) |
| `/api/quiz/submit` | Nộp câu trả lời |
| `/api/quiz/final-exam/submit` | Nộp bài thi cuối, chấm điểm, cấp chứng chỉ |
| `/api/verify/certificate` | Tra cứu chứng chỉ (công khai) |
| `/api/admin/revalidate-catalog` | Làm mới cache catalog (owner/admin) – sau khi sửa dữ liệu công khai |
| `/api/admin/final-exam/questions` | CRUD câu hỏi bài thi cuối |
| `/api/admin/question-library/list` | Danh sách câu hỏi cho admin |
| `/api/register/profile` | Cập nhật profile |
| `/api/student/enrollments` | Danh sách enrollment |
| `/api/webhook/momo` | Webhook Momo |
| `/api/webhook/stripe` | Webhook Stripe |

---

## Cache catalog (trang công khai)

- Catalog (trang chủ, `/courses`, …) dùng Next.js `unstable_cache` với tag `catalog`, TTL ~120 giây (`lib/cached-catalog.ts`).
- Sau khi admin cập nhật dữ liệu: gọi **POST** `/api/admin/revalidate-catalog` (đã đăng nhập owner/admin), hoặc đợi TTL.

---

## Việc cần làm tiếp theo (ưu tiên)

1. **Production / UAT:** Hướng dẫn chi tiết: [`docs/PRODUCTION_AND_UAT.md`](docs/PRODUCTION_AND_UAT.md) — `NEXT_PUBLIC_SITE_URL`, Upstash khi scale, URL webhook/return thanh toán, checklist UAT.
2. **Kiểm tra env:** `npm run check:env` (thêm `-- --require-payments --warn-redis` khi cần).
3. **Tùy chọn:** Template chứng chỉ PDF/HTML; mã QR `/verify`; mở rộng test tự động.

---

## Chạy dự án

```bash
npm install
npm run dev
```

Cần cấu hình `.env.local` (mẫu: [`.env.example`](.env.example)).
