-- Cập nhật trigger tạo profile: thêm security_signed, security_agreed_at từ metadata
-- Khi bật "Confirm email", signUp không có session → API /register/profile không chạy được
-- Trigger chạy server-side khi insert auth.users, tạo profile đầy đủ

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
    coalesce(new.raw_user_meta_data->>'role', 'student'),
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
