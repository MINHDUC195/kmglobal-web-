-- promotion_tiers: [{"slots":50,"discount_percent":50},...,{"slots":null,"discount_percent":20}]
-- Phần tử cuối: slots null = đợt không giới hạn suất. Khi JSON hợp lệ, giá ưu đãi chỉ theo tier (bỏ qua discount_percent).
alter table public.regular_courses
  add column if not exists promotion_tiers jsonb null;

comment on column public.regular_courses.promotion_tiers is
  'JSON: các đợt có suất + đợt cuối {slots:null,discount_percent}. Đếm theo enrollments active; đồng bộ active_enrollment_count.';

alter table public.regular_courses
  add column if not exists active_enrollment_count integer not null default 0;

comment on column public.regular_courses.active_enrollment_count is
  'Số enrollment status=active; trigger cập nhật; hiển thị landing + tính tier.';

update public.regular_courses rc
set active_enrollment_count = coalesce(
  (
    select count(*)::integer
    from public.enrollments e
    where e.regular_course_id = rc.id
      and e.status = 'active'
  ),
  0
);

create or replace function public.sync_regular_course_active_enrollment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta_old integer := 0;
  delta_new integer := 0;
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' and new.regular_course_id is not null then
      update public.regular_courses
      set active_enrollment_count = active_enrollment_count + 1
      where id = new.regular_course_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'active' and old.regular_course_id is not null then
      update public.regular_courses
      set active_enrollment_count = greatest(0, active_enrollment_count - 1)
      where id = old.regular_course_id;
    end if;
    return old;
  end if;

  if old.regular_course_id is distinct from new.regular_course_id then
    if old.status = 'active' and old.regular_course_id is not null then
      update public.regular_courses
      set active_enrollment_count = greatest(0, active_enrollment_count - 1)
      where id = old.regular_course_id;
    end if;
    if new.status = 'active' and new.regular_course_id is not null then
      update public.regular_courses
      set active_enrollment_count = active_enrollment_count + 1
      where id = new.regular_course_id;
    end if;
    return new;
  end if;

  if old.status = 'active' and new.status is distinct from 'active' then
    delta_old := -1;
  end if;
  if old.status is distinct from 'active' and new.status = 'active' then
    delta_new := 1;
  end if;

  if (delta_old + delta_new) <> 0 and new.regular_course_id is not null then
    update public.regular_courses
    set active_enrollment_count = greatest(0, active_enrollment_count + delta_old + delta_new)
    where id = new.regular_course_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enrollments_sync_active_count on public.enrollments;
create trigger trg_enrollments_sync_active_count
  after insert or update or delete on public.enrollments
  for each row
  execute function public.sync_regular_course_active_enrollment_count();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'regular_courses'
  ) then
    alter publication supabase_realtime add table public.regular_courses;
  end if;
end $$;
