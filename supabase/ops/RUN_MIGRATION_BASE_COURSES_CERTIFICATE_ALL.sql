-- =============================================================================
-- Chạy MỘT LẦN trong Supabase → SQL Editor (Primary Database) nếu thiếu cột chứng chỉ
-- Sửa lỗi: column "certificate_pass_percent" does not exist (và các cột liên quan)
-- =============================================================================

-- 1) Ngưỡng % để cấp chứng chỉ (điểm tổng khóa: quá trình + thi cuối theo trọng số)
alter table public.base_courses
  add column if not exists certificate_pass_percent numeric default 70;

comment on column public.base_courses.certificate_pass_percent is
  'Ngưỡng điểm tổng khóa học (%) để cấp chứng chỉ — cộng có trọng số: quá trình (bài học/quiz) + bài thi cuối';

-- 2) Cột tùy chọn (legacy; form admin có thể gửi false)
alter table public.base_courses
  add column if not exists certificate_require_all_lessons_completed boolean not null default true;

comment on column public.base_courses.certificate_require_all_lessons_completed is
  'Yêu cầu hoàn thành tất cả bài học trước khi cấp chứng chỉ (logic hiện tại có thể không dùng)';
