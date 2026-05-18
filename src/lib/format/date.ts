/**
 * Centralised date formatting with a FIXED timezone and locale.
 *
 * Problem this solves: server-rendered output ran with UTC while the
 * client re-rendered with the user's local zone, producing hydration
 * mismatches near midnight (a "5 May 2026" SSR'd row could flip to
 * "6 May 2026" after rehydration). `new Date(iso).toLocaleDateString()`
 * was sprinkled across dozens of files with no timezone argument; this
 * module gives the codebase a single, deterministic surface to call.
 *
 * The fixed zone is Accra (UTC+00, no DST) because DC&A Hub serves Ghana.
 * Override via the optional `timeZone` parameter for the rare per-call
 * exception. Locale is fixed too (`en-GB` for DD/MM ordering which matches
 * the workplan template's expected format).
 */

const APP_TIMEZONE = "Africa/Accra";
const APP_LOCALE = "en-GB";

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "5 May 2026" — short, unambiguous, no locale surprises.
 * Defaults to `{ day: "numeric", month: "short", year: "numeric" }`.
 */
export function formatDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  timeZone: string = APP_TIMEZONE,
): string {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone }).format(d);
}

/** "5 May 2026, 14:32" */
export function formatDateTime(
  value: DateInput,
  timeZone: string = APP_TIMEZONE,
): string {
  return formatDate(
    value,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
    timeZone,
  );
}

/** "14:32" */
export function formatTime(
  value: DateInput,
  timeZone: string = APP_TIMEZONE,
): string {
  return formatDate(
    value,
    { hour: "2-digit", minute: "2-digit", hour12: false },
    timeZone,
  );
}

/** Relative phrase: "today", "yesterday", "3 days ago", "in 2 weeks". */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return "";
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";

  const rtf = new Intl.RelativeTimeFormat(APP_LOCALE, { numeric: "auto" });
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day");
  if (Math.abs(diffDays) < 30) return rtf.format(Math.round(diffDays / 7), "week");
  if (Math.abs(diffDays) < 365) return rtf.format(Math.round(diffDays / 30), "month");
  return rtf.format(Math.round(diffDays / 365), "year");
}
