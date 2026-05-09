/**
 * Branded informational footer stack displayed at the bottom of the
 * navy sidebar. Renders the DC&A Hub tagline tile, plus a client
 * identity tile (Ministry of Local Government, with the Ghana coat
 * of arms) styled as a premium institutional card.
 */
export function SidebarBrandCard() {
  return (
    <div className="space-y-3">
      {/* DCA & Hub tagline */}
      <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-[hsl(225_60%_14%)]/80 p-4 shadow-inner">
        <div className="relative z-10">
          <p className="text-sm font-semibold tracking-tight text-[var(--color-dca-cyan-400)]">
            DCA &amp; HUB
          </p>
          <p className="mt-1 text-[11px] leading-snug text-white/70">
            Driving Collaboration.
            <br />
            Accelerating Impact.
          </p>
        </div>
        <div
          aria-hidden
          className="brand-dot-pattern pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 rounded-tl-full"
        />
      </div>

      {/* Client identity tile */}
      <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-[hsl(225_60%_12%)]/85 px-4 py-4 shadow-inner">
        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/ghana-coat-of-arms.svg"
            alt="Ghana coat of arms"
            className="h-12 w-auto"
          />
          <p className="text-[12px] font-semibold leading-tight text-white">
            Ministry of Local
            <br />
            Government
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
    </div>
  );
}
