-- Thêm cột cho profiles (nếu đã có bảng từ trước)
-- Chạy nếu bảng profiles đã tồn tại nhưng thiếu các cột sau

alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists company text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists security_agreed_at timestamptz;

-- Ràng buộc gender (chỉ áp dụng nếu chưa có)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_gender_check'
  ) then
    alter table public.profiles add constraint profiles_gender_check
      check (gender is null or gender in ('male', 'female', 'other'));
  end if;
end $$;
