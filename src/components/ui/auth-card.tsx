interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Frosted form card for the auth pages. It floats on the photographic stage
 * (see AuthStage) and samples it through a backdrop blur, so the surface,
 * its elevation and its whole light-on-dark token set come from the
 * `.auth-glass` scope in globals.css rather than the theme.
 *
 * The logo lives in the auth layout's header, not in this card: on the stage
 * there is one logo for the whole page rather than one per surface.
 * Renders the title as the page's single h1.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="auth-glass w-full max-w-sm rounded-3xl p-6 sm:p-8">
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
