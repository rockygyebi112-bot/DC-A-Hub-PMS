import Image from "next/image";

/**
 * Full-bleed background for the auth pages: a field photograph, desaturated
 * and tinted toward the brand navy, behind a diagonal veil that keeps the
 * form card legible wherever it lands.
 *
 * The duotone is CSS rather than a baked asset so the tint follows
 * `--secondary` if the brand shifts. `isolation: isolate` on the wrapper is
 * load-bearing: `mix-blend-mode` blends against everything in its stacking
 * context, so without it the tint layer would blend with the page behind the
 * stage instead of only with the photograph.
 *
 * Entirely decorative — `alt=""` plus `aria-hidden`, because the page's
 * meaning lives in the form, and the photograph carries no information a
 * screen-reader user needs in order to sign in.
 */
export function AuthStage() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 isolate overflow-hidden bg-secondary"
    >
      <Image
        src="/login.jpg"
        alt=""
        fill
        priority
        // The only image on the page, and it covers the viewport at every
        // breakpoint, so it is always the LCP element.
        sizes="100vw"
        quality={70}
        className="object-cover object-[50%_38%] grayscale"
      />

      {/* Duotone: paints the navy hue onto the greyscale photograph while
          keeping its luminance, which is what separates a tint from a wash. */}
      <div className="absolute inset-0 bg-secondary mix-blend-color" />

      {/* Veil. Heaviest on the side the card sits, lightest on the side the
          subjects occupy, so the photograph still reads as a photograph. */}
      <div className="absolute inset-0 bg-linear-105 from-secondary/90 from-25% to-secondary/45" />

      {/* Lifts the very bottom so the footer line keeps its contrast. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-secondary/70 to-transparent" />
    </div>
  );
}
