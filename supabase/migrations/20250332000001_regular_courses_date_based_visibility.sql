-- Trạng thái khóa học tính theo ngày tháng, không dùng cột status nữa.
-- Cập nhật RLS: cho phép xem khóa học khi chưa đóng đăng ký và chưa kết thúc (sắp mở + đang mở).
-- Khóa đã đóng/đã kết thúc chỉ hiện trong dashboard của học viên đã đăng ký (qua enrollments).

drop policy if exists "Public view open courses" on public.regular_courses;
create policy "Public view open courses" on public.regular_courses
  for select using (
    (registration_close_at is null or registration_close_at >= now())
    and (course_end_at is null or course_end_at >= now())
  );
