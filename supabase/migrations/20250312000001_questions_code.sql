-- Thêm cột mã thứ tự (code) vào questions để quản lý
alter table public.questions
  add column if not exists code text;

create index if not exists idx_questions_code on public.questions(code) where code is not null;

comment on column public.questions.code is 'Mã thứ tự do Admin gán, VD: Q001, CH1-01';
