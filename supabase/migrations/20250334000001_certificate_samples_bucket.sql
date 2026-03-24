-- Bucket lưu mẫu chứng chỉ (PDF / ảnh) cho từng khóa cơ bản
-- Path: {base_course_id}/sample.pdf hoặc sample.png
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'certificate-samples',
  'certificate-samples',
  true,
  5242880,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']::text[]
where not exists (select 1 from storage.buckets where id = 'certificate-samples');
