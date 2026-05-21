import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";

import { StatusPill } from "@/components/admin/ui/status-pill";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ProjectTabs } from "@/components/admin/project-detail/parts";
import { SetBreadcrumbLabels } from "@/components/shell/breadcrumb-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardConfigEditor } from "@/components/evaluations/dashboard-config-editor";
import { DashboardView } from "@/components/evaluations/dashboard-view";
import { EvaluationSetupForm } from "@/components/evaluations/evaluation-setup-form";
import { KoboTokenForm } from "@/components/evaluations/kobo-token-form";
import { MisUploadForm } from "@/components/evaluations/mis-upload-form";
import { getProject } from "@/lib/admin/queries";
import { resolveIngestionIssue } from "@/lib/evaluations/actions";
import {
  getActiveDashboardSpec,
  getEvaluation,
  getEvaluationForProject,
  getIngestionRunsSummary,
  listOpenIssues,
} from "@/lib/evaluations/queries";

export const dynamic = "force-dynamic";

/** Labelled key/value cell for the config metadata rows. */
function MetaField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default async function ProjectEvaluationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [projectMaybe, evaluationRef] = await Promise.all([
    getProject(id),
    getEvaluationForProject(id),
  ]);
  if (!projectMaybe) notFound();
  const project = projectMaybe;

  async function resolveIssue(formData: FormData) {
    "use server";
    await resolveIngestionIssue(formData);
  }

  const ev = evaluationRef ? await getEvaluation(evaluationRef.id) : null;
  const hh = ev ? (ev.instruments ?? []).find((i) => i.kind === "hh") : null;
  const spec = ev ? await getActiveDashboardSpec(ev.id) : null;
  const runs = hh ? await getIngestionRunsSummary(hh.id) : [];
  const issues = hh ? await listOpenIssues(hh.id) : [];

  return (
    <div className="space-y-6">
      <SetBreadcrumbLabels labels={{ [id]: project.name }} />

      {/* Header */}
      <div className="space-y-4">
        <Link
          href={`/admin/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to project
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                Data Collection
              </h1>
              <StatusPill
                status={
                  project.archived_at
                    ? "archived"
                    : (project.status as
                        | "planning"
                        | "active"
                        | "paused"
                        | "completed")
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {project.name} · {project.code}
            </p>
          </div>
        </div>
      </div>

      <ProjectTabs projectId={id} active="evaluation" />

      {!ev ? (
        <SectionCard
          title="Set up data collection"
          description="Create an evaluation for this project to enable Kobo ingestion, the QC table, and the data collection dashboard."
        >
          <div className="px-4 py-3">
            <EvaluationSetupForm projectId={id} />
          </div>
        </SectionCard>
      ) : (
        <>
          {/* Dashboard — questions and graphs. Empty placeholders render
              here while collection hasn't produced data yet. */}
          {hh ? (
            <DashboardView
              projectId={id}
              evaluationId={ev.id}
              instrumentId={hh.id}
              targetN={ev.collection_target_n}
              defaultMode={
                (ev.dashboard_default_mode ?? "auto") as
                  | "auto"
                  | "progress"
                  | "findings"
              }
              searchParams={sp}
              approvedOnly={false}
              showStaffControls
            />
          ) : (
            <SectionCard
              title="No instrument configured"
              description="Add a household instrument in the setup section below to enable the dashboard."
            >
              <p className="px-4 py-3 text-sm text-muted-foreground">
                The data collection dashboard appears here once an instrument
                is connected.
              </p>
            </SectionCard>
          )}

          {/* Setup & configuration — collapsed by default. Kobo wiring, the
              dashboard spec, MIS upload and ingestion diagnostics live here,
              away from the day-to-day dashboard view. */}
          <details className="group overflow-hidden rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold tracking-tight">
                  Setup &amp; configuration
                </p>
                <p className="text-xs text-muted-foreground">
                  Kobo connection, dashboard spec, MIS upload and ingestion
                  diagnostics.
                </p>
              </div>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-5 border-t p-4">
              <SectionCard title="Evaluation">
                <div className="space-y-3 px-4 py-3">
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MetaField label="Slug">
                      <span className="font-mono text-xs">{ev.slug}</span>
                    </MetaField>
                    <MetaField label="Status">
                      <Badge variant="info">{ev.status}</Badge>
                    </MetaField>
                  </dl>
                  <p className="text-sm text-muted-foreground">
                    {ev.description ?? "No description."}
                  </p>
                </div>
              </SectionCard>

              {hh && (
                <SectionCard title="Household instrument">
                  <div className="space-y-3 px-4 py-3">
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <MetaField label="Kobo form ID">
                        <span className="font-mono text-xs">
                          {hh.kobo_form_id ?? "—"}
                        </span>
                      </MetaField>
                      <MetaField label="Last sync">
                        {hh.last_synced_at
                          ? new Date(hh.last_synced_at).toLocaleString()
                          : "Never"}
                      </MetaField>
                      <MetaField label="Sync status">
                        {hh.last_sync_status ? (
                          <Badge variant="neutral">
                            {hh.last_sync_status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </MetaField>
                    </dl>
                    <KoboTokenForm instrumentId={hh.id} />
                    <details>
                      <summary className="cursor-pointer text-sm">
                        Schema config (Kobo → semantic)
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(hh.schema_config, null, 2)}
                      </pre>
                    </details>
                  </div>
                </SectionCard>
              )}

              <SectionCard
                title="Dashboard spec"
                description="JSON spec driving the evaluation dashboard. Saving creates a new active version."
              >
                <div className="px-4 py-3">
                  <DashboardConfigEditor
                    evaluationId={ev.id}
                    initialSpec={spec?.spec ?? null}
                  />
                </div>
              </SectionCard>

              {hh && (
                <SectionCard
                  title="MIS investments"
                  description="Upload a CSV or XLSX. Existing rows for this evaluation are replaced."
                >
                  <div className="px-4 py-3">
                    <MisUploadForm evaluationId={ev.id} />
                  </div>
                </SectionCard>
              )}

              {hh && (
                <SectionCard
                  title="Recent ingestion runs"
                  description={`${runs.length} most recent`}
                >
                  {runs.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      No ingestion runs yet.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Started</TableHead>
                          <TableHead>Trigger</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Fetched</TableHead>
                          <TableHead>Inserted</TableHead>
                          <TableHead>Unmatched</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runs.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              {new Date(r.started_at).toLocaleString()}
                            </TableCell>
                            <TableCell>{r.trigger}</TableCell>
                            <TableCell>{r.status}</TableCell>
                            <TableCell>{r.fetched_count}</TableCell>
                            <TableCell>{r.inserted_count}</TableCell>
                            <TableCell>
                              {r.unmatched_investment_count}
                            </TableCell>
                            <TableCell className="text-destructive">
                              {r.error_message ?? ""}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
              )}

              {hh && (
                <SectionCard
                  title="Open ingestion issues"
                  description={`${issues.length} unresolved`}
                >
                  {issues.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      No open issues.
                    </p>
                  ) : (
                    <ul className="space-y-2 px-4 py-3 text-xs">
                      {issues.map((i) => (
                        <li
                          key={i.id}
                          className="rounded-lg border border-border p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-medium">{i.kind}</span>
                              <span className="ml-2 text-muted-foreground">
                                {new Date(i.created_at).toLocaleString()}
                              </span>
                            </div>
                            <form action={resolveIssue}>
                              <input type="hidden" name="id" value={i.id} />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                              >
                                Resolve
                              </Button>
                            </form>
                          </div>
                          <pre className="mt-1.5 overflow-auto rounded bg-muted p-1.5">
                            {JSON.stringify(i.details)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
