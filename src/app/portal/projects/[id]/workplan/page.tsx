import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { PhaseActivities } from "@/components/portal/phase-activities";
import { PortalProjectTabs } from "@/components/portal/project-tabs";
import { WorkplanProgressTable } from "@/components/portal/workplan-progress-table";
import { getPortalProjectDetail } from "@/lib/portal/queries";
import { cn } from "@/lib/utils";

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default async function PortalProjectWorkplanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getPortalProjectDetail(id);
  if (!detail) notFound();

  const { project, phases } = detail;
  const totalActivities = phases.reduce((sum, p) => sum + p.activities.length, 0);
  const doneActivities = phases.reduce(
    (sum, p) => sum + p.activities.filter((a) => a.status === "done").length,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        backFallbackHref={`/portal/projects/${project.id}`}
        title={`${project.name} · Workplan`}
        subtitle={`${doneActivities} of ${totalActivities} activities completed across ${phases.length} phase${phases.length === 1 ? "" : "s"}.`}
      />

      <PortalProjectTabs projectId={project.id} />

      <WorkplanProgressTable phases={phases} />

      <div className="space-y-4">
        {phases.length === 0 ? (
          <SectionCard>
            <p className="py-8 text-center text-sm text-muted-foreground">
              No phases yet.
            </p>
          </SectionCard>
        ) : (
          phases.map((phase, index) => {
            const total = phase.activities.length;
            const done = phase.activities.filter((a) => a.status === "done").length;
            const inProgress = phase.activities.filter(
              (a) => a.status === "in_progress",
            ).length;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            const phaseStatus: "planning" | "active" | "completed" =
              total === 0
                ? "planning"
                : done === total
                  ? "completed"
                  : "active";

            return (
              <details
                key={phase.id}
                open
                className="group rounded-[14px] border bg-card shadow-card transition-smooth"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-0 -rotate-90" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-sm font-semibold tracking-tight">
                        <span className="text-muted-foreground">{index + 1}.</span>{" "}
                        {phase.name}
                      </h3>
                      <StatusPill status={phaseStatus} />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {done}/{total} done
                        {inProgress > 0 ? ` · ${inProgress} in progress` : ""}
                      </span>
                    </div>
                    {(phase.start_date || phase.end_date || phase.description) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {phase.start_date || phase.end_date
                          ? `${formatDate(phase.start_date) ?? "TBD"} – ${formatDate(phase.end_date) ?? "TBD"}`
                          : ""}
                        {phase.description ? ` · ${phase.description}` : ""}
                      </p>
                    )}
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          phaseStatus === "completed"
                            ? "bg-emerald-500"
                            : phaseStatus === "active"
                              ? "bg-blue-500"
                              : "bg-muted-foreground/30",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-heading text-2xl font-bold leading-none tracking-tight">
                      {pct}%
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      complete
                    </p>
                  </div>
                </summary>

                <div className="border-t px-5 py-3">
                  <PhaseActivities
                    projectId={project.id}
                    activities={phase.activities}
                  />
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}
