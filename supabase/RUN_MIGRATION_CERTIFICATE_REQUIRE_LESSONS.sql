-- Chạy thủ công trên Supabase SQL Editor nếu chưa apply migration

alter table public.base_courses
  add column if not exists certificate_require_all_lessons_completed boolean not null default true;

comment on column public.base_courses.certificate_require_all_lessons_completed is
  'Yêu cầu hoàn thành tất cả bài học trước khi cấp chứng chỉ (khi đạt điểm thi cuối >= certificate_pass_percent)';
