-- Làm rõ nghĩa cột: ngưỡng áp cho điểm *tổng* khóa (quá trình + thi cuối có trọng số), không chỉ bài thi cuối

comment on column public.base_courses.certificate_pass_percent is
  'Ngưỡng điểm tổng khóa học (%) để cấp chứng chỉ — cộng có trọng số: quá trình (bài học/quiz) + bài thi cuối';
