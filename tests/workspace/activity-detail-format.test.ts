import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  formatBytes,
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatShortDate,
  formatTimestamp,
} from "@/components/workspace/activity-detail-view/format";

/**
 * Locale-sensitive formatters change output across CI machines (en-US vs
 * en-GB, "Sept" vs "Sep"). We pin the system clock and only assert on the
 * structural pieces — separators, day numbers, "Today"/"Yesterday" prefixes
 * — that are deterministic across locales.
 */

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [10 * 1024, "10 KB"],
    [1024 * 1024, "1.0 MB"],
    [5_500_000, "5.2 MB"],
  ])("formats %i bytes as %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it("returns null when either bound is missing", () => {
    expect(formatDuration(null, "2026-05-10")).toBeNull();
    expect(formatDuration("2026-05-10", null)).toBeNull();
    expect(formatDuration(null, null)).toBeNull();
  });

  it("returns 'Same day' when start === end", () => {
    expect(formatDuration("2026-05-10", "2026-05-10")).toBe("Same day");
  });

  it("singularises one day", () => {
    expect(formatDuration("2026-05-10", "2026-05-11")).toBe("1 day");
  });

  it("pluralises multi-day spans", () => {
    expect(formatDuration("2026-05-10", "2026-05-17")).toBe("7 days");
  });

  it("clamps negative spans to zero (treats as same-day)", () => {
    expect(formatDuration("2026-05-20", "2026-05-10")).toBe("Same day");
  });
});

describe("formatDateRange", () => {
  it("returns the not-scheduled fallback when both bounds are null", () => {
    expect(formatDateRange(null, null)).toBe("Not scheduled");
  });

  it("includes an em-dash separator and a year", () => {
    const out = formatDateRange("2026-05-10", "2026-05-20");
    expect(out).toMatch(/–/);
    expect(out).toMatch(/2026/);
  });

  it("renders an em-dash placeholder for the missing bound", () => {
    expect(formatDateRange("2026-05-10", null)).toMatch(/—/);
    expect(formatDateRange(null, "2026-05-10")).toMatch(/—/);
  });
});

describe("formatDateTime / formatShortDate", () => {
  it("passes the raw value through when input is unparseable", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
    expect(formatShortDate("garbage")).toBe("garbage");
  });

  it("includes the year in the rendered output", () => {
    expect(formatDateTime("2026-05-10T15:30:00Z")).toMatch(/2026/);
    expect(formatShortDate("2026-05-10T15:30:00Z")).toMatch(/2026/);
  });
});

describe("formatTimestamp", () => {
  // Pin "now" so the same-day / yesterday branches are deterministic
  // regardless of when the suite runs.
  const NOW = new Date("2026-05-16T12:00:00Z");

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("renders 'Today at <time>' for same-day inputs", () => {
    const out = formatTimestamp("2026-05-16T09:30:00Z");
    expect(out.startsWith("Today at ")).toBe(true);
  });

  it("renders 'Yesterday at <time>' for the prior calendar day", () => {
    const out = formatTimestamp("2026-05-15T09:30:00Z");
    expect(out.startsWith("Yesterday at ")).toBe(true);
  });

  it("falls back to a full date for older timestamps", () => {
    const out = formatTimestamp("2026-04-01T09:30:00Z");
    expect(out.startsWith("Today")).toBe(false);
    expect(out.startsWith("Yesterday")).toBe(false);
    expect(out).toMatch(/2026/);
  });
});
