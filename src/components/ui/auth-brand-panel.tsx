import Image from "next/image";

/**
 * Decorative brand panel shown on the left of the auth split-screen on lg+.
 * Solid navy, light logo, tagline, footer line. aria-hidden because
 * AuthCard duplicates the logo for non-decorative use.
 *
 * NOTE: /logo-light.svg is a dummy placeholder wordmark. Replace it with the
 * real reversed-out (white) DC&A Hub logo when available.
 */
export function AuthBrandPanel() {
  return (
    <aside
      aria-hidden
      className="hidden bg-secondary lg:flex lg:w-[40%] lg:flex-col lg:justify-between lg:p-12"
    >
      <Image
        src="/logo-light.svg"
        alt=""
        width={280}
        height={72}
        priority
        className="h-14 w-auto"
      />
      <div className="space-y-4">
        <div className="h-px w-12 bg-white/25" />
        <p className="font-heading text-xl font-medium leading-snug text-white">
          Project Management System
        </p>
      </div>
      <p className="text-xs text-white/50">© DC&amp;A Hub</p>
    </aside>
  );
}
