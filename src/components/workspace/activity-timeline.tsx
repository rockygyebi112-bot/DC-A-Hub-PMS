import {
  CircleCheck,
  CirclePlay,
  FileUp,
  MessageSquare,
  Pencil,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ActivityTimelineEvent } from "@/lib/workspace/queries";
import { cn } from "@/lib/utils";

// Map raw `activity_log.action` values to a human-friendly label + icon. Keep
// this co-located with the timeline so adding a new action elsewhere shows up
// here as a "Updated" fallback rather than crashing the page.
const eventStyles: Record<
  string,
  { label: string; icon: LucideIcon; tone: string }
> = {
  created: { label: "Activity created", icon: Sparkles, tone: "text-blue-600 dark:text-blue-400" },
  started: { label: "Marked in progress", icon: CirclePlay, tone: "text-amber-600 dark:text-amber-400" },
  marked_done: { label: "Marked complete", icon: CircleCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  updated: { label: "Updated", icon: Pencil, tone: "text-muted-foreground" },
  proof_added: { label: "Proof uploaded", icon: FileUp, tone: "text-violet-600 dark:text-violet-400" },
  proof_commented: { label: "Comment added", icon: MessageSquare, tone: "text-muted-foreground" },
  proof_mentioned: { label: "Mention", icon: MessageSquare, tone: "text-muted-foreground" },
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityTimeline({ events }: { events: ActivityTimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No activity yet. Updates, proofs, and status changes will appear here.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4">
      {/* Vertical guide rail behind the dots. Sits behind the icons so the
          icon backgrounds (which match the card surface) cleanly punch
          through the line. */}
      <span
        aria-hidden
        className="absolute left-3 top-1.5 bottom-1.5 w-px bg-border"
      />
      {events.map((event) => {
        const style = eventStyles[event.action] ?? {
          label: event.action.replaceAll("_", " "),
          icon: Pencil,
          tone: "text-muted-foreground",
        };
        const Icon = style.icon;
        return (
          <li key={event.id} className="relative flex gap-3 pl-0">
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background",
                style.tone,
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium leading-tight">{style.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {event.actor_name ? `by ${event.actor_name} · ` : ""}
                {formatDateTime(event.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
