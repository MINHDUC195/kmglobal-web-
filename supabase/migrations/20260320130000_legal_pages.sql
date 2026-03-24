-- Điều khoản & chính sách — chỉnh sửa qua Owner API (service role); đọc công khai qua anon.

create table if not exists public.legal_pages (
  slug text primary key check (slug in ('terms-of-service', 'privacy-policy')),
  intro text,
  body text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.legal_pages is 'Nội dung Điều khoản sử dụng & Chính sách bảo mật (hiển thị công khai)';

insert into public.legal_pages (slug, intro, body) values
  (
    'terms-of-service',
    'Văn bản pháp lý điều chỉnh việc sử dụng nền tảng đào tạo ISO/Hệ thống quản lý, bao gồm quyền truy cập học liệu, bảo mật tài khoản và trách nhiệm tuân thủ của học viên.',
    'Nội dung đang được cập nhật. Vui lòng quay lại sau.'
  ),
  (
    'privacy-policy',
    'Chính sách mô tả cách hệ thống thu thập, lưu trữ, xử lý và bảo vệ thông tin học viên trong quá trình học tập các chương trình ISO/Hệ thống quản lý.',
    'Nội dung đang được cập nhật. Vui lòng quay lại sau.'
  )
on conflict (slug) do nothing;

alter table public.legal_pages enable row level security;

create policy "legal_pages_select_public"
  on public.legal_pages
  for select
  to anon, authenticated
  using (true);
