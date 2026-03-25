-- ============================================================================
-- Dọn dữ liệu thanh toán / hóa đơn (VAT) của user đã xóa khỏi Auth
--
-- Ngữ cảnh:
-- - public.payments.user_id -> auth.users(id) ON DELETE SET NULL
-- - Khi xóa user trong Supabase Auth, các dòng payments vẫn còn nhưng user_id = NULL
-- - Cột invoice_exported_at (xuất hóa đơn VAT) nằm trên payments
--
-- enrollments.payment_id -> payments(id) ON DELETE SET NULL: xóa payment không xóa enrollment,
--   chỉ gỡ liên kết payment_id.
--
-- CHẠY TRÊN: Supabase Dashboard → SQL Editor (postgres)
-- Luôn chạy SELECT (bước 1) trước khi DELETE.
-- ============================================================================

-- 1) Xem trước: giao dịch không còn user (thường do đã xóa user trong Auth)
SELECT
  id,
  user_id,
  amount_cents,
  status,
  gateway,
  invoice_exported_at,
  created_at
FROM public.payments
WHERE user_id IS NULL
ORDER BY created_at DESC;

-- 2) (Tùy chọn) Chỉ bỏ đánh dấu đã xuất hóa đơn — giữ lại dòng payment
-- UPDATE public.payments
-- SET invoice_exported_at = NULL
-- WHERE user_id IS NULL;

-- 3) Xóa hẳn các bản ghi thanh toán không còn user (gồm invoice_exported_at)
-- Chạy sau khi đã xem kết quả bước 1 và chấp nhận mất dữ liệu.
DELETE FROM public.payments
WHERE user_id IS NULL;
