import Image from "next/image";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Form-side card for the auth pages. Flat surface (no gradient stripe, no
 * grain). Shows a small logo on mobile only — on lg+ the brand panel carries
 * the logo. Renders the title as the page's single h1.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm">
      <Image
        src="/logo.png"
        alt="DC&A Hub"
        width={180}
        height={52}
        priority
        className="mb-8 h-12 w-auto lg:hidden"
      />
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
