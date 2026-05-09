/**
 * Branded informational footer stack displayed at the bottom of the
 * navy sidebar. Renders one tile per active client, using the
 * client's uploaded logo (falling back to initials).
 */
export type SidebarClient = {
  id: string;
  name: string;
  logo_url: string | null;
};

function initialsOf(name: string) {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function SidebarBrandCard({ clients }: { clients: SidebarClient[] }) {
  if (!clients || clients.length === 0) return null;

  return (
    <div className="space-y-3">
      {clients.slice(0, 4).map((c) => (
        <div
          key={c.id}
          className="relative overflow-hidden rounded-[14px] border border-white/10 bg-[hsl(225_60%_12%)]/85 px-4 py-4 shadow-inner"
        >
          <div className="relative z-10 flex flex-col items-center gap-2 text-center">
            {c.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.logo_url}
                alt={`${c.name} logo`}
                className="h-12 w-auto max-w-[80%] object-contain"
              />
            ) : (
              <span
                aria-hidden
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white"
              >
                {initialsOf(c.name)}
              </span>
            )}
            <p className="text-[12px] font-semibold leading-tight text-white">
              {c.name}
            </p>
          </div>
          <div
            aria-hidden
            className="brand-dot-pattern pointer-events-none absolute -bottom-3 -left-3 h-16 w-16 rounded-br-full"
          />
          <div
            aria-hidden
            className="brand-dot-pattern pointer-events-none absolute -top-3 -right-3 h-12 w-12 rounded-bl-full"
          />
        </div>
      ))}
    </div>
  );
}
