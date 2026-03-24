-- ============================================================================
-- KM GLOBAL - RESET DATABASE (Chiến dịch "Reset toàn bộ")
-- Chạy file này trong Supabase SQL Editor (role: postgres) để xóa toàn bộ
-- bảng liên quan hệ thống cũ. CHỈ GIỮ LẠI bảng profiles (Auth).
-- ============================================================================

-- Xóa các bảng theo thứ tự phụ thuộc (child -> parent).
-- Dùng CASCADE để tự động xóa các ràng buộc phụ thuộc.

-- 1) Bảng chi tiết câu trả lời / bài nộp / tiến độ
DROP TABLE IF EXISTS public.quiz_attempt_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.homework_submissions CASCADE;
DROP TABLE IF EXISTS public.user_progress CASCADE;
DROP TABLE IF EXISTS public.user_lesson_progress CASCADE;

-- 2) Bảng cấu hình grading / quiz
DROP TABLE IF EXISTS public.template_chapter_weights CASCADE;
DROP TABLE IF EXISTS public.template_grading_policies CASCADE;
DROP TABLE IF EXISTS public.quiz_questions CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;

-- 3) Bảng ngân hàng câu hỏi
DROP TABLE IF EXISTS public.question_bank_topics CASCADE;
DROP TABLE IF EXISTS public.question_topics CASCADE;
DROP TABLE IF EXISTS public.question_choices CASCADE;
DROP TABLE IF EXISTS public.question_blank_answers CASCADE;
DROP TABLE IF EXISTS public.question_matching_pairs CASCADE;
DROP TABLE IF EXISTS public.question_bank CASCADE;

-- 4) Bảng lesson components
DROP TABLE IF EXISTS public.lesson_components CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.chapters CASCADE;

-- 5) Bảng chứng chỉ
DROP TABLE IF EXISTS public.issued_certificates CASCADE;
DROP TABLE IF EXISTS public.certificate_templates CASCADE;

-- 6) Bảng thanh toán / ghi danh
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;

-- 7) Bảng khóa học
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.course_templates CASCADE;

-- 8) Bảng nội dung pháp lý
DROP TABLE IF EXISTS public.legal_content CASCADE;

-- 9) Xóa các custom types (nếu có)
DROP TYPE IF EXISTS public.attempt_status_type CASCADE;
DROP TYPE IF EXISTS public.quiz_scope_type CASCADE;
DROP TYPE IF EXISTS public.quiz_kind_type CASCADE;
DROP TYPE IF EXISTS public.question_format_type CASCADE;
DROP TYPE IF EXISTS public.lesson_component_type CASCADE;
DROP TYPE IF EXISTS public.chapter_scope_type CASCADE;
DROP TYPE IF EXISTS public.course_status_v2 CASCADE;
DROP TYPE IF EXISTS public.course_difficulty CASCADE;

-- 10) Xóa các function phụ thuộc (clone, has_paid_course, v.v.)
DROP FUNCTION IF EXISTS public.clone_course_from_template_atomic(uuid, text, timestamptz, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.clone_course_from_template_atomic(uuid, text, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS public.has_paid_course(uuid) CASCADE;

-- KHÔNG XÓA: public.profiles (dùng cho Supabase Auth)
-- KHÔNG XÓA: public.is_admin(), public.is_owner(), public.handle_new_auth_user_profile()
-- (các function này tham chiếu profiles; giữ lại nếu cần cho kiến trúc mới)
