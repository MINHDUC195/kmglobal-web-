-- Đợt whitelist: danh sách học viên + base được miễn phí (không dùng domain).
-- Một user chỉ một lần miễn phí / base (ghi nhận ở whitelist_free_grants).

create table if not exists public.whitelist_cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.whitelist_cohorts is 'Đợt đào tạo / danh sách import; gắn base courses được miễn phí.';

create table if not exists public.whitelist_cohort_base_courses (
  cohort_id uuid not null references public.whitelist_cohorts (id) on delete cascade,
  base_course_id uuid not null references public.base_courses (id) on delete cascade,
  primary key (cohort_id, base_course_id)
);

create table if not exists public.whitelist_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.whitelist_cohorts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  student_code text,
  full_name text,
  created_at timestamptz not null default now(),
  unique (cohort_id, user_id),
  unique (cohort_id, email)
);

create index if not exists idx_whitelist_members_user on public.whitelist_members (user_id);
create index if not exists idx_whitelist_members_cohort on public.whitelist_members (cohort_id);

create table if not exists public.whitelist_free_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  base_course_id uuid not null references public.base_courses (id) on delete cascade,
  cohort_id uuid not null references public.whitelist_cohorts (id) on delete restrict,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, base_course_id)
);

comment on table public.whitelist_free_grants is 'Đã dùng suất miễn phí whitelist cho (user, base_course); một lần duy nhất.';

alter table public.whitelist_cohorts enable row level security;
alter table public.whitelist_cohort_base_courses enable row level security;
alter table public.whitelist_members enable row level security;
alter table public.whitelist_free_grants enable row level security;

-- Không cho client trực tiếp; API dùng service_role.

-- Overlap: cùng base_course_id, đoạn đóng [a,b] — đăng ký và khóa tách kiểm.
create or replace function public.regular_courses_no_date_overlap()
returns trigger
language plpgsql
as $$
declare
  o record;
  reg_new_ok boolean;
  course_new_ok boolean;
begin
  if new.base_course_id is null then
    return new;
  end if;

  reg_new_ok := new.registration_open_at is not null and new.registration_close_at is not null;
  course_new_ok := new.course_start_at is not null and new.course_end_at is not null;

  for o in
    select id, registration_open_at, registration_close_at, course_start_at, course_end_at
    from public.regular_courses
    where base_course_id = new.base_course_id
      and id is distinct from coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    if reg_new_ok
       and o.registration_open_at is not null
       and o.registration_close_at is not null
       and new.registration_open_at <= o.registration_close_at
       and o.registration_open_at <= new.registration_close_at then
      raise exception 'registration_date_overlap'
        using hint = 'Khoảng đăng ký trùng với khóa thường khác cùng base.';
    end if;

    if course_new_ok
       and o.course_start_at is not null
       and o.course_end_at is not null
       and new.course_start_at <= o.course_end_at
       and o.course_start_at <= new.course_end_at then
      raise exception 'course_date_overlap'
        using hint = 'Khoảng ngày khóa trùng với khóa thường khác cùng base.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_regular_courses_no_date_overlap on public.regular_courses;
create trigger trg_regular_courses_no_date_overlap
  before insert or update of base_course_id, registration_open_at, registration_close_at, course_start_at, course_end_at
  on public.regular_courses
  for each row
  execute procedure public.regular_courses_no_date_overlap();
