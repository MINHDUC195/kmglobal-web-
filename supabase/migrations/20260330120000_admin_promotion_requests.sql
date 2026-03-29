-- Yêu cầu nâng học viên lên admin: token qua email, dùng một lần, có hạn.
create table if not exists public.admin_promotion_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_user_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_promotion_requests_token_hash_unique unique (token_hash)
);

create index if not exists admin_promotion_requests_pending_candidate_idx
  on public.admin_promotion_requests (candidate_user_id)
  where consumed_at is null;

create index if not exists admin_promotion_requests_expires_idx
  on public.admin_promotion_requests (expires_at)
  where consumed_at is null;

comment on table public.admin_promotion_requests is 'Owner-initiated admin promotion; confirm via email token (service role only).';

alter table public.admin_promotion_requests enable row level security;
