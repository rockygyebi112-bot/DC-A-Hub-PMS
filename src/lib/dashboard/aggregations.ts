/**
 * Dashboard data aggregation utilities
 * Extracts counting logic from executive-dashboard.tsx for testability and reuse
 */

import type {
  EnterpriseSpotlightEntry,
  MediaProgramEntry,
  AbsaOnboardingEntry,
} from "@/lib/types";

/** Media entry with platform metrics */
export interface MediaMetrics {
  facebook: { views: number; shares: number; saves: number; likes: number } | undefined;
  youtube: { views: number; shares: number; saves: number; likes: number } | undefined;
}

/** Count entries by a field value */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function countByField<T extends Record<string, any>>(
  entries: T[],
  field: keyof T
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const val = entry[field];
    if (val === null || val === undefined || val === "") continue;
    const key = String(val);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/** Aggregate gender counts across multiple entry types */
export function aggregateGenderCounts(options: {
  esEntries?: EnterpriseSpotlightEntry[];
  vuEntries?: MediaProgramEntry[];
  hangoutEntries?: MediaProgramEntry[];
  absaEntries?: AbsaOnboardingEntry[];
  showES?: boolean;
  showVU?: boolean;
  showHangout?: boolean;
  showABSA?: boolean;
}): Record<string, number> {
  const { esEntries = [], vuEntries = [], hangoutEntries = [], absaEntries = [], showES, showVU, showHangout, showABSA } = options;
  const counts: Record<string, number> = {};

  if (showES) {
    for (const e of esEntries) {
      if (e.gender) counts[e.gender] = (counts[e.gender] || 0) + 1;
    }
  }

  if (showVU) {
    for (const e of vuEntries) {
      for (const [k, v] of Object.entries(e.demographics?.gender ?? {})) {
        counts[k] = (counts[k] || 0) + v;
      }
    }
  }

  if (showHangout) {
    for (const e of hangoutEntries) {
      for (const [k, v] of Object.entries(e.demographics?.gender ?? {})) {
        counts[k] = (counts[k] || 0) + v;
      }
    }
  }

  if (showABSA) {
    for (const e of absaEntries) {
      if (e.gender) counts[e.gender] = (counts[e.gender] || 0) + 1;
    }
  }

  return counts;
}

/** Age bracket counts aggregated by program (for grouped charts) */
export function aggregateAgeBracketByProgram(options: {
  esEntries?: EnterpriseSpotlightEntry[];
  vuEntries?: MediaProgramEntry[];
  hangoutEntries?: MediaProgramEntry[];
  absaEntries?: AbsaOnboardingEntry[];
  showES?: boolean;
  showVU?: boolean;
  showHangout?: boolean;
  showABSA?: boolean;
}): { name: string; data: Record<string, number> }[] {
  const { esEntries = [], vuEntries = [], hangoutEntries = [], absaEntries = [], showES, showVU, showHangout, showABSA } = options;
  const series: { name: string; data: Record<string, number> }[] = [];

  if (showES) {
    series.push({ name: "Enterprise Spotlight", data: countByField(esEntries, "age_bracket") });
  }

  if (showVU) {
    const counts: Record<string, number> = {};
    for (const e of vuEntries) {
      for (const [k, v] of Object.entries(e.demographics?.age_brackets ?? {})) {
        counts[k] = (counts[k] || 0) + v;
      }
    }
    series.push({ name: "Virtual University", data: counts });
  }

  if (showHangout) {
    const counts: Record<string, number> = {};
    for (const e of hangoutEntries) {
      for (const [k, v] of Object.entries(e.demographics?.age_brackets ?? {})) {
        counts[k] = (counts[k] || 0) + v;
      }
    }
    series.push({ name: "Hangout", data: counts });
  }

  if (showABSA) {
    series.push({ name: "ABSA Onboarding", data: countByField(absaEntries, "age_bracket") });
  }

  return series;
}

/** Disability status counts (ES + ABSA) */
export function aggregateDisabilityCounts(
  esEntries: EnterpriseSpotlightEntry[],
  absaEntries: AbsaOnboardingEntry[],
  showES?: boolean,
  showABSA?: boolean
): Record<string, number> {
  const counts: Record<string, number> = {};

  if (showES) {
    for (const e of esEntries) {
      if (e.disability_status) {
        counts[e.disability_status] = (counts[e.disability_status] || 0) + 1;
      }
    }
  }

  if (showABSA) {
    for (const e of absaEntries) {
      if (e.disability_status) {
        counts[e.disability_status] = (counts[e.disability_status] || 0) + 1;
      }
    }
  }

  return counts;
}

/** Region counts (ES + ABSA) */
export function aggregateRegionCounts(
  esEntries: EnterpriseSpotlightEntry[],
  absaEntries: AbsaOnboardingEntry[],
  showES?: boolean,
  showABSA?: boolean
): Record<string, number> {
  const counts: Record<string, number> = {};

  if (showES) {
    for (const e of esEntries) {
      if (e.region) counts[e.region] = (counts[e.region] || 0) + 1;
    }
  }

  if (showABSA) {
    for (const e of absaEntries) {
      if (e.region) counts[e.region] = (counts[e.region] || 0) + 1;
    }
  }

  return counts;
}

/** Calculate total media views for a media entry */
export function totalMediaViews(entry: MediaProgramEntry): number {
  let total = 0;
  if (entry.metrics?.facebook) total += entry.metrics.facebook.views;
  if (entry.metrics?.youtube) total += entry.metrics.youtube.views;
  return total;
}

/** Media platform view totals */
export function aggregatePlatformViews(
  vuEntries: MediaProgramEntry[],
  hangoutEntries: MediaProgramEntry[],
  showVU?: boolean,
  showHangout?: boolean
): { Facebook: number; YouTube: number } {
  let facebookTotal = 0;
  let youtubeTotal = 0;

  const entries: MediaProgramEntry[] = [];
  if (showVU) entries.push(...vuEntries);
  if (showHangout) entries.push(...hangoutEntries);

  for (const e of entries) {
    if (e.metrics?.facebook) facebookTotal += e.metrics.facebook.views;
    if (e.metrics?.youtube) youtubeTotal += e.metrics.youtube.views;
  }

  return { Facebook: facebookTotal, YouTube: youtubeTotal };
}

/** Time-series data for media views */
export function aggregateMediaViewsByPeriod(
  vuEntries: MediaProgramEntry[],
  hangoutEntries: MediaProgramEntry[],
  granularity: "week" | "month" | "quarter",
  showVU?: boolean,
  showHangout?: boolean
): { name: string; data: Record<string, number> }[] {
  const series: { name: string; data: Record<string, number> }[] = [];

  if (showVU) {
    const groups = groupByGranularity(vuEntries, "date_aired", granularity);
    const totals: Record<string, number> = {};
    for (const [period, items] of Object.entries(groups)) {
      totals[period] = items.reduce((sum, e) => sum + totalMediaViews(e), 0);
    }
    series.push({ name: "Virtual University", data: totals });
  }

  if (showHangout) {
    const groups = groupByGranularity(hangoutEntries, "date_aired", granularity);
    const totals: Record<string, number> = {};
    for (const [period, items] of Object.entries(groups)) {
      totals[period] = items.reduce((sum, e) => sum + totalMediaViews(e), 0);
    }
    series.push({ name: "Hangout", data: totals });
  }

  return series;
}

/** Episode counts by period */
export function aggregateEpisodeCountsByPeriod(
  vuEntries: MediaProgramEntry[],
  hangoutEntries: MediaProgramEntry[],
  granularity: "week" | "month" | "quarter",
  showVU?: boolean,
  showHangout?: boolean
): { name: string; data: Record<string, number> }[] {
  const series: { name: string; data: Record<string, number> }[] = [];

  if (showVU) {
    const groups = groupByGranularity(vuEntries, "date_aired", granularity);
    const counts: Record<string, number> = {};
    for (const [period, items] of Object.entries(groups)) {
      counts[period] = items.length;
    }
    series.push({ name: "Virtual University", data: counts });
  }

  if (showHangout) {
    const groups = groupByGranularity(hangoutEntries, "date_aired", granularity);
    const counts: Record<string, number> = {};
    for (const [period, items] of Object.entries(groups)) {
      counts[period] = items.length;
    }
    series.push({ name: "Hangout", data: counts });
  }

  return series;
}

// Time grouping utilities (copied from chart-builders to avoid circular deps)
export type Granularity = "week" | "month" | "quarter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByGranularity<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T,
  granularity: Granularity
): Record<string, T[]> {
  switch (granularity) {
    case "week":
      return groupByWeek(entries, dateField);
    case "quarter":
      return groupByQuarter(entries, dateField);
    default:
      return groupByMonth(entries, dateField);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByMonth<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const entry of entries) {
    const dateVal = entry[dateField];
    if (!dateVal) continue;
    const month = String(dateVal).slice(0, 7); // "2026-04"
    if (!groups[month]) groups[month] = [];
    groups[month].push(entry);
  }
  return groups;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByWeek<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const entry of entries) {
    const dateVal = entry[dateField];
    if (!dateVal) continue;
    const d = new Date(String(dateVal));
    if (isNaN(d.getTime())) continue;
    const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const year = day.getUTCFullYear();
    const weekStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((day.getTime() - weekStart.getTime()) / 86400000 + 1) / 7);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByQuarter<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const entry of entries) {
    const dateVal = entry[dateField];
    if (!dateVal) continue;
    const d = new Date(String(dateVal));
    if (isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const quarter = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${year}-Q${quarter}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}
