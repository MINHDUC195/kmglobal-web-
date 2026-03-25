-- Tỉnh/Thành phố; chỉ bắt buộc hoàn tất hồ sơ (gate) với học viên mới — học viên hiện có không bắt buộc cập nhật.

alter table public.profiles add column if not exists address_province text;

alter table public.profiles add column if not exists profile_completion_required boolean;

update public.profiles set profile_completion_required = false where profile_completion_required is null;

alter table public.profiles alter column profile_completion_required set default true;

alter table public.profiles alter column profile_completion_required set not null;

comment on column public.profiles.profile_completion_required is 'true = phải đủ hồ sơ theo quy tắc hiện tại; false = học viên cũ, không chặn bằng gate';
comment on column public.profiles.address_province is 'Tỉnh / Thành phố (địa chỉ chi tiết)';
