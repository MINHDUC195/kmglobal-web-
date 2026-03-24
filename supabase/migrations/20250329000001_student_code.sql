-- Mã học viên: 440311-{A|B|C...}{6 chữ số}, bắt đầu từ 440311-A000068
alter table public.profiles add column if not exists student_code text unique;

-- Bảng sequence cho mã học viên (atomic increment)
create table if not exists public.student_code_sequence (
  id int primary key default 1 check (id = 1),
  val bigint not null default 67
);

insert into public.student_code_sequence (id, val) values (1, 67)
on conflict (id) do nothing;

-- Hàm lấy mã học viên tiếp theo (440311-A000068, A000069, ... A999999, B000001, ...)
create or replace function public.next_student_code()
returns text language plpgsql security definer set search_path = public as $$
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
