export const DEFAULT_LIST_PAGE_SIZE = 20;

export function parsePageParam(raw: string | null | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function parsePageSizeParam(
  raw: string | null | undefined,
  max = 100
): number {
  const n = Number.parseInt(raw ?? String(DEFAULT_LIST_PAGE_SIZE), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIST_PAGE_SIZE;
  return Math.min(n, max);
}

export function totalPagesFromCount(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  return Math.min(Math.max(1, page), totalPages);
}
