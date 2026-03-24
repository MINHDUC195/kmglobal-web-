-- Chạy file này trong Supabase Dashboard → SQL Editor
-- Thêm cột mẫu chứng chỉ và cấu hình tọa độ vào base_courses (nếu chưa có)

ALTER TABLE public.base_courses
  ADD COLUMN IF NOT EXISTS certificate_sample_url text;

ALTER TABLE public.base_courses
  ADD COLUMN IF NOT EXISTS certificate_template_config jsonb DEFAULT '{}';

COMMENT ON COLUMN public.base_courses.certificate_sample_url IS 'URL file PDF/ảnh mẫu chứng chỉ (Supabase Storage hoặc external)';
COMMENT ON COLUMN public.base_courses.certificate_template_config IS 'Tọa độ (x,y,fontSize/width,height) cho các trường nhúng trên chứng chỉ';
