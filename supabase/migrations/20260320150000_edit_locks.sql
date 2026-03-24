-- Pessimistic locking: khóa khi mở form sửa lesson/chapter (tránh ghi đè)
create table if not exists public.edit_locks (
  resource_type text not null check (resource_type in ('lesson', 'chapter')),
  resource_id uuid not null,
  locked_by uuid not null references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (resource_type, resource_id)
);

create index if not exists edit_locks_expires_at_idx on public.edit_locks(expires_at);

comment on table public.edit_locks is 'Khóa bi quan: một người giữ lock khi đang sửa lesson/chapter';

alter table public.edit_locks enable row level security;

create policy "edit_locks_admin_select"
  on public.edit_locks for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner')
    )
  );

create policy "edit_locks_admin_all"
  on public.edit_locks for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner')
    )
  );
