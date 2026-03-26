-- Một user không có hai giao dịch pending cùng khóa + cùng cổng (chặn race hai tab checkout).
-- Cột checkout_course_id dùng cho index; đồng bộ từ metadata.course_id cho bản ghi cũ.

alter table public.payments
  add column if not exists checkout_course_id uuid references public.regular_courses (id) on delete set null;

update public.payments p
set checkout_course_id = (p.metadata->>'course_id')::uuid
where p.checkout_course_id is null
  and p.metadata is not null
  and p.metadata ? 'course_id'
  and (p.metadata->>'course_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

create unique index if not exists payments_one_pending_user_course_gateway
  on public.payments (user_id, checkout_course_id, gateway)
  where status = 'pending' and checkout_course_id is not null;

comment on column public.payments.checkout_course_id is 'Khóa học (regular_course) khi tạo checkout; dùng để unique pending per gateway.';
