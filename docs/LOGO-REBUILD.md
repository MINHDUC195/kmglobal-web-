# Hướng dẫn tái tạo logo KM Global Academy

## 1. Phần mềm chỉnh sửa SVG

| Phần mềm | Mô tả | Link |
|----------|-------|------|
| **Inkscape** | Miễn phí, mạnh, xuất PNG/PDF | https://inkscape.org |
| **Figma** | Web, miễn phí, cộng tác | https://figma.com |
| **Adobe Illustrator** | Chuyên nghiệp, trả phí | - |
| **VSCode / Cursor** | Chỉnh code SVG trực tiếp | - |

**Mở file SVG:** Mở `public/logo-kmglobal-academy.svg` hoặc `public/logo-kmglobal-academy-full.svg` trong bất kỳ phần mềm trên.

---

## 2. Tái tạo bằng code (npm scripts)

```bash
# Tạo file PNG (đầy đủ icon + chữ, dùng Puppeteer render)
npm run generate:logo-png

# Tạo file ICO (favicon, chỉ icon)
npm run generate:logo-ico
```

**Output:**
- `public/logo-kmglobal-academy.png`
- `public/logo-kmglobal-academy-full.png`
- `public/logo-kmglobal-academy.ico`

---

## 3. Tái tạo thủ công bằng HTML (mở trong trình duyệt)

Lưu file sau thành `logo-preview.html` và mở bằng trình duyệt. Chuột phải → "Lưu hình ảnh dưới dạng" để xuất PNG.

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>KM Global Academy - Logo Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { background: #0a1628; padding: 2rem; margin: 0; }
    .logo { display: inline-block; margin: 1rem; }
    h2 { color: #D4AF37; font-family: sans-serif; }
  </style>
</head>
<body>
  <h2>Logo đơn giản</h2>
  <div class="logo">
    <img src="logo-kmglobal-academy.svg" alt="Logo" width="320">
  </div>
  <h2>Logo đầy đủ</h2>
  <div class="logo">
    <img src="logo-kmglobal-academy-full.svg" alt="Logo Full" width="420">
  </div>
</body>
</html>
```

*(Đặt file trong thư mục `public/` rồi mở `http://localhost:3000/logo-preview.html` khi chạy `npm run dev`)*

---

## 4. Thông số thiết kế

| Thành phần | Giá trị |
|------------|---------|
| Nền icon | `#2C313B` |
| Viền vàng | `#D4AF37` (opacity 0.5) |
| Gradient vàng | `#f5e1a4` → `#D4AF37` → `#B8860B` |
| Chữ trắng | `#ffffff` |
| Font | Be Vietnam Pro (bold 700, semibold 600) |
| Bo góc khung | 14px |

---

## 5. Cấu trúc file SVG

```
public/
├── logo-kmglobal-academy.svg      # Logo đơn giản (icon + KM GLOBAL ACADEMY)
├── logo-kmglobal-academy-full.svg # Logo đầy đủ (+ tagline)
├── logo-kmglobal-academy.png     # PNG (chạy npm run generate:logo-png)
├── logo-kmglobal-academy-full.png
├── logo-kmglobal-academy.ico      # Favicon (chạy npm run generate:logo-ico)
└── logo-icon.svg                 # Chỉ icon, dùng cho ICO
```
