import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectHealthCard({
  health,
  overdueCount,
  dueThisWeek,
}: {
  health: "on-track" | "at-risk" | "delayed" | "not-started";
  overdueCount: number;
  dueThisWeek: number;
}) {
  const tone =
    health === "on-track"
      ? {
          ring: "bg-emerald-50 text-emerald-700 ring-emerald-100",
          headerColor: "text-emerald-600",
          headline: "On track",
          message: "The project is progressing well.",
          icon: ShieldCheck,
        }
      : health === "at-risk"
        ? {
            ring: "bg-amber-50 text-amber-700 ring-amber-100",
            headerColor: "text-amber-600",
            headline: "At risk",
            message: "Some activities need attention.",
            icon: AlertTriangle,
          }
        : health === "delayed"
          ? {
              ring: "bg-red-50 text-red-700 ring-red-100",
              headerColor: "text-red-600",
              headline: "Delayed",
              message: "Activities are running behind schedule.",
              icon: AlertTriangle,
            }
          : {
              ring: "bg-muted text-muted-foreground ring-border",
              headerColor: "text-muted-foreground",
              headline: "Not started",
              message: "No activity yet on this project.",
              icon: Shield,
            };
  const Icon = tone.icon;
  const milestonesOk = health === "on-track" || health === "not-started";
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Icon className={cn("size-4", tone.headerColor)} />
        <h3 className="text-sm font-semibold">Project health</h3>
      </header>
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-start gap-3 rounded-[12px] border border-border bg-background p-3">
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full ring-4",
              tone.ring,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{tone.headline}</p>
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {tone.message}
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-3.5 shrink-0",
                overdueCount === 0 ? "text-emerald-500" : "text-red-500",
              )}
            />
            <span className="text-foreground/80">
              {overdueCount === 0
                ? "No overdue activities"
                : `${overdueCount} overdue activit${overdueCount === 1 ? "y" : "ies"}`}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-3.5 shrink-0",
                dueThisWeek === 0 ? "text-emerald-500" : "text-amber-500",
              )}
            />
            <span className="text-foreground/80">
              {dueThisWeek} activit{dueThisWeek === 1 ? "y" : "ies"} due this week
            </span>
          </li>
          <li className="flex items-center gap-2">
            {milestonesOk ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle
                className={cn(
                  "size-3.5 shrink-0",
                  health === "delayed" ? "text-red-500" : "text-amber-500",
                )}
              />
            )}
            <span className="text-foreground/80">
              {milestonesOk
                ? "Milestones are on track"
                : health === "delayed"
                  ? "Milestones are behind schedule"
                  : "Milestones need attention"}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
