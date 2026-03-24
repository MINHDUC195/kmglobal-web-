-- Lưu lịch sử cải tiến khóa học (để đếm Rev1, Rev2...)
create table if not exists public.base_course_improvements (
  id uuid primary key default gen_random_uuid(),
  source_base_course_id uuid references public.base_courses(id) on delete set null,
  new_base_course_id uuid references public.base_courses(id) on delete cascade,
  source_program_id uuid references public.programs(id) on delete set null,
  new_program_id uuid references public.programs(id) on delete cascade,
  reason text,
  revision_number int not null,
  created_at timestamptz default now()
);

create index if not exists idx_base_course_improvements_source on public.base_course_improvements(source_base_course_id);
alter table public.base_course_improvements enable row level security;
drop policy if exists "Owner admin base_course_improvements" on public.base_course_improvements;
create policy "Owner admin base_course_improvements" on public.base_course_improvements for all
  using (public.is_owner_or_admin());
