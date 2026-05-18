/**
 * Shared pagination helpers used by every server-paginated admin list.
 * Keep page-size constants here so all consumers (queries, UI, links) read
 * the same value and pages can't drift apart.
 */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/**
 * Parse `?page=N` from a URLSearchParams-shaped object. Caller-supplied
 * values that aren't positive integers fall back to page 1 so a malformed
 * URL never throws or hits negative offsets.
 */
export function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  // Guard against pathological `?page=999999999`. PostgREST silently returns
  // empty pages past the end but we'd still pay a round-trip — clamp at
  // 100k pages which is well past any realistic list size.
  return Math.min(n, 100_000);
}

export type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  offset: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export function computePageInfo(
  page: number,
  totalCount: number,
  pageSize = DEFAULT_PAGE_SIZE,
): PageInfo {
  const size = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalCount / size));
  const clamped = Math.min(Math.max(page, 1), totalPages);
  return {
    page: clamped,
    pageSize: size,
    totalCount,
    totalPages,
    offset: (clamped - 1) * size,
    hasPrev: clamped > 1,
    hasNext: clamped < totalPages,
  };
}
