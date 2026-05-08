import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-sm transition-colors hover:bg-accent/30">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className={cn("block")}>
      {body}
    </Link>
  );
}
