-- Sửa lỗi "Database error querying schema" khi đăng nhập user tạo bằng SQL
-- Các cột token phải là chuỗi rỗng, không được NULL
-- Chạy trong Supabase SQL Editor

do $$
begin
  update auth.users set confirmation_token = coalesce(confirmation_token, '') where email = 'admin@kmglobal.net' and confirmation_token is null;
exception when undefined_column then null;
end $$;
do $$
begin
  update auth.users set recovery_token = coalesce(recovery_token, '') where email = 'admin@kmglobal.net' and recovery_token is null;
exception when undefined_column then null;
end $$;
do $$
begin
  update auth.users set email_change = coalesce(email_change, '') where email = 'admin@kmglobal.net' and email_change is null;
exception when undefined_column then null;
end $$;
do $$
begin
  update auth.users set email_change_token_new = coalesce(email_change_token_new, '') where email = 'admin@kmglobal.net' and email_change_token_new is null;
exception when undefined_column then null;
end $$;
do $$
begin
  update auth.users set email_change_token_current = coalesce(email_change_token_current, '') where email = 'admin@kmglobal.net' and email_change_token_current is null;
exception when undefined_column then null;
end $$;
