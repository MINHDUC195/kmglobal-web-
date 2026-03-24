-- Bảng ghi nhận tiến độ học: bài nào đã hoàn thành
-- Dùng cho ProgressBar và điều kiện thi cuối

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.enrollments(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  completed_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(enrollment_id, lesson_id)
);

create index if not exists idx_lesson_progress_enrollment on public.lesson_progress(enrollment_id);
create index if not exists idx_lesson_progress_lesson on public.lesson_progress(lesson_id);

-- RLS
alter table public.lesson_progress enable row level security;

drop policy if exists "Owner admin lesson_progress" on public.lesson_progress;
create policy "Owner admin lesson_progress" on public.lesson_progress for all
  using (public.is_owner_or_admin());

drop policy if exists "Users manage own progress" on public.lesson_progress;
create policy "Users manage own progress" on public.lesson_progress for all
  using (
    exists (
      select 1 from public.enrollments e
      where e.id = enrollment_id and e.user_id = auth.uid()
    )
  );
