-- Đồng ý dữ liệu OAuth (agree-terms), địa chỉ chi tiết và xác thực SĐT (hồ sơ học viên)

alter table public.profiles add column if not exists data_sharing_consent_at timestamptz;

alter table public.profiles add column if not exists address_street_number text;
alter table public.profiles add column if not exists address_street_name text;
alter table public.profiles add column if not exists address_ward text;
alter table public.profiles add column if not exists phone_verified_at timestamptz;

comment on column public.profiles.data_sharing_consent_at is 'Đồng ý xử lý dữ liệu bên thứ ba / điều khoản (agree-terms, đăng ký)';
comment on column public.profiles.phone_verified_at is 'Thời điểm xác thực SĐT (OTP)';
