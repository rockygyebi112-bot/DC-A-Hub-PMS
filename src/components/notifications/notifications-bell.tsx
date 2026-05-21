"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "@/lib/notifications/actions";
import { actionLabel } from "@/lib/notifications/labels";
import type { NotificationFeed } from "@/lib/notifications/queries";

function formatRelative(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Self-loading notifications bell.
 *
 * PERF: this used to receive its data via SSR props from each protected
 * layout — `getCachedNotificationFeed()` issued ~5 supabase round-trips on
 * every page navigation, on the critical render path. The bell is now a
 * pure client-side component that fetches `/api/notifications/feed` once
 * on mount, keeps the result hot via realtime + a sessionStorage hint,
 * and never blocks SSR. Edge cost per page navigation: zero.
 */
export function NotificationsBell({
  surface,
}: {
  surface: "workspace" | "portal";
}) {
  const cacheKey = `notifications-bell:${surface}`;
  // Both server and client start with the empty feed so SSR output matches
  // the initial client render. The cached snapshot is rehydrated in a
  // useEffect below; the fetch then refreshes it. Reading sessionStorage in
  // the lazy initializer would cause a hydration mismatch (server has 0
  // unread, client mounts with N).
  const [feed, setFeed] = useState<NotificationFeed>({
    entries: [],
    unreadCount: 0,
    lastReadAt: null,
  });
  // Optimistic overlay: when the user clicks "Mark read" the badge zeroes
  // and rows lose their unread style instantly while the server action runs
  // in the background. If the action throws, the optimistic state reverts.
  const [optimisticFeed, applyOptimistic] = useOptimistic(
    feed,
    (state, action: "markAllRead") => {
      if (action === "markAllRead") {
        return {
          ...state,
          unreadCount: 0,
          lastReadAt: new Date().toISOString(),
        };
      }
      return state;
    },
  );
  const { entries, unreadCount, lastReadAt } = optimisticFeed;

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(cacheKey);
      if (raw) setFeed(JSON.parse(raw) as NotificationFeed);
    } catch {
      // sessionStorage may be unavailable (private mode, quota) — non-fatal.
    }
  }, [cacheKey]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(
        `/api/notifications/feed?surface=${surface}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as NotificationFeed;
      setFeed(data);
      try {
        window.sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        // sessionStorage may be unavailable (private mode, quota) — non-fatal.
      }
    } catch {
      // best-effort; keep the cached feed
    } finally {
      inFlight.current = false;
    }
  }, [surface, cacheKey]);

  // Initial load + realtime live-refresh. Bursts of activity_log inserts
  // are coalesced into one refresh via an 800ms debounce, and we skip
  // refreshing while the tab is hidden, re-arming a single refresh when
  // it becomes visible again.
  useEffect(() => {
    void refresh();

    const sb = createClient();
    let pendingRefresh: ReturnType<typeof setTimeout> | null = null;
    let hiddenWhileDirty = false;
    let cancelled = false;
    let channel: ReturnType<typeof sb.channel> | null = null;

    const doRefresh = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        hiddenWhileDirty = true;
        return;
      }
      void refresh();
    };

    const scheduleRefresh = () => {
      if (cancelled) return;
      if (pendingRefresh) clearTimeout(pendingRefresh);
      pendingRefresh = setTimeout(doRefresh, 800);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && hiddenWhileDirty) {
        hiddenWhileDirty = false;
        void refresh();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          await sb.realtime.setAuth(token);
        }
      } catch {
        // best-effort; the subscription will still be attempted below
      }
      if (cancelled) return;
      channel = sb
        .channel(`notifications-bell-${surface}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_log" },
          scheduleRefresh,
        )
        .subscribe((status) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            console.warn(`[notifications-bell] realtime channel ${status}`);
          }
        });
    })();

    return () => {
      cancelled = true;
      if (pendingRefresh) clearTimeout(pendingRefresh);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (channel) sb.removeChannel(channel);
    };
  }, [refresh, surface]);

  function markRead() {
    startTransition(async () => {
      applyOptimistic("markAllRead");
      await markNotificationsRead();
      await refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            className="relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-dca-blue-500 px-1 font-mono text-[10px] font-bold text-white ring-2 ring-background">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-1rem))] p-0"
      >
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold tracking-tight">
              Notifications
            </p>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={markRead}
              disabled={pending}
              className="shrink-0"
            >
              <CheckCheck className="size-3.5" />
              Mark read
            </Button>
          )}
        </header>

        <div className="max-h-[420px] overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              <Bell className="mx-auto mb-2 size-5 opacity-50" />
              No activity yet.
            </div>
          ) : (
            <ul className="divide-y">
              {entries.map((entry) => {
                const isUnread = lastReadAt
                  ? entry.created_at > lastReadAt
                  : true;
                const label = actionLabel(entry.action);
                // For proof_commented rows we surface the file the comment
                // is attached to (instead of just the activity name) and
                // the comment preview, so admins can triage from the bell.
                const isComment =
                  entry.action === "proof_commented" ||
                  entry.action === "proof_mentioned";
                const proofName =
                  isComment && entry.meta
                    ? (entry.meta.proof_name as string | undefined) ?? null
                    : null;
                const headlineSuffix =
                  proofName ?? entry.activity_name ?? null;
                const inner = (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/60">
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        isUnread ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs",
                          isUnread ? "font-semibold text-foreground" : "text-foreground/80",
                        )}
                      >
                        {label}
                        {headlineSuffix && (
                          <>
                            {": "}
                            <span className="font-normal">{headlineSuffix}</span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {entry.project_name ?? "Project"}
                        {entry.actor_name ? ` · by ${entry.actor_name}` : ""}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {formatRelative(entry.created_at)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={entry.id}>
                    {entry.href ? (
                      <Link
                        href={entry.href}
                        className="block"
                        onClick={() => {
                          setOpen(false);
                          if (isUnread) {
                            startTransition(async () => {
                              await markNotificationsRead();
                              await refresh();
                            });
                          }
                        }}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => {
                          if (isUnread) {
                            startTransition(async () => {
                              await markNotificationsRead();
                              await refresh();
                            });
                          }
                        }}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
