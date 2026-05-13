import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

/**
 * Root entry point. Routes the user to the right surface based on role.
 *
 * The proxy used to handle this via `decideRedirect`, but it's now a
 * cookie-only check (no Supabase round-trips at the edge) so role-based
 * routing has to happen here. Without this, `router.push("/")` after a
 * successful login would land back on `/login` and loop.
 */
export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "staff") redirect("/workspace");
  redirect("/portal");
}
