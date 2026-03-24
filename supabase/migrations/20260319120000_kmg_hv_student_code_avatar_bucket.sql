-- Mã học viên: KMG-HV-000001, ... (đã được thay bằng 440311-A000068 trong 20260319130000_restore_440311_student_code.sql)
-- Ảnh đại diện: bucket storage `avatars`

-- 1) Đảm bảo có dòng sequence
insert into public.student_code_sequence (id, val) values (1, 0)
on conflict (id) do nothing;

-- Đồng bộ val với mã KMG-HV đã tồn tại (nếu có)
update public.student_code_sequence
set val = coalesce(
  (
    select max(
      case
        when student_code ~ '^KMG-HV-[0-9]{6}$'
        then substring(student_code from 8)::bigint
      end
    )
    from public.profiles
  ),
  0
)
where id = 1;

-- 2) Hàm cấp mã tiếp theo
create or replace function public.next_student_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  insert into public.student_code_sequence (id, val) values (1, 0)
  on conflict (id) do nothing;

  update public.student_code_sequence
  set val = val + 1
  where id = 1
  returning val into v;

  return 'KMG-HV-' || lpad(v::text, 6, '0');
end;
$$;

-- 3) Gán mã cho học viên chưa có mã (cũ nhất trước)
do $$
declare
  r record;
begin
  for r in
    select id
    from public.profiles
    where role = 'student'
      and (student_code is null or trim(student_code) = '')
    order by created_at asc nulls last, id asc
  loop
    update public.profiles
    set student_code = public.next_student_code()
    where id = r.id;
  end loop;
end;
$$;

-- 4) Trigger đăng ký
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, full_name, email, role, address, company, phone, gender,
    security_signed, security_agreed_at,
    student_code
  )
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'student',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    coalesce((new.raw_user_meta_data->>'security_signed')::boolean, false),
    case
      when new.raw_user_meta_data->>'security_agreed_at' is not null
      then (new.raw_user_meta_data->>'security_agreed_at')::timestamptz
      else null
    end,
    public.next_student_code()
  );
  return new;
end;
$$ language plpgsql security definer;

-- 5) Bucket ảnh đại diện
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
where not exists (select 1 from storage.buckets where id = 'avatars');

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar folder" on storage.objects;
create policy "Users upload own avatar folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
