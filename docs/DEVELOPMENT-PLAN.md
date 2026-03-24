# KẾ HOẠCH PHÁT TRIỂN CHI TIẾT – KM GLOBAL ACADEMY

> Tài liệu này mô tả kế hoạch phát triển nền tảng E-learning KM Global Academy theo tài liệu thiết kế phần mềm.

---

## 1. THÔNG SỐ KỸ THUẬT ĐÃ CHỌN

| Hạng mục | Lựa chọn |
|----------|----------|
| **Công cụ phát triển** | Cursor (AI-assisted coding) |
| **Cổng thanh toán** | VNPay, MoMo, Visa (Stripe) |
| **Chống chụp màn hình** | Mức **ngăn chặn** |
| **Video** | Chỉ Bunny.net |
| **Thông tin công ty** | Công ty TNHH KM Global – hiển thị ở **footer** |

---

## 2. CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS (màu chủ đạo Gold #D4AF37 + Đen/Trắng) |
| Backend / DB | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Video | Bunny.net Stream |
| PDF | Watermark động (server-side) |
| Thanh toán | VNPay API, MoMo API, Stripe (Visa) |

---

## 3. LỘ TRÌNH THEO PHASE

### PHASE 0: CHUẨN BỊ (Tuần 1)

| STT | Nhiệm vụ | Chi tiết | Công cụ |
|-----|----------|----------|---------|
| 0.1 | Thiết lập môi trường | Node.js, Cursor, Git, Supabase CLI | - |
| 0.2 | Tài khoản dịch vụ | Bunny.net, VNPay, MoMo, Stripe (sandbox) | - |
| 0.3 | Thiết kế database | ERD, bảng, RLS | Cursor + Supabase |
| 0.4 | Cấu trúc dự án | Thư mục, quy ước đặt tên | Cursor |
| 0.5 | Footer | Thêm "Công ty TNHH KM Global" + địa chỉ, MST | Cursor |

---

### PHASE 1: NỀN TẢNG & AUTH (Tuần 2–3)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 1.1 | Supabase Auth | Email/password, xác thực email | `lib/supabase-*.ts` |
| 1.2 | Bảng `profiles` | Họ tên, địa chỉ, công ty, SĐT, giới tính, ảnh | Migration |
| 1.3 | Phân quyền | `role`: owner, admin, student | `profiles.role` |
| 1.4 | Chặn đăng ký | Block domain/loại hình: tư vấn ISO, IATF, tổ chức chứng nhận | `app/register/` |
| 1.5 | Proxy (Next.js 16+) | Bảo vệ route theo role | `proxy.ts` |
| 1.6 | Chống đăng nhập trùng | Lưu `last_ip`, `last_session`, kiểm tra khi login | `lib/auth-utils.ts` |
| 1.7 | Cam kết bảo mật | Checkbox + lưu timestamp khi đăng ký | `profiles.security_agreed_at` |

---

### PHASE 2: CẤU TRÚC KHÓA HỌC (Tuần 4–5)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 2.1 | Bảng `programs` | Chương trình học | Migration |
| 2.2 | Bảng `base_courses` | Khóa cơ bản (template) | Migration |
| 2.3 | Bảng `regular_courses` | Khóa thường (clone, có thời gian mở/đóng) | Migration |
| 2.4 | Bảng `chapters` | Chương | Migration |
| 2.5 | Bảng `lessons` | Bài học (video, tài liệu, câu hỏi) | Migration |
| 2.6 | Bảng `homework` | Bài tập về nhà | Migration |
| 2.7 | Bảng `final_exams` | Bài thi cuối khóa | Migration |
| 2.8 | CRUD chương trình | Owner/Admin tạo, sửa | `app/admin/programs/` |
| 2.9 | CRUD khóa cơ bản | Thêm, sửa, xóa, clone | `app/admin/base-courses/` |
| 2.10 | Phân bổ điểm | % chương, % bài tập, % thi cuối | `base_courses` config |

---

### PHASE 3: NỘI DUNG BÀI HỌC (Tuần 6–7)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 3.1 | Tích hợp Bunny.net | Upload, stream, signed URL | `lib/bunny.ts` |
| 3.2 | Video player | Component phát video Bunny | `components/BunnyVideoPlayer.tsx` |
| 3.3 | Tài liệu | Upload PDF, watermark động | `lib/pdf-watermark.ts` |
| 3.4 | Viewer PDF | Hiển thị PDF có watermark | `components/PDFViewer.tsx` |
| 3.5 | Soạn thảo bài học | Video URL, tài liệu, câu hỏi nhanh | `app/admin/lessons/[id]/` |
| 3.6 | Cấu trúc bài | Chương → Bài → Video/Tài liệu/Câu hỏi | UI Admin |

---

