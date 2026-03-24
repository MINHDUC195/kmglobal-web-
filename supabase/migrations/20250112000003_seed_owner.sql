-- Tài khoản owner cứng: admin@kmglobal.net / Nhatminh1609@
-- Chạy trong Supabase SQL Editor
-- CẢNH BÁO: Mật khẩu nằm trong migration. Đổi mật khẩu sau khi triển khai production.

create extension if not exists "pgcrypto";

do $$
declare
  v_user_id uuid;
  v_email text := 'admin@kmglobal.net';
  v_encrypted_pw text := extensions.crypt('Nhatminh1609@', extensions.gen_salt('bf'));
begin
  -- Chỉ tạo nếu chưa tồn tại
  select id into v_user_id from auth.users where email = v_email limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"owner","full_name":"KM Global Owner"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id, v_email)::jsonb,
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  else
    -- User đã tồn tại: cập nhật profile thành owner
    update public.profiles
    set role = 'owner', full_name = coalesce(full_name, 'KM Global Owner')
    where id = v_user_id;
  end if;
end $$;
