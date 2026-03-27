/** Múi giờ VN (không DST) — dùng cho biên ngày 00:00:00 / 23:59:59 khi cần khớp trigger DB. */
export const VN_TIMEZONE = "Asia/Ho_Chi_Minh";
const VN_OFFSET = "+07:00";

function vnCalendarParts(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
}

/** Đầu ngày lịch VN (00:00:00 +07:00). */
export function startOfVnDay(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : new Date(input.getTime());
  const parts = vnCalendarParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (!y || !m || !day) return d;
  return new Date(
    `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000${VN_OFFSET}`
  );
}

/** Cuối ngày lịch VN (23:59:59.999 +07:00). */
export function endOfVnDay(input: Date | string): Date {
  const start = startOfVnDay(input);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}
