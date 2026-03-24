-- Điểm tối thiểu (%) để cấp chứng chỉ khi hoàn thành bài thi cuối khóa
alter table public.base_courses
  add column if not exists certificate_pass_percent numeric default 70;

comment on column public.base_courses.certificate_pass_percent is 'Điểm tối thiểu (%) để cấp chứng chỉ (mặc định 70)';
