-- Thêm cột cho admin: CCCD, quyền soạn nội dung chương trình đào tạo
alter table public.profiles add column if not exists id_card text;
alter table public.profiles add column if not exists can_edit_content boolean default false;
