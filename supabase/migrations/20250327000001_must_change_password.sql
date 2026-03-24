-- Yêu cầu đổi mật khẩu khi đăng nhập lần đầu (admin do owner tạo)
alter table public.profiles add column if not exists must_change_password boolean default false;
