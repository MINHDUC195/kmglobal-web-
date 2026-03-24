# Quy tắc logic nền tảng KM Global (E-learning)

Tài liệu tóm tắt các luật nghiệp vụ và kỹ thuật đã áp dụng trong codebase. Có thể xem biểu đồ trên [mermaid.live](https://mermaid.live) hoặc trình xem Markdown hỗ trợ Mermaid.

---

## 1. Quy tắc tổng quan (UI & an toàn)

Xem thêm `.cursorrules` trong repo.

```mermaid
flowchart TB
  subgraph UI["Luật giao diện"]
    A1[Nội dung hiển thị: Tiếng Việt]
    A2[Code / biến / comment: Tiếng Anh]
    A3[Tailwind — tông Vàng Gold #D4AF37 + Đen/Trắng]
  end
  subgraph Bảo_mật["Luật nội dung & bảo mật"]
    B1[Không lưu correct_answer ở Frontend]
    B2[Video: Bunny.net]
    B3[PDF: watermark động]
  end
  UI --> Bảo_mật
```

---

## 2. Báo cáo Owner — thanh toán & đăng ký

**File tham chiếu:** `app/api/owner/reports/payments/route.ts`, `app/owner/reports/page.tsx`

```mermaid
flowchart TD
  subgraph Nguồn_dữ_liệu["Nguồn dòng trên bảng"]
    P[Giao dịch payments]
    E[Enrollment có payment_id = NULL]
  end
  P --> D[Dedupe theo user_id + khóa học]
  D --> R1{Ưu tiên trạng thái}
  R1 --> C[completed]
  R1 --> Pd[pending]
  R1 --> X[failed / refunded / cancelled]
  R2{Cùng mức ưu tiên?}
  R2 -->|ưu tiên| EN[Bản đã có enrollment DB]
  R2 -->|sau đó| T[Bản created_at mới nhất]
  E --> F{Giá sau giảm = 0?}
  F -->|có| MF[Miễn phí — Đăng ký miễn phí]
  F -->|không| CP[Chờ thanh toán — đúng giá sale]
```

**Khóa dedupe (payment):**

- `user_id` **null** → **không gộp** (mỗi `payment.id` một dòng).
- Còn lại: khóa = `user_id` + danh sách `course_id` đã sắp xếp (enrollment + metadata).

---

## 3. Ngày đăng ký & học viên trên báo cáo

```mermaid
flowchart LR
  subgraph Payment_row["Dòng từ payment"]
    PA[enrolled_at từ enrollment gắn payment]
    PB[Chưa có enrollment: dùng created_at của payment]
  end
  subgraph Enrollment_row["Dòng chỉ có enrollment"]
    FC[Khóa miễn phí thật → free]
    FP[Khóa trả phí → pending + số tiền sale]
  end
```

---

## 4. Khóa học clone — cố định % giảm giá

**Migration:** `supabase/migrations/20260324140000_regular_courses_discount_locked.sql`  
**UI:** `app/admin/base-courses/.../BaseCourseDetail.tsx`, `app/admin/regular-courses/.../edit/page.tsx`

```mermaid
stateDiagram-v2
  [*] --> ModalNhanBan: Nhân bản từ base course
  ModalNhanBan --> DaTao: insert + discount_percent_locked = true
  DaTao --> SuaKhoa: Chỉnh sửa regular course
  SuaKhoa --> KhongDoiGG: Ô giảm giá bị khóa
  KhongDoiGG --> DBTrigger: Trigger BEFORE UPDATE giữ nguyên discount_percent
```

---

## 5. Quiz API — không lộ đáp án cho client

**File:** `app/api/quiz/questions/route.ts`

```mermaid
flowchart TD
  Q[GET /api/quiz/questions] --> O[Options: chỉ id + option_text]
  Q --> F{mayShowFeedback?}
  F -->|đủ điểm hoặc hết lượt| SA[student_answer_display + correct_answer_display]
  F -->|chưa| NS[Không gửi đáp án đúng]
```

---

## 6. API thay đổi trạng thái — CSRF (`validateOrigin`)

**File:** `lib/csrf.ts`

```mermaid
flowchart LR
  POST[POST state-changing] --> VO{validateOrigin}
  VO -->|hợp lệ| OK[Xử lý]
  VO -->|không| E403[403 Invalid origin]
```

Production cần `NEXT_PUBLIC_SITE_URL` hoặc `NEXT_PUBLIC_APP_URL` (xem `scripts/check-production-env.mjs`).

---

## 7. Truy cập học theo thanh toán (enrollment)

**File:** `lib/enrollment-payment-status.ts`

```mermaid
flowchart TD
  RC[regular_course: price_cents + discount_percent] --> SP[getSalePriceCents]
  SP --> Z{salePrice <= 0?}
  Z -->|có| FREE[Khóa miễn phí — coi như đã thanh toán]
  Z -->|không| PY{Có payment_id?}
  PY -->|có| ST{payment.status = completed?}
  ST -->|có| PAID[Đã thanh toán]
  ST -->|không| NEED[Cần thanh toán]
  PY -->|không| NEED
```

---

## 8. CI (kiểm tra tự động)

**File:** `.github/workflows/ci.yml`, script `npm run ci` trong `package.json`

```mermaid
flowchart LR
  L[lint] --> T[test]
  T --> ENV[check-production-env.mjs]
  ENV --> B[build]
```

---

## 9. Triển khai migration Supabase

**File:** `supabase/DEPLOY_CHECKLIST.md`

- Backup trước khi chạy migration mới.
- Giữ thứ tự file `supabase/migrations/*_*.sql`.
- Xác minh trigger/cột sau khi push (ví dụ `discount_percent_locked`).

---

*Cập nhật khi thêm luật nghiệp vụ mới — nên đồng bộ sơ đồ và mô tả ngắn tại đây.*
