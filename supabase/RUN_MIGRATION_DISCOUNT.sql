-- =============================================================================
-- Chạy trong Supabase → SQL Editor nếu chưa chạy migration 20260321100000_regular_courses_discount.sql
-- Thêm cột discount_percent cho bảng regular_courses (giảm giá theo %)
-- =============================================================================

alter table public.regular_courses
  add column if not exists discount_percent smallint default null
  check (discount_percent is null or (discount_percent >= 1 and discount_percent <= 99));

comment on column public.regular_courses.discount_percent is 'Phần trăm giảm giá (1-99). Null = không giảm.';
