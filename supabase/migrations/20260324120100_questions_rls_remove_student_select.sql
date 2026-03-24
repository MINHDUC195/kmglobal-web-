-- Thu hẹp RLS: bỏ đọc rộng bảng questions cho mọi authenticated.
-- Đọc câu hỏi trong LMS qua API server (service role); admin/owner vẫn full quyền qua policy "Owner admin questions".

drop policy if exists "Students read questions" on public.questions;

comment on table public.questions is 'Câu hỏi quiz — client học viên không SELECT trực tiếp; dùng API /api/quiz/*';
