-- Chứng chỉ và Thi cuối khóa
-- 1. final_exam_questions: gắn câu hỏi vào bài thi cuối
-- 2. final_exam_attempts: ghi nhận lần làm bài thi
-- 3. certificates: chứng chỉ khi hoàn thành khóa học đạt ≥70%

-- Bảng gắn câu hỏi vào bài thi cuối
create table if not exists public.final_exam_questions (
  id uuid primary key default gen_random_uuid(),
  final_exam_id uuid not null references public.final_exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  unique(final_exam_id, question_id)
);

create index if not exists idx_final_exam_questions_exam on public.final_exam_questions(final_exam_id);

-- RLS
alter table public.final_exam_questions enable row level security;
drop policy if exists "Owner admin final_exam_questions" on public.final_exam_questions;
create policy "Owner admin final_exam_questions" on public.final_exam_questions for all
  using (public.is_owner_or_admin());

-- Bảng ghi nhận lần làm bài thi cuối
create table if not exists public.final_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  final_exam_id uuid not null references public.final_exams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_points numeric not null default 0,
  max_points numeric not null default 0,
  percent_score numeric not null default 0,
  passed boolean not null default false,
  started_at timestamptz default now(),
  submitted_at timestamptz
);

create index if not exists idx_final_exam_attempts_enrollment on public.final_exam_attempts(enrollment_id);
create index if not exists idx_final_exam_attempts_user on public.final_exam_attempts(user_id);

alter table public.final_exam_attempts enable row level security;
drop policy if exists "Users read own final_exam_attempts" on public.final_exam_attempts;
create policy "Users read own final_exam_attempts" on public.final_exam_attempts for select
  using (auth.uid() = user_id);
drop policy if exists "Users insert own final_exam_attempts" on public.final_exam_attempts;
create policy "Users insert own final_exam_attempts" on public.final_exam_attempts for insert
  with check (auth.uid() = user_id);
drop policy if exists "Owner admin final_exam_attempts" on public.final_exam_attempts;
create policy "Owner admin final_exam_attempts" on public.final_exam_attempts for all
  using (public.is_owner_or_admin());

-- Bảng chứng chỉ
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  regular_course_id uuid not null references public.regular_courses(id) on delete cascade,
  base_course_id uuid not null references public.base_courses(id) on delete cascade,
  final_exam_attempt_id uuid references public.final_exam_attempts(id) on delete set null,
  percent_score numeric not null,
  issued_at timestamptz default now(),
  created_at timestamptz default now()
);

create unique index if not exists idx_certificates_enrollment_unique on public.certificates(enrollment_id);
create index if not exists idx_certificates_code on public.certificates(code);
create index if not exists idx_certificates_user on public.certificates(user_id);

alter table public.certificates enable row level security;
drop policy if exists "Users read own certificates" on public.certificates;
create policy "Users read own certificates" on public.certificates for select
  using (auth.uid() = user_id);
drop policy if exists "Owner admin certificates" on public.certificates;
create policy "Owner admin certificates" on public.certificates for all
  using (public.is_owner_or_admin());

-- Service role inserts certificates (via API)
