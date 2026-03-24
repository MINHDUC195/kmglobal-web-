-- Khóa chỉnh sửa % giảm giá sau khi khóa clone (regular) đã tạo — tránh lệch giá / double yêu cầu thanh toán
alter table public.regular_courses
  add column if not exists discount_percent_locked boolean not null default false;

comment on column public.regular_courses.discount_percent_locked is 'True: discount_percent không đổi qua UI (đã khóa khi nhân bản).';

-- Khóa sẵn mọi khóa đã gắn base_course_id (phiên bản clone từ khóa cơ bản)
update public.regular_courses
set discount_percent_locked = true
where base_course_id is not null;

create or replace function public.regular_courses_preserve_discount_when_locked()
returns trigger
language plpgsql
as $$
begin
  if coalesce(old.discount_percent_locked, false) = true then
    new.discount_percent := old.discount_percent;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_regular_courses_preserve_discount on public.regular_courses;
create trigger trg_regular_courses_preserve_discount
  before update on public.regular_courses
  for each row
  execute procedure public.regular_courses_preserve_discount_when_locked();
