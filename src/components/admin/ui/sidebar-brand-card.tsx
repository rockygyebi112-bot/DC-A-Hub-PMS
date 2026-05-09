/**
 * Branded informational footer card displayed at the bottom of the
 * navy sidebar. Mirrors the DC&A Hub brand card with a tagline and a
 * subtle dotted graphic inspired by the logo pattern.
 */
export function SidebarBrandCard() {
  return (
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
  );
}
