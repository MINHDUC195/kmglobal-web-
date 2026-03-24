-- KM Global Academy - Initial schema
-- Chạy trong Supabase SQL Editor (project mới hoặc reset)

-- Bảng profiles (đồng bộ với auth.users)
-- Cột: họ tên, địa chỉ, công ty, SĐT, giới tính, ảnh (theo tài liệu thiết kế)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'student' check (role in ('owner', 'admin', 'student')),
  address text,
  company text,
  phone text,
  gender text check (gender in ('male', 'female', 'other')),
  avatar_url text,
  last_ip text,
  last_session_id text,
  security_signed boolean default false,
  security_agreed_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger tạo profile khi đăng ký
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, address, company, phone, gender)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
