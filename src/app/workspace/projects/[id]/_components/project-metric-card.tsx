/**
 * Single KPI tile used in the workspace project header strip. Tiny presentational
 * server component — lives next to the project page so the layout stays cohesive
 * but the parent route file isn't 700 lines long.
 */
export function ProjectMetricCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}
