"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import {
  fetchNotifications,
  unreadCount,
} from "@/lib/notifications/queries";
import type {
  NotificationItem,
  NotificationsBucket,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "notifications:lastSeenAt";
const EMPTY: NotificationsBucket = {
  overdue: [],
  dueSoon: [],
  recentUpdates: [],
};

export function NotificationsPopover() {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState<NotificationsBucket>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Hydrate lastSeen from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLastSeen(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const next = await fetchNotifications(userId);
      setBucket(next);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load + refresh every 5 min.
  useEffect(() => {
    if (!userId) return;
    load();
    const i = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, [userId, load]);

  // Click outside / Escape to close.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = unreadCount(bucket, lastSeen);
  const total =
    bucket.overdue.length +
    bucket.dueSoon.length +
    bucket.recentUpdates.length;

  function markAllRead() {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, now);
    }
    setLastSeen(now);
  }

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next) {
        // Refresh on open and mark non-overdue items as seen.
        load();
        markAllRead();
      }
      return next;
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={toggle}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 transition-all duration-200 ease-out"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-srsf-green-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(92vw,360px)] rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <span className="text-[11px] text-muted-foreground">
              {loading ? "Loading…" : `${total} item${total === 1 ? "" : "s"}`}
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {!loading && total === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </div>
            )}

            {bucket.overdue.length > 0 && (
              <Section
                title="Overdue"
                items={bucket.overdue}
                onItemClick={() => setOpen(false)}
                tone="red"
              />
            )}
            {bucket.dueSoon.length > 0 && (
              <Section
                title="Due this week"
                items={bucket.dueSoon}
                onItemClick={() => setOpen(false)}
                tone="amber"
              />
            )}
            {bucket.recentUpdates.length > 0 && (
              <Section
                title="Recent updates"
                items={bucket.recentUpdates}
                onItemClick={() => setOpen(false)}
                tone="blue"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  onItemClick,
  tone,
}: {
  title: string;
  items: NotificationItem[];
  onItemClick: () => void;
  tone: "red" | "amber" | "blue";
}) {
  const dot =
    tone === "red"
      ? "bg-red-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-blue-500";
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              onClick={onItemClick}
              className="flex gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
            >
              <span
                className={cn("mt-1.5 size-2 rounded-full shrink-0", dot)}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">
                  {it.title}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  {it.detail}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
