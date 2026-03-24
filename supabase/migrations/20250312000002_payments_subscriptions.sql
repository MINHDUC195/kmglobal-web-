-- Phase 5: Thanh toán
-- Bảng payments: ghi nhận giao dịch
-- Bảng subscriptions: gói thành viên hàng tháng (optional)

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  amount_cents bigint not null,
  currency text default 'VND',
  gateway text not null check (gateway in ('vnpay', 'momo', 'stripe')),
  gateway_transaction_id text,
  gateway_response jsonb,
  status text default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  plan_code text not null,
  status text default 'active' check (status in ('active', 'cancelled', 'expired')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_payments_gateway_txn on public.payments(gateway, gateway_transaction_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_expires on public.subscriptions(expires_at) where status = 'active';

-- RLS
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "Owner admin payments" on public.payments;
create policy "Owner admin payments" on public.payments for all
  using (public.is_owner_or_admin());

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments" on public.payments for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own payments" on public.payments;
create policy "Users insert own payments" on public.payments for insert
  with check (auth.uid() = user_id);

-- Webhook cập nhật payment dùng service_role (bypass RLS)

drop policy if exists "Owner admin subscriptions" on public.subscriptions;
create policy "Owner admin subscriptions" on public.subscriptions for all
  using (public.is_owner_or_admin());

drop policy if exists "Users read own subscriptions" on public.subscriptions;
create policy "Users read own subscriptions" on public.subscriptions for select
  using (auth.uid() = user_id);
