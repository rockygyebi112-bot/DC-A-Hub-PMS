import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityTimelineEvent } from "@/lib/workspace/queries";
import { buildLifecycle } from "./feed";
import { formatDateTime } from "./format";

export function TimelineCard({
  events,
  status,
}: {
  events: ActivityTimelineEvent[];
  status: "not_started" | "in_progress" | "done";
}) {
  const steps = buildLifecycle(events, status);
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="px-5 pt-4 pb-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Timeline</h2>
      </header>
      <div className="px-5 pb-5">
        <ol className="relative space-y-4">
          <span
            aria-hidden
            className="absolute left-[9px] top-2 bottom-2 w-px bg-border"
          />
          {steps.map((step) => (
            <li key={step.key} className="relative flex gap-3 pl-0">
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full ring-2 ring-card",
                  step.state === "done" && "bg-emerald-500 text-white",
                  step.state === "current" && "bg-primary text-white",
                  step.state === "future" &&
                    "border border-dashed border-muted-foreground/40 bg-card",
                )}
              >
                {step.state === "done" && <CircleCheck className="size-3" />}
                {step.state === "current" && (
                  <span className="size-1.5 rounded-full bg-white" />
                )}
              </span>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-sm",
                      step.state === "future"
                        ? "text-muted-foreground"
                        : "font-medium text-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    {step.when ? formatDateTime(step.when) : "—"}
                  </p>
                </div>
                {step.actor && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    by {step.actor}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
