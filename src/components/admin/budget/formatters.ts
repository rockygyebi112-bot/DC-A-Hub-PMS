import { formatCurrency } from "@/lib/format/currency";
import { formatDate as formatDateBase } from "@/lib/format/date";

/**
 * Budget surfaces previously concatenated `"GHS " + value.toFixed(2)` and
 * called `toLocaleDateString(undefined, ...)` (which produced UTC-vs-local
 * hydration mismatches near midnight). Both now delegate to the central
 * `lib/format/*` helpers so the whole app shares one locale + timezone.
 *
 * Kept as named re-exports so existing call sites import unchanged.
 */
export function formatMoney(amount: number, currency = "GHS") {
  return formatCurrency(amount, currency);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return formatDateBase(value) || value;
}
