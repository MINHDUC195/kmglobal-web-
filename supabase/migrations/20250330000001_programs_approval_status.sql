-- Trạng thái phê duyệt chương trình: draft (đang phát triển), pending (chờ phê duyệt), approved (đã phê duyệt)
alter table public.programs add column if not exists approval_status text default 'draft' check (approval_status in ('draft', 'pending', 'approved'));
