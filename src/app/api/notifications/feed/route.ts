import { NextResponse } from "next/server";
import { getNotificationFeed } from "@/lib/notifications/queries";
import { requireAuth } from "@/lib/auth/guards";

/**
 * Returns the current user's notification feed for the requested
 * surface (workspace or portal). Called by `NotificationsBell` on
 * mount and after realtime events, so the layout doesn't have to pay
 * for the 5 supabase round-trips needed to assemble this feed on
 * every page navigation.
 *
 * Cached briefly per-user so back-to-back navigations or rapid bell
 * re-mounts don't refetch. Realtime events still bust this via the
 * client's own refresh logic.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const surfaceParam = url.searchParams.get("surface");
  const surface: "portal" | "workspace" =
    surfaceParam === "portal" ? "portal" : "workspace";

  const feed = await getNotificationFeed(surface).catch(() => ({
    entries: [],
    unreadCount: 0,
    lastReadAt: null,
  }));

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "private, max-age=15",
    },
  });
}
