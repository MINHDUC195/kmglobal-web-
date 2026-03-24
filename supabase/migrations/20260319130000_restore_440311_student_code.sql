-- Khôi phục quy tắc mã học viên: 440311-{A|B|C...}{6 chữ số}, bắt đầu từ 440311-A000068
-- (Thay thế logic KMG-HV-000001 trong migration 20260319120000.)

insert into public.student_code_sequence (id, val) values (1, 67)
on conflict (id) do nothing;

-- Đồng bộ val với mã 440311-* đã tồn tại (không trùng / không lùi số)
update public.student_code_sequence
set val = greatest(
  67,
  coalesce(
    (
      select max(
        (ascii(substring(p.student_code from 8 for 1)) - ascii('A'))::bigint * 999999
        + substring(p.student_code from 9 for 6)::bigint
      )
      from public.profiles p
      where p.student_code ~ '^440311-[A-Z][0-9]{6}$'
    ),
    67
  )
)
where id = 1;

-- Hàm lấy mã học viên tiếp theo (440311-A000068, A000069, ... A999999, B000001, ...)
create or replace function public.next_student_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
  letter_idx int;
  num_part int;
  letter char;
begin
  update public.student_code_sequence
  set val = val + 1
  where id = 1
  returning val into v;
  -- v: 68 -> A000068, 999999 -> A999999, 1000000 -> B000001
  letter_idx := (v - 1) / 999999;
  num_part := ((v - 1) % 999999) + 1;
  letter := chr(ascii('A') + letter_idx);
  return '440311-' || letter || lpad(num_part::text, 6, '0');
end;
$$;

-- Gán mã cho học viên chưa có mã (cũ nhất trước)
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

-- Trigger đăng ký vẫn gọi next_student_code(); không cần đổi nếu đã dùng hàm chung
