import Image from "next/image";

/**
 * Decorative brand panel shown on the left of the auth split-screen on lg+.
 * A background image fills the panel, darkened by a navy overlay so the logo
 * and tagline stay readable. aria-hidden because AuthCard duplicates the logo
 * for non-decorative use.
 *
 */
export function AuthBrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden bg-secondary lg:flex lg:w-[40%] lg:flex-col lg:justify-between lg:p-12"
    >
      <Image
        src="/login.jpg"
        alt=""
        fill
        priority
        sizes="40vw"
        className="object-cover"
      />
      {/* Navy overlay keeps the brand colour dominant and text legible. */}
      <div className="absolute inset-0 bg-secondary/75" />

      <Image
        src="/logo.png"
        alt=""
        width={1030}
        height={518}
        priority
        className="relative z-10 h-14 w-auto self-start"
      />
      <div className="relative z-10 space-y-4">
        <div className="h-px w-12 bg-white/25" />
        <p className="font-heading text-xl font-medium leading-snug text-white">
          Project Management System
        </p>
      </div>
      <p className="relative z-10 text-xs text-white/50">© DC&amp;A Hub</p>
    </aside>
  );
}
