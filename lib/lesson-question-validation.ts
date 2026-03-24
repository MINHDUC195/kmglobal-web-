/**
 * Validation for lesson question/reply content.
 * Chặn: số điện thoại (mọi đầu số), email, tài khoản mạng xã hội (Facebook, Instagram, Zalo, Telegram, WeChat...)
 */

const PHONE_PATTERNS: RegExp[] = [
  /\+\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{3,}[\s.-]?\d{3,}/,
  /\b0\d{8,10}\b/,
  /\b\d{10,14}\b/,
  /\(\d{2,4}\)\s*\d{3,}[\s.-]?\d{3,}/,
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const SOCIAL_PATTERNS: RegExp[] = [
  /\b(facebook|fb)\.com\S*/i,
  /\bfb\.me\/\S+/i,
  /\binstagram\.com\S*/i,
  /\binsta(gram)?\s*[\w.]+/i,
  /\bwechat\s*[\w.-]+/i,
  /\bweixin\s*[\w.-]+/i,
  /\bzalo\s*[\d\s.-]+/i,
  /\btelegram\s*[\w@.]+/i,
  /\bt\.me\/\S+/i,
  /\btiktok\.com\S*/i,
  /\btwitter\.com\S*/i,
  /\bx\.com\S*/i,
  /\blinkedin\.com\S*/i,
  /\bskype\s*[\w.-]+/i,
  /\bline\.me\S*/i,
  /\bwhatsapp\s*[\d\s.-]+/i,
  /\b(zalo|telegram|wechat|line)\s+[\d@\w.-]+/i,
  /\b[\d\s.-]+\s+(zalo|telegram|wechat|line)/i,
];

export function validateLessonQuestionContent(content: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = typeof content === "string" ? content.trim() : "";
  if (!trimmed || trimmed.length < 3) {
    return { valid: false, error: "Nội dung câu hỏi phải có ít nhất 3 ký tự" };
  }
  if (trimmed.length > 2000) {
    return { valid: false, error: "Nội dung không được quá 2000 ký tự" };
  }
  for (const p of PHONE_PATTERNS) {
    if (p.test(trimmed)) {
      return { valid: false, error: "Không được nhập số điện thoại" };
    }
  }
  if (EMAIL_PATTERN.test(trimmed)) {
    return { valid: false, error: "Không được nhập địa chỉ email" };
  }
  for (const p of SOCIAL_PATTERNS) {
    if (p.test(trimmed)) {
      return {
        valid: false,
        error: "Không được nhập tài khoản mạng xã hội (Facebook, Instagram, Zalo, Telegram, WeChat...)",
      };
    }
  }
  return { valid: true };
}
