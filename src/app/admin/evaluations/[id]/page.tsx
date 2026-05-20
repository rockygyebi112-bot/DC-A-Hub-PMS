import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/admin/ui/page-header';
import { SectionCard } from '@/components/admin/ui/section-card';
import { SetBreadcrumbLabels } from '@/components/shell/breadcrumb-context';
import { DashboardConfigEditor } from '@/components/evaluations/dashboard-config-editor';
import { KoboTokenForm } from '@/components/evaluations/kobo-token-form';
import { MisUploadForm } from '@/components/evaluations/mis-upload-form';
import { resolveIngestionIssue } from '@/lib/evaluations/actions';
import {
  getActiveDashboardSpec,
  getEvaluation,
  getIngestionRunsSummary,
  listOpenIssues,
} from '@/lib/evaluations/queries';

export const dynamic = 'force-dynamic';

export default async function AdminEvaluationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ev = await getEvaluation(id);
  if (!ev) notFound();

  async function resolveIssue(formData: FormData) {
    'use server';
    await resolveIngestionIssue(formData);
  }

  const hh = (ev.instruments ?? []).find((i) => i.kind === 'hh');
  const spec = await getActiveDashboardSpec(id);
  const runs = hh ? await getIngestionRunsSummary(hh.id) : [];
  const issues = hh ? await listOpenIssues(hh.id) : [];

  return (
    <div className="space-y-6">
      <SetBreadcrumbLabels labels={{ [id]: ev.name }} />
      <PageHeader
        title={ev.name}
        subtitle={`slug: ${ev.slug} · status: ${ev.status}`}
        backFallbackHref="/admin/evaluations"
      />

      {hh && (
        <SectionCard
          title="Household instrument"
          description={`Kobo form id: ${hh.kobo_form_id ?? '—'} · last sync: ${
            hh.last_synced_at ?? 'never'
          } · status: ${hh.last_sync_status ?? '—'}`}
        >
          <div className="space-y-3 px-4 py-3">
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
            <p className="px-4 py-3 text-xs text-muted-foreground">
              No ingestion runs yet.
            </p>
          ) : (
            <div className="overflow-x-auto px-4 py-3">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Started</th>
                    <th className="py-1 pr-3">Trigger</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1 pr-3">Fetched</th>
                    <th className="py-1 pr-3">Inserted</th>
                    <th className="py-1 pr-3">Unmatched</th>
                    <th className="py-1">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1 pr-3">
                        {new Date(r.started_at).toLocaleString()}
                      </td>
                      <td className="py-1 pr-3">{r.trigger}</td>
                      <td className="py-1 pr-3">{r.status}</td>
                      <td className="py-1 pr-3">{r.fetched_count}</td>
                      <td className="py-1 pr-3">{r.inserted_count}</td>
                      <td className="py-1 pr-3">
                        {r.unmatched_investment_count}
                      </td>
                      <td className="py-1 text-destructive">
                        {r.error_message ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {hh && (
        <SectionCard
          title="Open ingestion issues"
          description={`${issues.length} unresolved`}
        >
          {issues.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              No open issues.
            </p>
          ) : (
            <ul className="space-y-2 px-4 py-3 text-xs">
              {issues.map((i) => (
                <li key={i.id} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{i.kind}</span>
                      <span className="ml-2 text-muted-foreground">
                        {new Date(i.created_at).toLocaleString()}
                      </span>
                    </div>
                    <form action={resolveIssue}>
                      <input type="hidden" name="id" value={i.id} />
                      <button
                        type="submit"
                        className="rounded border border-border px-2 py-0.5"
                      >
                        Resolve
                      </button>
                    </form>
                  </div>
                  <pre className="mt-1 overflow-auto rounded bg-muted p-1">
                    {JSON.stringify(i.details)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
