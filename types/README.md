# Types (KM Global)

## Cấu trúc

- **`domain/`** — Kiểu ứng dụng (subset cột, composite). Ví dụ: [`domain/profile.ts`](domain/profile.ts), [`domain/student-profile.ts`](domain/student-profile.ts).
- **`database.ts`** — Barrel re-export để giữ import cũ (`from "types/database"`).
- **`database.generated.ts`** — (sau khi chạy codegen) type `Database` sinh từ Supabase; **không sửa tay**.

## Quy ước khi đổi schema Postgres

1. Thêm/sửa migration trong `supabase/migrations/`.
2. **Trước khi merge app** dùng cột mới: DB mục tiêu (dev/staging/prod) đã apply migration.
3. Cho đến khi mọi chỗ dùng `Database` generated:
   - Cập nhật type tương ứng trong `types/domain/` nếu query/select thêm cột.
4. Sau khi có script `types:supabase` (xem `package.json`):
   - Chạy regenerate, commit `database.generated.ts`, rồi mới merge PR app phụ thuộc cột mới.

## Codegen

```bash
npm run types:supabase
```

Cần Supabase CLI và project đã link (`supabase link`) hoặc biến `SUPABASE_PROJECT_ID` khi chạy CI/local (xem comment trong script).

## Quy trình khuyến nghị (migrate -> regenerate -> deploy)

1. Apply migration DB trước (`supabase/migrations/` theo thứ tự).
2. Regenerate type:
   - `npm run types:supabase`
3. Commit `types/database.generated.ts` cùng migration liên quan.
4. Chạy kiểm tra tối thiểu trước deploy:
   - `npm run lint`
   - `npx tsc --noEmit` (tuỳ chọn nhưng khuyến nghị cho PR đụng schema/type)
5. Deploy app sau khi DB đã sẵn sàng ở môi trường mục tiêu.

Chi tiết migration/deploy: [`supabase/README.md`](../supabase/README.md), [`supabase/DEPLOY_CHECKLIST.md`](../supabase/DEPLOY_CHECKLIST.md).
