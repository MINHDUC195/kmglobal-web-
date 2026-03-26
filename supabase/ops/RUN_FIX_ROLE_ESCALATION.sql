-- Chạy trong Supabase Dashboard → SQL Editor
-- Sửa lỗ hổng role escalation: không tin role từ client khi đăng ký

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, full_name, email, role, address, company, phone, gender,
    security_signed, security_agreed_at
  )
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'student',  -- LUÔN student, không dùng metadata.role
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    coalesce((new.raw_user_meta_data->>'security_signed')::boolean, false),
    case
      when new.raw_user_meta_data->>'security_agreed_at' is not null
      then (new.raw_user_meta_data->>'security_agreed_at')::timestamptz
      else null
    end
  );
  return new;
end;
$$ language plpgsql security definer;
