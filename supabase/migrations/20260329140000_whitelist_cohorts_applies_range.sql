-- Khoảng thời gian áp dụng đợt whitelist (hiển thị Owner + kiểm tra khi miễn phí).

alter table public.whitelist_cohorts
  add column if not exists applies_from timestamptz,
  add column if not exists applies_until timestamptz;

comment on column public.whitelist_cohorts.applies_from is 'Bắt đầu áp dụng (null = không giới hạn đầu).';
comment on column public.whitelist_cohorts.applies_until is 'Kết thúc áp dụng (null = không giới hạn cuối).';
