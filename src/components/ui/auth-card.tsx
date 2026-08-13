interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Raised form card for the auth pages. It sits on the photographic stage
 * (see AuthStage), so unlike the rest of the app's cards it needs real
 * elevation and an opaque surface to hold its own against the image behind
 * it — `--card-shadow` is deliberately shallow for dense admin screens and is
 * far too quiet here.
 *
 * The logo lives in the auth layout's header, not in this card: on the stage
 * there is one logo for the whole page rather than one per surface.
 * Renders the title as the page's single h1.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.45)] sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
      {footer && (
        <div
          data-slot="auth-card-footer"
          className="mt-6 border-t border-border pt-5 text-sm"
        >
          {footer}
        </div>
      )}
    </div>
  );
}
