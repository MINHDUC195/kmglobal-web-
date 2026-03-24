# Production và UAT (KM Global Web)

Tài liệu hướng dẫn triển khai biến môi trường production và kiểm thử tích hợp (UAT). Chi tiết biến: [`.env.example`](../.env.example).

## 1. Biến môi trường production (ưu tiên cao)

### `NEXT_PUBLIC_SITE_URL` và `NEXT_PUBLIC_APP_URL`

- Đặt **`NEXT_PUBLIC_SITE_URL`** = URL công khai của app, ví dụ `https://ten-mien-cua-ban.com` (không có `/` ở cuối hoặc thống nhất một kiểu).
- **Checkout** dùng `NEXT_PUBLIC_APP_URL` nếu có, nếu không thì dùng `request.nextUrl.origin` ([`app/api/checkout/init/route.ts`](../app/api/checkout/init/route.ts)).
- **CSRF** trên API checkout so khớp `Origin`/`Referer` với origin của `NEXT_PUBLIC_SITE_URL` hoặc `NEXT_PUBLIC_APP_URL` ([`lib/csrf.ts`](../lib/csrf.ts)). Nếu đã set URL mà domain truy cập khác → có thể lỗi **403 Invalid origin**.

### Upstash Redis (khi scale nhiều instance)

- Khi có **`UPSTASH_REDIS_REST_URL`** và **`UPSTASH_REDIS_REST_TOKEN`**, rate limit ([`lib/rate-limit.ts`](../lib/rate-limit.ts)) và idempotency checkout ([`lib/checkout-idempotency.ts`](../lib/checkout-idempotency.ts)) dùng Redis chung.
- Một instance: có thể bỏ qua (fallback in-memory trong từng process).
- Tạo database tại [Upstash Console](https://console.upstash.com/), copy REST URL và token vào biến môi trường hosting.

### Script kiểm tra nhanh

```bash
npm run check:env
```

Trước UAT thanh toán, đảm bảo đã điền **ít nhất một cổng** (VNPay, MoMo hoặc Stripe) trong `.env.local`, rồi:

```bash
npm run check:env -- --require-payments --warn-redis
```

(`--require-payments` = có ít nhất một cổng cấu hình đủ, không bắt cả ba.)

## 2. UAT – Thanh toán và webhook

Đăng ký URL trên **staging** (cùng domain đã cấu hình trong env).

| Cổng | Ghi chú |
|------|--------|
| **VNPay** | Return URL trong code: `{baseUrl}/api/checkout/return/vnpay` — cần khớp cấu hình sandbox/production trên cổng VNPay. `VNPAY_URL` = sandbox hoặc production theo tài liệu VNPay. |
| **MoMo** | `notifyUrl` = `{baseUrl}/api/webhook/momo`, `returnUrl` = `{baseUrl}/checkout/success` (xem [`app/api/checkout/init/route.ts`](../app/api/checkout/init/route.ts)). |
| **Stripe** | Checkout redirect: success `{baseUrl}/checkout/success?session_id=...`, cancel `{baseUrl}/checkout/cancel`. Webhook: `POST {baseUrl}/api/webhook/stripe` — tạo endpoint trên Stripe Dashboard, dán `STRIPE_WEBHOOK_SECRET` đúng signing secret của endpoint đó. |

Dùng **sandbox / test keys** cho UAT; không commit secret thật.

## 3. UAT – Luồng học end-to-end (checklist)

1. Đăng ký / đăng nhập học viên.
2. (Tùy) Thanh toán khóa học — hoặc enrollment thử nghiệm nếu có đường tắt trong DB.
3. Mở `/learn/[enrollmentId]`, vào bài `/learn/preview/[lessonId]?enrollmentId=...`.
4. Xác nhận video Bunny, PDF watermark, quiz, tiến độ.
5. Thi cuối khóa → đạt ngưỡng → chứng chỉ.
6. Tra cứu `/verify?code=...` nếu áp dụng.

Sau khi admin sửa catalog công khai: có thể gọi **POST** `/api/admin/revalidate-catalog` (owner/admin) để làm mới cache catalog (~2 phút TTL nếu không gọi).

## 4. Supabase

- Apply đủ migration trong [`supabase/migrations`](../supabase/migrations) cho môi trường tương ứng; xem [`supabase/README.md`](../supabase/README.md).