### PHASE 4: HỆ THỐNG CÂU HỎI (Tuần 8)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 4.1 | Bảng `questions` | Nội dung, loại, điểm | Migration |
| 4.2 | Bảng `question_options` | Đáp án (đúng/sai) | Migration |
| 4.3 | Thư viện câu hỏi | Admin soạn, tag theo chủ đề | `app/admin/question-library/` |
| 4.4 | Trắc nghiệm 1 đáp án | Single choice | `components/QuizSingleChoice.tsx` |
| 4.5 | Trắc nghiệm nhiều đáp án | Multiple choice | `components/QuizMultipleChoice.tsx` |
| 4.6 | Điền vào ô trống | So sánh đáp án server-side | `components/QuizFillBlank.tsx` |
| 4.7 | Số lần trả lời | 1, 2, 3 lần tùy cấu hình | Config per question |
| 4.8 | API chấm điểm | Chỉ server, **không gửi correct_answer về frontend** | `app/api/quiz/submit/route.ts` |

---

### PHASE 5: THANH TOÁN (Tuần 9–10)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 5.1 | Bảng `payments` | Ghi nhận giao dịch | Migration |
| 5.2 | Bảng `subscriptions` | Gói thành viên hàng tháng | Migration |
| 5.3 | VNPay | Tích hợp API, webhook/IPN | `lib/vnpay.ts`, `app/api/webhook/vnpay/` |
| 5.4 | MoMo | Tích hợp API, webhook | `lib/momo.ts`, `app/api/webhook/momo/` |
| 5.5 | Visa (Stripe) | Thẻ quốc tế | `lib/stripe.ts`, `app/api/webhook/stripe/` |
| 5.6 | Trang thanh toán | Chọn cổng, redirect | `app/checkout/` |
| 5.7 | Webhook xử lý | Cập nhật trạng thái, mở khóa khóa | `app/api/webhook/` |
| 5.8 | Gói thành viên | Định kỳ, tự động khóa khi hết hạn | Cron / Supabase Edge |

---

### PHASE 6: ĐĂNG KÝ & HỌC (Tuần 11–12)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 6.1 | Bảng `enrollments` | Đăng ký khóa học | Migration |
| 6.2 | Trang khóa học | Danh sách khóa đang mở | `app/courses/` |
| 6.3 | Chi tiết khóa | Mô tả, giá, nút đăng ký | `app/courses/[id]/` |
| 6.4 | Luồng đăng ký | Chọn khóa → Thanh toán → Mở khóa | `app/enroll/` |
| 6.5 | Trang học | Video, tài liệu, câu hỏi | `app/learn/[enrollmentId]/` |
| 6.6 | Tiến độ | Thanh tiến độ kiểu EDX | `components/ProgressBar.tsx` |
| 6.7 | Điều kiện thi cuối | Hoàn thành tất cả chương | Logic server |

---

### PHASE 7: CHỨNG CHỈ & BẢO MẬT NỘI DUNG (Tuần 13)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 7.1 | Bảng `certificates` | Mã, user, khóa, điểm, ngày cấp | Migration |
| 7.2 | Tạo chứng chỉ | PDF, QR, watermark | `lib/certificate-generator.ts` |
| 7.3 | Trang chứng chỉ | Tải, xem | `app/certificates/` |
| 7.4 | Tra cứu chứng chỉ | Theo mã QR/mã | `app/verify-certificate/` |
| 7.5a | **Watermark trang học** | Overlay bán trong suốt (user, email) trên nội dung | `components/ScreenshotProtection.tsx` |
| 7.5b | **Chặn phím chụp màn hình** | Print Screen, Win+Shift+S, Cmd+Shift+4, Cmd+Shift+3 | `components/ScreenshotProtection.tsx` |
| 7.5c | **Chặn right-click** | Disable context menu trên vùng nội dung | `components/ProtectedContent.tsx` |
| 7.5d | **Watermark video** | Dùng tính năng overlay của Bunny.net | Bunny dashboard |
| 7.5e | **Chống DevTools** (tùy chọn) | Phát hiện mở DevTools → làm mờ hoặc cảnh báo | `components/ScreenshotProtection.tsx` |
| 7.5f | **Điều khoản** | Ghi rõ cấm chụp màn hình và hậu quả | Terms of Service |
| 7.6 | Chống in | Disable print | CSS + JS |

---

### PHASE 8: DASHBOARD & Q&A (Tuần 14–15)

| STT | Nhiệm vụ | Chi tiết | File/Route |
|-----|----------|----------|------------|
| 8.1 | Dashboard Owner | Thanh toán, Admin, học viên, phê duyệt | `app/owner/` |
| 8.2 | Dashboard Admin | Chương trình, khóa, Q&A | `app/admin/` |
| 8.3 | Dashboard Học viên | Khóa đã đăng ký, tiến độ, chứng chỉ | `app/student/` |
| 8.4 | Bảng `qa_threads` | Câu hỏi học viên | Migration |
| 8.5 | Q&A | Học viên hỏi, Admin trả lời | `app/learn/.../qa/` |
| 8.6 | Phê duyệt khóa | Owner duyệt/từ chối | `app/owner/approvals/` |

