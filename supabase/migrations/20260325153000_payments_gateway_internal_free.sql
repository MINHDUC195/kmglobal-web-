-- Cho phép payment nội bộ cho khóa miễn phí (0đ) để thống nhất báo cáo/invoice.

alter table public.payments
  drop constraint if exists payments_gateway_check;

alter table public.payments
  add constraint payments_gateway_check
  check (gateway in ('vnpay', 'momo', 'stripe', 'internal_free'));
