# Quy trình "OK update" (sau khi kiểm thử)

Khi bạn đã kiểm thử xong và muốn **đồng bộ toàn bộ** lên GitHub, Vercel và cấu hình Supabase, hãy nhắn assistant: **OK update**.

## Assistant sẽ làm gì

1. **GitHub** — commit thay đổi còn lại (nếu có), `git push` branch hiện tại.
2. **Vercel** — xác nhận build sau push (hoặc `vercel --prod` nếu cần); kiểm tra env production.
3. **Supabase** — migration / SQL trong `supabase/migrations` hoặc SQL Editor; Auth URL nếu đổi domain; **không** commit secret.

Chi tiết kỹ thuật: [`PRODUCTION_AND_UAT.md`](PRODUCTION_AND_UAT.md), [`../supabase/README.md`](../supabase/README.md), [`../supabase/DEPLOY_CHECKLIST.md`](../supabase/DEPLOY_CHECKLIST.md).

Quy tắc Cursor (bản đầy đủ): [`.cursor/rules/ok-update-sync.mdc`](../.cursor/rules/ok-update-sync.mdc).
