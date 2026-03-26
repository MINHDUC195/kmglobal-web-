# Checklist triển khai migration Supabase (production / staging)

Dùng trước mỗi lần deploy code phụ thuộc schema mới hoặc khi đồng bộ môi trường mới.

## 1. Chuẩn bị

- [ ] Đã backup database (Supabase Dashboard → Database → Backups, hoặc `pg_dump` nếu self-host).
- [ ] Đã đọc diff migration mới trong `supabase/migrations/` (không chạy file SQL thủ công trùng với migration đã có tên timestamp).

## 2. Thứ tự áp dụng

- [ ] Migration trong repo được đặt tên theo thời gian (`YYYYMMDDHHMMSS_*.sql`) — **giữ nguyên thứ tự lexicographic**.
- [ ] Trên Supabase: **SQL Editor** hoặc **Supabase CLI** (`supabase db push` / link project), không bỏ qua migration giữa chừng.

## 3. Các gói migration thường gặp (tham khảo)

| Nội dung | Gợi ý file / thư mục |
|----------|----------------------|
| Giảm giá khóa học | `20260321100000_regular_courses_discount.sql`, `ops/RUN_MIGRATION_DISCOUNT.sql` |
| Khóa % giảm sau clone | `20260324140000_regular_courses_discount_locked.sql` |
| Mẫu chứng chỉ / bucket | `ops/RUN_MIGRATION_CERTIFICATE_SAMPLE.sql`, migration `*_certificate_*` |

Sau khi chạy migration: tải lại app admin, tránh lỗi “schema cache” / column missing.

## 3.1 Đồng bộ type app sau migration (khuyến nghị)

- [ ] Chạy `npm run types:supabase` để regenerate `types/database.generated.ts`.
- [ ] Commit migration + file generated trong cùng PR.
- [ ] Chạy `npm run lint` và (tuỳ chọn) `npx tsc --noEmit` trước deploy.

## 4. Xác minh sau khi push

- [ ] Dashboard Supabase → **Database** → bảng/cột mới hiển thị đúng.
- [ ] Trigger / function (nếu có): thử thao tác UI liên quan (ví dụ cập nhật `regular_courses` khi `discount_percent_locked = true` — `discount_percent` không đổi).
- [ ] CI (`npm run build`, workflow GitHub) xanh trên branch deploy.

## 5. Rollback

- Supabase không rollback migration tự động. Chỉ rollback bằng **migration mới** (reverse) hoặc restore backup — lên kế hoạch trước khi deploy thay đổi phá vỡ dữ liệu.
