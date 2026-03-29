/**
 * Gửi email thông báo (Resend nếu có RESEND_API_KEY; không thì log).
 */

const FROM = process.env.EMAIL_FROM || "KM Global <noreply@kmglobal.net>";

export async function sendKmgEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[email-notify] (no RESEND_API_KEY) would send to", opts.to, opts.subject);
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[email-notify] Resend error:", res.status, t);
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email-notify]", e);
    return { sent: false };
  }
}

export function cancelWarningEmailHtml(
  fullName: string | null,
  courseName: string,
  cancelCount: number
): string {
  return `
  <p>Xin chào ${fullName ?? "học viên"},</p>
  <p>Bạn vừa hủy đăng ký khóa <strong>${escapeHtml(courseName)}</strong>. Đây là lần hủy thứ <strong>${cancelCount}</strong> cho khóa này.</p>
  <p>Theo quy định, từ lần thứ 3 trở đi hệ thống sẽ ghi nhận và cảnh báo. Tối đa 5 lần hủy có chủ ý cho cùng một khóa; vượt quá có thể dẫn tới khóa tài khoản (chưa thanh toán) hoặc xóa dữ liệu học (đã thanh toán).</p>
  <p>Trân trọng,<br/>KM Global Academy</p>
  `;
}

export function adminPromotionConfirmEmailHtml(opts: {
  ownerName: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  confirmUrl: string;
  expiresSummary: string;
}): string {
  const who = escapeHtml(opts.candidateName || opts.candidateEmail || "học viên");
  const mail = opts.candidateEmail ? escapeHtml(opts.candidateEmail) : "—";
  return `
  <p>Xin chào ${escapeHtml(opts.ownerName || "Owner")},</p>
  <p>Bạn vừa yêu cầu nâng tài khoản sau lên <strong>Admin</strong>:</p>
  <ul>
    <li>Họ tên: <strong>${who}</strong></li>
    <li>Email: ${mail}</li>
  </ul>
  <p>Nếu đúng ý bạn, hãy bấm nút bên dưới (đăng nhập cùng tài khoản Owner). Liên kết chỉ dùng một lần và hết hạn sau <strong>${escapeHtml(opts.expiresSummary)}</strong>.</p>
  <p style="margin:24px 0">
    <a href="${escapeHtml(opts.confirmUrl)}" style="display:inline-block;padding:12px 20px;background:#002b2d;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
      Xác nhận nâng lên Admin
    </a>
  </p>
  <p style="font-size:13px;color:#555">Nếu bạn không gửi yêu cầu này, bỏ qua email và đổi mật khẩu tài khoản Owner.</p>
  <p>Trân trọng,<br/>KM Global Academy</p>
  `;
}

export function tempLockEmailHtml(fullName: string | null, untilIso: string): string {
  return `
  <p>Xin chào ${fullName ?? "học viên"},</p>
  <p>Tài khoản của bạn đã được tạm khóa theo yêu cầu đến <strong>${escapeHtml(untilIso)}</strong>.</p>
  <p>Sau thời điểm này bạn có thể đăng nhập lại bình thường.</p>
  <p>Trân trọng,<br/>KM Global Academy</p>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
