import { NextResponse } from "next/server";
import { listSearchableActivities } from "@/lib/search";
import { requireAuth } from "@/lib/auth/guards";

/**
 * Returns the activities the current user can search. Called by
 * `TopbarSearch` only on the first time the user opens the search dropdown,
 * so we keep the heavy join (activities -> phases -> projects, 200 rows)
 * off the layout's critical path. Cached briefly so a user that mashes
 * the search input doesn't refetch on every keystroke navigation.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  const activities = await listSearchableActivities(200, q).catch((err) => {
    console.error("[search/activities] query failed", err);
    return [];
  });
  return NextResponse.json(activities, {
    headers: {
      // Vary by query so a server-filtered result isn't served for a different
      // term from the browser cache.
      "Cache-Control": "private, max-age=60",
      Vary: "Cookie",
    },
  });
}
