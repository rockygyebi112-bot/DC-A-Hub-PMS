import { NextResponse } from "next/server";
import { listSearchableOrgs } from "@/lib/search";
import { requireAuth } from "@/lib/auth/guards";

/**
 * Slim project + client list for the topbar search dropdown. Called by
 * `TopbarSearch` lazily on first focus so the layout doesn't have to
 * serialise the full roster into the RSC payload on every navigation.
 *
 * RLS scopes results to what the caller can see, so this is safe across
 * surfaces (admin / staff / client / viewer).
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  const orgs = await listSearchableOrgs(500, q).catch((err) => {
    console.error("[search/orgs] query failed", err);
    return { projects: [], clients: [] };
  });
  return NextResponse.json(orgs, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
