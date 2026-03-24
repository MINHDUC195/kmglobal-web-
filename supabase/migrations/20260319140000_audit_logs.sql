-- Nhật ký thao tác nhạy cảm (ghi từ server qua service role)

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb default '{}'::jsonb
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);

comment on table public.audit_logs is 'Audit trail — insert chỉ từ backend (service role).';

alter table public.audit_logs enable row level security;
