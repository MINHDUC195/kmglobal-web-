-- SECURITY: Không cho phép đổi role qua client/RLS (chỉ service_role).
-- SĐT: cột phone_e164 (E.164) — trùng sau chuẩn hóa đầu số quốc tế; trigger đồng bộ từ phone khi thiếu.

create or replace function public.normalize_phone_e164(p_input text)
returns text
language plpgsql
immutable
as $$
declare
  t text;
  d text;
begin
  if p_input is null then
    return null;
  end if;
  t := trim(p_input);
  if t = '' then
    return null;
  end if;

  -- Quốc tế rõ ràng: + rồi 8–15 chữ số (E.164)
  if left(t, 1) = '+' then
    d := regexp_replace(substr(t, 2), '\D', '', 'g');
    if length(d) >= 8 and length(d) <= 15 then
      return '+' || d;
    end if;
    return null;
  end if;

  d := regexp_replace(t, '\D', '', 'g');
  if d = '' or length(d) > 15 then
    return null;
  end if;

  -- Việt Nam: 0 + 9 chữ số quốc nội (10 ký tự số)
  if length(d) = 10 and left(d, 1) = '0' then
    return '+84' || substr(d, 2);
  end if;

  -- Việt Nam: mã 84 + thuê bao
  if length(d) >= 11 and left(d, 2) = '84' then
    return '+' || d;
  end if;

  -- Việt Nam: 9 chữ số (di động, không có 0 đầu)
  if length(d) = 9 and d ~ '^[3-9]' then
    return '+84' || d;
  end if;

  return null;
end;
$$;

comment on function public.normalize_phone_e164(text) is 'Chuẩn E.164 để so trùng SĐT (VN + dạng +quốc tế).';

-- 1) Khóa cột role đối với mọi thao tác không phải service_role
create or replace function public.profiles_protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if auth.role() is distinct from 'service_role' then
      if new.role is distinct from old.role then
        new.role := old.role;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_role on public.profiles;
create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row
  execute function public.profiles_protect_role();

-- 2) Cột canonical cho ràng buộc duy nhất
alter table public.profiles add column if not exists phone_e164 text;

comment on column public.profiles.phone_e164 is 'Số E.164 (sau chuẩn hóa); dùng để chống trùng SĐT.';

-- 3) Đồng bộ phone_e164 từ phone nếu app chưa gửi (defense in depth)
create or replace function public.profiles_sync_phone_e164()
returns trigger
language plpgsql
as $$
begin
  if new.phone_e164 is null or trim(coalesce(new.phone_e164::text, '')) = '' then
    new.phone_e164 := public.normalize_phone_e164(new.phone);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_phone_e164 on public.profiles;
create trigger trg_profiles_sync_phone_e164
  before insert or update of phone, phone_e164 on public.profiles
  for each row
  execute function public.profiles_sync_phone_e164();

-- 4) Backfill + gỡ trùng (giữ bản ghi cũ nhất theo created_at, id)
update public.profiles
set phone_e164 = public.normalize_phone_e164(phone)
where phone is not null and trim(phone) <> '';

with ranked as (
  select
    id,
    row_number() over (
      partition by phone_e164
      order by created_at asc nulls last, id asc
    ) as rn
  from public.profiles
  where phone_e164 is not null
)
update public.profiles p
set phone = null,
    phone_e164 = null
from ranked r
where p.id = r.id
  and r.rn > 1;

create unique index if not exists profiles_phone_e164_unique
  on public.profiles (phone_e164)
  where phone_e164 is not null;

-- 5) Đăng ký: kiểm tra trùng SĐT trước khi insert profile; gán phone_e164
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_e164 text;
begin
  v_phone := new.raw_user_meta_data->>'phone';
  v_e164 := public.normalize_phone_e164(v_phone);

  if v_e164 is not null and exists (
    select 1 from public.profiles where phone_e164 = v_e164
  ) then
    raise exception 'Số điện thoại đã được sử dụng'
      using errcode = '23505';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    address,
    company,
    phone,
    phone_e164,
    gender,
    security_signed,
    security_agreed_at,
    student_code
  )
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'student',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'company',
    v_phone,
    v_e164,
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
$$;
