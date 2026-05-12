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
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const activities = await listSearchableActivities(200).catch(() => []);
  return NextResponse.json(activities, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
