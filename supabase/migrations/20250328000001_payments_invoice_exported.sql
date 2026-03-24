-- Cột đánh dấu đã xuất hóa đơn
alter table public.payments add column if not exists invoice_exported_at timestamptz;
