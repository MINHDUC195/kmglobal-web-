-- Phase 4: Hệ thống câu hỏi
-- Không lưu correct_answer ở frontend - chỉ chấm server-side

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  type text not null check (type in ('single_choice', 'multiple_choice', 'fill_blank')),
  points numeric default 1,
  max_attempts int default 1 check (max_attempts in (1, 2, 3)),
  lesson_id uuid references public.lessons(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  option_text text not null,
  sort_order int default 0,
  is_correct boolean default false,
  created_at timestamptz default now()
);

-- Bảng ghi nhận câu trả lời (để chấm và giới hạn số lần)
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  selected_option_ids uuid[],
  fill_blank_answer text,
  is_correct boolean,
  points_earned numeric,
  created_at timestamptz default now()
);

create index if not exists idx_questions_lesson on public.questions(lesson_id);
create index if not exists idx_questions_chapter on public.questions(chapter_id);
create index if not exists idx_questions_type on public.questions(type);
create index if not exists idx_question_options_question on public.question_options(question_id);
create index if not exists idx_question_attempts_user_question on public.question_attempts(question_id, user_id);

-- RLS
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_attempts enable row level security;

drop policy if exists "Owner admin questions" on public.questions;
create policy "Owner admin questions" on public.questions for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin question_options" on public.question_options;
create policy "Owner admin question_options" on public.question_options for all
  using (public.is_owner_or_admin());

drop policy if exists "Students read questions" on public.questions;
create policy "Students read questions" on public.questions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Students insert own attempts" on public.question_attempts;
create policy "Students insert own attempts" on public.question_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students read own attempts" on public.question_attempts;
create policy "Students read own attempts" on public.question_attempts for select
  using (auth.uid() = user_id);
