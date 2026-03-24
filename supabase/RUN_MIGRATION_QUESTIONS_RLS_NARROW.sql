-- =============================================================================
-- Chạy trong Supabase → SQL Editor nếu chưa chạy 20260324120000_questions_rls_remove_student_select.sql
-- =============================================================================

drop policy if exists "Students read questions" on public.questions;
