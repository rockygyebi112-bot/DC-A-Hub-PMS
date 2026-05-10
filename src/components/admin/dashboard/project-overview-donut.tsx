export type DonutSegment = {
  key: "on_track" | "at_risk" | "delayed" | "not_started";
  label: string;
  value: number;
};

const COLORS: Record<DonutSegment["key"], string> = {
  on_track: "var(--status-on-track)",
  at_risk: "var(--status-at-risk)",
  delayed: "var(--status-delayed)",
  not_started: "var(--status-not-started)",
};

const DOT_CLASS: Record<DonutSegment["key"], string> = {
  on_track: "status-dot-on-track",
  at_risk: "status-dot-at-risk",
  delayed: "status-dot-delayed",
  not_started: "status-dot-not-started",
};

/** Polar-to-cartesian helpers for arc paths. */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, startAngle);
  const p2 = polar(cx, cy, rOuter, endAngle);
  const p3 = polar(cx, cy, rInner, endAngle);
  const p4 = polar(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

export function ProjectOverviewDonut({
  total,
  segments,
  filterLabel = "This Month",
}: {
  total: number;
  segments: DonutSegment[];
  filterLabel?: string;
}) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  const cx = 100;
  const cy = 100;
  const rOuter = 90;
  const rInner = 60;

  // Compute arc ranges immutably to keep React happy.
  const arcRanges = segments.reduce<{
    accum: number;
    items: { key: DonutSegment["key"]; start: number; end: number; value: number }[];
  }>(
    (state, seg) => {
      const start = (state.accum / sum) * 360;
      const next = state.accum + seg.value;
      const end = (next / sum) * 360;
      state.items.push({ key: seg.key, start, end, value: seg.value });
      return { accum: next, items: state.items };
    },
    { accum: 0, items: [] },
  ).items;
  const arcs = arcRanges.map((seg) => {
    if (seg.value === 0) return null;
    return (
      <path
        key={seg.key}
        d={arcPath(cx, cy, rOuter, rInner, seg.start, seg.end)}
        fill={COLORS[seg.key]}
      />
    );
  });

  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Project Overview
        </h2>
        <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {filterLabel}
        </span>
      </header>
      <div className="grid gap-4 px-4 pb-5 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-6 sm:px-5">
        <div className="relative mx-auto flex size-[148px] items-center justify-center sm:size-[200px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0">
            <circle cx={cx} cy={cy} r={rOuter} fill="var(--muted)" />
            {arcs}
            <circle cx={cx} cy={cy} r={rInner} fill="var(--card)" />
          </svg>
          <div className="relative flex flex-col items-center text-center">
            <span className="donut-center-value">{total}</span>
            <span className="mt-1 text-[11px] font-medium text-muted-foreground">
              Total
              <br />
              Projects
            </span>
          </div>
        </div>
        <ul className="space-y-2.5">
          {segments.map((seg) => {
            const pct = Math.round((seg.value / sum) * 100);
            return (
              <li
                key={seg.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex items-center gap-2.5">
                  <span className={`status-dot ${DOT_CLASS[seg.key]}`} />
                  <span className="text-foreground">{seg.label}</span>
                </span>
                <span className="font-medium tabular-nums text-muted-foreground">
                  <span className="text-foreground">{seg.value}</span>{" "}
                  <span className="text-muted-foreground">({pct}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
