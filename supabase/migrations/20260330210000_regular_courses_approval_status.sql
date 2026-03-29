-- Phê duyệt hiển thị khóa học thường (giống programs): chỉ approved mới lên catalog / đăng ký công khai.
alter table public.regular_courses
  add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('draft', 'pending', 'approved'));

comment on column public.regular_courses.approval_status is
  'draft | pending | approved. Khóa nhân bản tạo pending; Owner duyệt. Chỉ approved hiển thị học viên.';

-- Cột mới: default ban đầu approved → mọi bản ghi hiện có giữ hiển thị công khai.
-- Bản ghi insert sau không ghi cột: mặc định chờ duyệt.
alter table public.regular_courses alter column approval_status set default 'pending';
