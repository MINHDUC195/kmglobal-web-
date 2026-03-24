-- Chạy file này trong Supabase Dashboard → SQL Editor
-- Thêm cột điểm pass chứng chỉ vào base_courses (nếu chưa có)

ALTER TABLE public.base_courses
  ADD COLUMN IF NOT EXISTS certificate_pass_percent numeric DEFAULT 70;

COMMENT ON COLUMN public.base_courses.certificate_pass_percent IS 'Điểm tối thiểu (%) để cấp chứng chỉ (mặc định 70)';
