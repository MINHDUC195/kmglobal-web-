-- Phase 6: Đăng ký khóa học
-- enrollments: user đăng ký regular_course, có thể qua payment

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  regular_course_id uuid references public.regular_courses(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  status text default 'active' check (status in ('active', 'expired', 'cancelled')),
  enrolled_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, regular_course_id)
);

create index if not exists idx_enrollments_user on public.enrollments(user_id);
create index if not exists idx_enrollments_course on public.enrollments(regular_course_id);
create index if not exists idx_enrollments_status on public.enrollments(status) where status = 'active';

-- RLS
alter table public.enrollments enable row level security;

drop policy if exists "Owner admin enrollments" on public.enrollments;
create policy "Owner admin enrollments" on public.enrollments for all
  using (public.is_owner_or_admin());

drop policy if exists "Users read own enrollments" on public.enrollments;
create policy "Users read own enrollments" on public.enrollments for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own enrollments" on public.enrollments;
create policy "Users insert own enrollments" on public.enrollments for insert
  with check (auth.uid() = user_id);
