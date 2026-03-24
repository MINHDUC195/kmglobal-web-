-- Cấu hình vị trí thông tin nhúng trên mẫu chứng chỉ (tọa độ PDF)
-- fullName, studentCode, avatar, issueDate, certificateCode
alter table public.base_courses
  add column if not exists certificate_template_config jsonb default '{}';

comment on column public.base_courses.certificate_template_config is 'Tọa độ (x,y,fontSize/width,height) cho các trường nhúng: fullName, studentCode, avatar, issueDate, certificateCode';
