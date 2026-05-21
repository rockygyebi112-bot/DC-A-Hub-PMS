import { Card } from '@/components/ui/card';

export function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
      ) : null}
    </Card>
  );
}
