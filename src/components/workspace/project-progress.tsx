export function ProjectProgress({
  done,
  total,
  unit = 'activities',
}: {
  done: number;
  total: number;
  unit?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{percent}% complete</span>
        <span className="text-muted-foreground">
          {done}/{total} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

