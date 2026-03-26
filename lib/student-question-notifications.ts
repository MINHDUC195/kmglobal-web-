export type QuestionReplySummaryItem = {
  questionId: string;
  latestAdminReplyAt: string;
};

const STORAGE_KEY = "kmg.student.questions.seen.adminReplyAt";
const EVENT_NAME = "kmg:student-questions-seen-changed";

function safeParse(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function readSeenMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeSeenMap(next: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getSeenAt(questionId: string): string | null {
  const map = readSeenMap();
  return map[questionId] ?? null;
}

export function markQuestionSeen(questionId: string, latestAdminReplyAt: string) {
  const map = readSeenMap();
  map[questionId] = latestAdminReplyAt;
  writeSeenMap(map);
}

export function computeUnreadCount(items: QuestionReplySummaryItem[]): number {
  if (!items.length) return 0;
  const map = readSeenMap();
  let count = 0;
  for (const item of items) {
    const seenAt = map[item.questionId];
    if (!seenAt || Date.parse(seenAt) < Date.parse(item.latestAdminReplyAt)) {
      count += 1;
    }
  }
  return count;
}

export function getSeenChangedEventName() {
  return EVENT_NAME;
}
