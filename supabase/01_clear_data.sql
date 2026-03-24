-- ============================================================================
-- KM GLOBAL - XÓA DỮ LIỆU ĐÃ NHẬP
-- Chạy trong Supabase SQL Editor (role: postgres)
-- ============================================================================
-- Lưu ý: Chạy 00_reset_database.sql trước nếu chưa chạy (để xóa bảng cũ).
-- File này xóa toàn bộ dữ liệu trong bảng profiles.
-- ============================================================================

-- Xóa toàn bộ dữ liệu trong profiles
TRUNCATE TABLE public.profiles CASCADE;
