export type HealthBucket = {
  key: "on_track" | "at_risk" | "delayed" | "not_started";
  label: string;
  value: number;
};

const COLORS: Record<HealthBucket["key"], string> = {
  on_track: "var(--status-on-track)",
  at_risk: "var(--status-at-risk)",
  delayed: "var(--status-delayed)",
  not_started: "var(--status-not-started)",
};

const DOT: Record<HealthBucket["key"], string> = {
  on_track: "status-dot-on-track",
  at_risk: "status-dot-at-risk",
  delayed: "status-dot-delayed",
  not_started: "status-dot-not-started",
};

export function ProjectHealthSummary({
  buckets,
}: {
  buckets: HealthBucket[];
}) {
  const total = buckets.reduce((acc, b) => acc + b.value, 0) || 1;

  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Project Health Summary
        </h2>
      </header>
      <div className="px-4 pb-5 sm:px-5">
        <div className="status-bar">
          {buckets.map((b) => {
            const pct = (b.value / total) * 100;
            if (pct === 0) return null;
            return (
              <span
                key={b.key}
                style={{ width: `${pct}%`, background: COLORS[b.key] }}
              />
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-y-3 sm:grid-cols-4">
          {buckets.map((b) => {
            const pct = Math.round((b.value / total) * 100);
            return (
              <div key={b.key} className="space-y-1">
                <p className="stat-number text-xl leading-none">{b.value}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`status-dot ${DOT[b.key]}`} />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {b.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
