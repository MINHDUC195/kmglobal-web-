-- Thêm cột mẫu chứng chỉ cho khóa học cơ bản
alter table public.base_courses
  add column if not exists certificate_sample_url text;

comment on column public.base_courses.certificate_sample_url is 'URL file PDF/ảnh mẫu chứng chỉ (Supabase Storage hoặc external)';
