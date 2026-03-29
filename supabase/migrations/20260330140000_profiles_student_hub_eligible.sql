-- Admin được promote từ học viên: được vào /student hub. Admin tạo mới: mặc định false.
alter table public.profiles
  add column if not exists student_hub_eligible boolean not null default false;

comment on column public.profiles.student_hub_eligible is 'True nếu admin được phép dùng khu /student (thường set khi promote từ học viên).';

-- Backfill: admin đã có enrollment (từng là học viên thực tế) → bật hub.
update public.profiles p
set student_hub_eligible = true
where p.role = 'admin'
  and exists (select 1 from public.enrollments e where e.user_id = p.id);
