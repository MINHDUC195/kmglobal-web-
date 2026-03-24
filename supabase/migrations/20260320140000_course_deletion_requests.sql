-- Đề nghị xóa khóa học thường: Admin tạo, Owner phê duyệt. Chỉ xóa khi không có học viên đăng ký.

create table if not exists public.course_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  regular_course_id uuid not null references public.regular_courses (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete set null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.course_deletion_requests is 'Yêu cầu xóa regular_course — truy cập qua API (service role).';

create unique index if not exists course_deletion_requests_one_pending_per_course
  on public.course_deletion_requests (regular_course_id)
  where status = 'pending';

create index if not exists course_deletion_requests_status_created_idx
  on public.course_deletion_requests (status, created_at desc);

alter table public.course_deletion_requests enable row level security;

-- Xóa khóa học khi duyệt; kiểm tra không có enrollment (atomic).
create or replace function public.approve_course_deletion_request (p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_cnt int;
begin
  select regular_course_id into strict v_course_id
  from public.course_deletion_requests
  where id = p_request_id and status = 'pending';

  select count(*)::int into v_cnt
  from public.enrollments
  where regular_course_id = v_course_id;

  if v_cnt > 0 then
    raise exception 'COURSE_HAS_ENROLLMENTS' using errcode = 'P0001';
  end if;

  delete from public.regular_courses where id = v_course_id;
  return v_course_id;
end;
$$;

comment on function public.approve_course_deletion_request (uuid) is
  'Owner duyệt xóa: xóa regular_course nếu không có enrollment; CASCADE xóa request.';

revoke all on function public.approve_course_deletion_request (uuid) from public;
grant execute on function public.approve_course_deletion_request (uuid) to service_role;
