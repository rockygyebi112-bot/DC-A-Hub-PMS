"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "@/lib/notifications/actions";
import type { NotificationEntry } from "@/lib/notifications/queries";

const ACTION_LABELS: Record<string, string> = {
  created: "New activity created",
  updated: "Activity updated",
  started: "Activity in progress",
  marked_done: "Activity completed",
  proof_added: "Proof uploaded",
  proof_deleted: "Proof removed",
  proof_commented: "New comment on proof",
  proof_mentioned: "You were mentioned",
};

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

export function NotificationsBell({
  entries,
  unreadCount,
  lastReadAt,
}: {
  entries: NotificationEntry[];
  unreadCount: number;
  lastReadAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function markRead() {
    startTransition(async () => {
      await markNotificationsRead();
      router.refresh();
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
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-bold text-destructive-foreground ring-2 ring-background">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0"
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
                const label = ACTION_LABELS[entry.action] ?? entry.action;
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
                const preview =
                  isComment && entry.meta
                    ? (entry.meta.preview as string | undefined) ?? null
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
                      {preview && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] italic text-muted-foreground">
                          “{preview}”
                        </p>
                      )}
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
                              router.refresh();
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
                              router.refresh();
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
