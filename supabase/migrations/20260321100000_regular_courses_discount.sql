-- Giảm giá khóa học (%)
alter table public.regular_courses
  add column if not exists discount_percent smallint default null
  check (discount_percent is null or (discount_percent >= 1 and discount_percent <= 99));

comment on column public.regular_courses.discount_percent is 'Phần trăm giảm giá (1-99). Null = không giảm.';
