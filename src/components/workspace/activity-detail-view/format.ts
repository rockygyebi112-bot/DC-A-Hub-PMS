/**
 * Pure date / size formatters used by the activity-detail sub-components.
 * Kept dependency-free so unit tests can exercise edge cases without
 * pulling in React or any DOM/fetch shims.
 */

export function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "Not scheduled";
  const fmt = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString(undefined, {
          month: "short",
          day: "2-digit",
        })
      : "—";
  const year = new Date(end ?? start ?? Date.now()).getFullYear();
  return `${fmt(start)} – ${fmt(end)}, ${year}`;
}

export function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  const diff = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
  if (diff === 0) return "Same day";
  return `${diff} day${diff === 1 ? "" : "s"}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
