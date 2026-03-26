-- Miễn phí theo domain tổ chức: policy → base_course, quota cố định (không thu hồi suất),
-- phương án A: hết hạn nếu chưa dùng trước unused_expiry_deadline; gia hạn / thu hồi sớm do Owner.

create table if not exists public.org_domain_policies (
  id uuid primary key default gen_random_uuid(),
  email_domain text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended')),
  max_users int not null check (max_users > 0),
  unused_expiry_years int not null default 3 check (unused_expiry_years > 0 and unused_expiry_years <= 50),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_domain)
);

comment on table public.org_domain_policies is 'Whitelist domain email + quota; Owner chọn base_course miễn phí.';

create table if not exists public.org_domain_policy_base_courses (
  policy_id uuid not null references public.org_domain_policies (id) on delete cascade,
  base_course_id uuid not null references public.base_courses (id) on delete cascade,
  primary key (policy_id, base_course_id)
);

comment on table public.org_domain_policy_base_courses is 'Khóa cơ bản được miễn phí theo policy (mọi regular_course cùng base).';

create table if not exists public.org_domain_entitlements (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.org_domain_policies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  first_used_at timestamptz,
  unused_expiry_deadline timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (policy_id, user_id)
);

create index if not exists idx_org_domain_entitlements_policy on public.org_domain_entitlements (policy_id);
create index if not exists idx_org_domain_entitlements_user on public.org_domain_entitlements (user_id);

comment on column public.org_domain_entitlements.first_used_at is 'Lần đầu kích hoạt miễn phí (enroll/checkout); nếu null quá unused_expiry_deadline thì hết hạn.';
comment on column public.org_domain_entitlements.unused_expiry_deadline is 'Owner có thể gia hạn chỉnh tay.';

alter table public.org_domain_policies enable row level security;
alter table public.org_domain_policy_base_courses enable row level security;
alter table public.org_domain_entitlements enable row level security;

-- Chỉ backend (service_role); client dùng anon không truy cập trực tiếp.
