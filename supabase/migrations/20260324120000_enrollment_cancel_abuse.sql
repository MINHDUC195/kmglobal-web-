-- Đếm hủy có chủ ý theo (user_id, regular_course_id), khóa abuse, tự tạm khóa 3 ngày

-- Thống kê số lần hủy đăng ký theo từng khóa thường (regular_course)
create table if not exists public.enrollment_cancel_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  regular_course_id uuid not null references public.regular_courses(id) on delete cascade,
  cancel_count int not null default 0 check (cancel_count >= 0),
  updated_at timestamptz default now(),
  primary key (user_id, regular_course_id)
);

create index if not exists idx_enrollment_cancel_stats_user on public.enrollment_cancel_stats(user_id);

alter table public.enrollment_cancel_stats enable row level security;

drop policy if exists "Service role enrollment_cancel_stats" on public.enrollment_cancel_stats;
create policy "Service role enrollment_cancel_stats" on public.enrollment_cancel_stats
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Cột khóa tài khoản (abuse) và tự tạm khóa (3 ngày)
alter table public.profiles add column if not exists account_abuse_locked boolean default false;
alter table public.profiles add column if not exists abuse_locked_at timestamptz;
alter table public.profiles add column if not exists self_temp_lock_until timestamptz;

comment on column public.profiles.account_abuse_locked is 'Khóa do abuse (vd hủy 5 lần chưa thanh toán); chỉ Owner mở qua API service role';
comment on column public.profiles.self_temp_lock_until is 'Học viên tự tạm khóa; hết hạn tự mở (xử lý server)';

-- Chỉ service_role được đổi các cột nhạy cảm (API server dùng admin client)
create or replace function public.profiles_protect_lock_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if auth.role() is distinct from 'service_role' then
      if new.account_abuse_locked is distinct from old.account_abuse_locked then
        new.account_abuse_locked := old.account_abuse_locked;
      end if;
      if new.abuse_locked_at is distinct from old.abuse_locked_at then
        new.abuse_locked_at := old.abuse_locked_at;
      end if;
      if new.self_temp_lock_until is distinct from old.self_temp_lock_until then
        new.self_temp_lock_until := old.self_temp_lock_until;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_lock_fields on public.profiles;
create trigger trg_profiles_protect_lock_fields
  before update on public.profiles
  for each row execute function public.profiles_protect_lock_fields();
