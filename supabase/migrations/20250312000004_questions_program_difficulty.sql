-- Thêm cột chương trình và độ khó để phân loại câu hỏi
alter table public.questions
  add column if not exists program_id uuid references public.programs(id) on delete set null,
  add column if not exists difficulty_level text;

create index if not exists idx_questions_program on public.questions(program_id) where program_id is not null;
create index if not exists idx_questions_difficulty on public.questions(difficulty_level) where difficulty_level is not null;

comment on column public.questions.program_id is 'Chương trình học chứa câu hỏi';
comment on column public.questions.difficulty_level is 'Độ khó: dễ, trung bình, khó';
