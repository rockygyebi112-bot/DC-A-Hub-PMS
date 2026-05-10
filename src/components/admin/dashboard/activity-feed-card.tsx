import Link from "next/link";

export type ActivityFeedRow = {
  id: string;
  actorName: string;
  message: string; // post-actor message, e.g. "updated the progress of …"
  createdAt: string; // ISO
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function relative(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

const AVATAR_PALETTE = [
  "bg-[var(--color-dca-blue-100)] text-[var(--color-dca-blue-700)]",
  "bg-[hsl(160_65%_94%)] text-[hsl(160_64%_28%)]",
  "bg-[hsl(38_92%_92%)] text-[hsl(38_92%_32%)]",
  "bg-[hsl(265_80%_94%)] text-[hsl(265_60%_42%)]",
  "bg-[var(--color-dca-cyan-50)] text-[var(--color-dca-cyan-600)]",
];

function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function ActivityFeedCard({
  items,
  viewAllHref,
}: {
  items: ActivityFeedRow[];
  viewAllHref?: string;
}) {
  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Activity Feed
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </header>
      <ul className="divide-y border-t">
        {items.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            No recent activity.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${paletteFor(
                  item.actorName,
                )}`}
              >
                {initials(item.actorName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{item.actorName}</span>{" "}
                  <span className="text-muted-foreground">{item.message}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {relative(item.createdAt)}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