---

### PHASE 9: HOÀN THIỆN & TRIỂN KHAI (Tuần 16–17)

| STT | Nhiệm vụ | Chi tiết |
|-----|----------|----------|
| 9.1 | Backup | Cron backup DB (hàng ngày/giờ) |
| 9.2 | Footer | Công ty TNHH KM Global, địa chỉ, MST, quyền sở hữu |
| 9.3 | Tối ưu | 50–100 học đồng thời, ~1000 truy cập |
| 9.4 | Testing | E2E, kiểm tra luồng chính |
| 9.5 | Deploy | Vercel/Railway + Supabase production |

---

## 4. CHỐNG CHỤP MÀN HÌNH – MỨC NGĂN CHẶN

### 4.1. Các biện pháp áp dụng

| Biện pháp | Mô tả | Ưu tiên |
|-----------|-------|---------|
| **Watermark động** | Overlay user/email lên video, PDF, trang học | Cao |
| **Chặn phím tắt** | Print Screen, Win+Shift+S, Cmd+Shift+4, Cmd+Shift+3 | Cao |
| **Chặn right-click** | Disable context menu | Trung bình |
| **Chống DevTools** | Phát hiện mở DevTools → cảnh báo/làm mờ | Tùy chọn |
| **Điều khoản** | Cấm chụp màn hình, có thể khóa tài khoản | Cao |

### 4.2. Lưu ý kỹ thuật

- Trình duyệt **không cho phép** chặn 100% mọi cách chụp màn hình (phím tắt OS, điện thoại, phần mềm bên ngoài).
- Watermark là biện pháp hiệu quả nhất: vừa răn đe vừa truy vết nguồn nếu bị rò rỉ.
- Chặn phím tắt có thể ảnh hưởng UX; cần test trên nhiều trình duyệt và OS.

---

## 5. CẤU TRÚC THƯ MỤC GỢI Ý

```
kmglobal-web/
├── app/
│   ├── (auth)/           # login, register
│   ├── (public)/         # landing, courses, verify-certificate
│   ├── admin/            # dashboard admin
│   ├── owner/            # dashboard owner
│   ├── student/          # dashboard học viên
│   ├── learn/            # trang học
│   ├── checkout/         # thanh toán
│   ├── api/
│   │   ├── webhook/      # vnpay, momo, stripe
│   │   ├── quiz/         # submit answer
│   │   └── ...
│   └── layout.tsx
├── components/
│   ├── BunnyVideoPlayer.tsx
│   ├── PDFViewer.tsx
│   ├── ScreenshotProtection.tsx
│   ├── ProtectedContent.tsx
│   ├── Quiz*.tsx
│   └── Footer.tsx        # Công ty TNHH KM Global
├── lib/
│   ├── bunny.ts
│   ├── vnpay.ts
│   ├── momo.ts
│   ├── stripe.ts
│   ├── pdf-watermark.ts
│   └── certificate-generator.ts
├── docs/
│   └── DEVELOPMENT-PLAN.md
└── ...
```

---

## 6. QUY TRÌNH LÀM VIỆC VỚI CURSOR

| Bước | Hành động |
|------|-----------|
| 1 | Mô tả rõ task (tiếng Việt cho UI, tiếng Anh cho code) |
| 2 | Dùng @ để trích dẫn file/context liên quan |
| 3 | Chạy Agent mode khi cần sửa code |
| 4 | Review diff trước khi commit |
| 5 | Test thủ công sau mỗi tính năng |

---

## 7. QUY TẮC DỰ ÁN (TỪ .cursorrules)

- **UI**: Tiếng Việt
- **Code/comment**: Tiếng Anh
- **Styling**: Tailwind CSS, màu Gold (#D4AF37) + Đen/Trắng
- **Bảo mật**: Không lưu `correct_answer` ở frontend
- **Video**: Bunny.net
- **PDF**: Watermark động

---

## 8. TỔNG KẾT

| Phase | Tuần | Nội dung chính |
|-------|------|----------------|
| 0 | 1 | Chuẩn bị, footer |
| 1 | 2–3 | Auth, phân quyền |
| 2 | 4–5 | Cấu trúc khóa học |
| 3 | 6–7 | Video Bunny, PDF watermark |
| 4 | 8 | Hệ thống câu hỏi |
| 5 | 9–10 | Thanh toán VNPay/MoMo/Visa |
| 6 | 11–12 | Đăng ký, trang học |
| 7 | 13 | Chứng chỉ, chống chụp màn hình |
| 8 | 14–15 | Dashboard, Q&A |
| 9 | 16–17 | Hoàn thiện, deploy |

**Tổng ước tính: 17 tuần**
