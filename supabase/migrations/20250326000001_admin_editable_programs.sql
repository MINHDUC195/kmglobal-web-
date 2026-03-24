-- Bảng phân quyền admin được soạn nội dung theo chương trình
-- Admin có thể được gán 0 hoặc nhiều chương trình để soạn thảo

create table if not exists public.admin_editable_programs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  primary key (user_id, program_id)
);

create index if not exists idx_admin_editable_programs_user on public.admin_editable_programs(user_id);

alter table public.admin_editable_programs enable row level security;
drop policy if exists "Owner admin manage admin_editable_programs" on public.admin_editable_programs;
create policy "Owner admin manage admin_editable_programs" on public.admin_editable_programs for all
  using (public.is_owner_or_admin());
