/**
 * Resolve the canonical public URL for this deployment.
 *
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL (explicit, used in production)
 *  2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL (auto-injected by Vercel)
 *  3. http://localhost:3000 (local dev only)
 *
 * Used for invite redirect URLs, transactional email links, etc., so we do
 * NOT want to accidentally ship a localhost link from a Vercel deployment.
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) return `https://${stripTrailingSlash(vercelProd)}`;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${stripTrailingSlash(vercel)}`;

  return "http://localhost:3000";
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
