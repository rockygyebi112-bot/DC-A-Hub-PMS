/**
 * Completion arithmetic, in one place.
 *
 * `total === 0 ? 0 : Math.round((done / total) * 100)` was written out
 * verbatim in seven components across admin, workspace and portal, with four
 * more near-variants elsewhere. Each copy re-decided the same three edge
 * cases, and not always the same way: some clamped the result, some didn't,
 * and none guarded a `done` larger than `total` (which the workplan importer
 * can produce when activities are removed after completion).
 */

/**
 * Percent complete, 0-100, rounded to a whole number.
 *
 * An empty denominator yields 0 rather than NaN — "nothing planned" reads as
 * no progress, not as broken output. The result is clamped to [0, 100] so a
 * stale `done` count can never render a 140%-wide progress bar.
 */
export function completionPercent(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0;
  const pct = Math.round((done / total) * 100);
  return Math.min(100, Math.max(0, pct));
}

/**
 * Percent of a budget consumed. Separate from `completionPercent` because
 * overspend is real information: this one reports past 100% (capped at 999 so
 * a mis-keyed figure cannot break the layout) instead of clamping it away.
 */
export function spendPercent(spent: number, allocated: number): number {
  if (!Number.isFinite(spent) || !Number.isFinite(allocated) || allocated <= 0) {
    return 0;
  }
  return Math.min(999, Math.max(0, Math.round((spent / allocated) * 100)));
}
