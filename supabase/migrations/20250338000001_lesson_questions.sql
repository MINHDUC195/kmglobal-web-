-- Q&A bài học: học viên đặt câu hỏi, admin trả lời
-- RLS: student insert khi có enrollment; student select chỉ câu hỏi của mình; admin full access

create table if not exists public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lesson_question_replies (
  id uuid primary key default gen_random_uuid(),
  lesson_question_id uuid not null references public.lesson_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_lesson_questions_lesson on public.lesson_questions(lesson_id);
create index if not exists idx_lesson_questions_user on public.lesson_questions(user_id);
create index if not exists idx_lesson_questions_status on public.lesson_questions(status);
create index if not exists idx_lesson_question_replies_question on public.lesson_question_replies(lesson_question_id);

-- RLS
alter table public.lesson_questions enable row level security;
alter table public.lesson_question_replies enable row level security;

-- Admin: full access
drop policy if exists "Owner admin lesson_questions" on public.lesson_questions;
create policy "Owner admin lesson_questions" on public.lesson_questions for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin lesson_question_replies" on public.lesson_question_replies;
create policy "Owner admin lesson_question_replies" on public.lesson_question_replies for all
  using (public.is_owner_or_admin());

-- Student: insert own question (enrollment check done in API)
drop policy if exists "Students insert own lesson_questions" on public.lesson_questions;
create policy "Students insert own lesson_questions" on public.lesson_questions for insert
  with check (auth.uid() = user_id);

-- Student: select only own questions
drop policy if exists "Students select own lesson_questions" on public.lesson_questions;
create policy "Students select own lesson_questions" on public.lesson_questions for select
  using (auth.uid() = user_id);

-- Student: select replies for own questions (via join in API; RLS on replies)
drop policy if exists "Students select replies for own questions" on public.lesson_question_replies;
create policy "Students select replies for own questions" on public.lesson_question_replies for select
  using (
    exists (
      select 1 from public.lesson_questions lq
      where lq.id = lesson_question_id and lq.user_id = auth.uid()
    )
  );
