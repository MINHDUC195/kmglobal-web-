-- FIX: Lỗi "Database error querying schema" khi đăng nhập admin@kmglobal.net
-- Dùng khi migration 20250112000004 không sửa được

-- ========== BƯỚC 1: Xóa user cũ ==========
-- Chạy đoạn SQL dưới đây trong Supabase SQL Editor:

delete from auth.identities where user_id in (select id from auth.users where email = 'admin@kmglobal.net');
delete from public.profiles where id in (select id from auth.users where email = 'admin@kmglobal.net');
delete from auth.users where email = 'admin@kmglobal.net';

-- ========== BƯỚC 2: Tạo user qua Dashboard ==========
-- Vào: Supabase Dashboard → Authentication → Users → Add user
--   Email: admin@kmglobal.net
--   Password: Nhatminh1609@
--   Tích "Auto Confirm User" để đăng nhập ngay

-- ========== BƯỚC 3: Gán role owner ==========
-- Chạy SAU KHI tạo user ở Bước 2:

update public.profiles
set role = 'owner', full_name = coalesce(full_name, 'KM Global Owner'), security_signed = true
where email = 'admin@kmglobal.net';
