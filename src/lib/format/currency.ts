/**
 * Centralised currency formatting via `Intl.NumberFormat`. Previously the
 * codebase concatenated `"GHS " + value.toFixed(2)` in a handful of places,
 * which:
 *   - missed locale grouping (1,234,567 vs 1234567)
 *   - couldn't be reused for non-GHS amounts if/when needed
 *   - made negatives + zeros render inconsistently
 *
 * Default currency is GHS (Ghana cedi) because that's the only one we
 * currently surface; pass an override for any future per-project currency
 * support.
 */

const APP_LOCALE = "en-GH";
const DEFAULT_CURRENCY = "GHS";

type Amount = number | string | null | undefined;

function toNumber(value: Amount): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * "GH₵ 1,234.56" — two fraction digits, locale-grouped, currency-symbol
 * prefixed. Use this in tables, KPI cards, and form summaries.
 */
export function formatCurrency(
  value: Amount,
  currency: string = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

/**
 * Compact variant — "GH₵ 1.2M" — for dashboards where horizontal space is
 * scarce and exact pesewas don't matter.
 */
export function formatCurrencyCompact(
  value: Amount,
  currency: string = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

/**
 * Plain number with locale grouping ("1,234,567"). Use for headcounts,
 * row counts, anything that isn't money.
 */
export function formatNumber(value: Amount): string {
  return new Intl.NumberFormat(APP_LOCALE).format(toNumber(value));
}
