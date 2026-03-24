/**
 * Password strength rules (align API + client register / change-password).
 */
export function validatePasswordStrength(password: string): {
  ok: boolean;
  message?: string;
} {
  if (!password || password.length < 10) {
    return { ok: false, message: "Mật khẩu tối thiểu 10 ký tự." };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: "Cần ít nhất một chữ thường (a-z)." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "Cần ít nhất một chữ hoa (A-Z)." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Cần ít nhất một chữ số." };
  }
  return { ok: true };
}
