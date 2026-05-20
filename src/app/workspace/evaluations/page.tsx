import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listEvaluations } from '@/lib/evaluations/queries';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EvaluationsIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const evaluations = await listEvaluations();
  const sb = await createClient();
  const ids = evaluations.map((e) => e.id);
  const responseCountByEval = new Map<string, number>();
  if (ids.length > 0) {
    const { data: instruments } = await sb
      .from('evaluation_instruments')
      .select('id, evaluation_id')
      .in('evaluation_id', ids);
    const instrumentList = instruments ?? [];
    const instrumentIds = instrumentList.map((i) => i.id);
    if (instrumentIds.length > 0) {
      const { data: responseRows } = await sb
        .from('evaluation_responses')
        .select('instrument_id')
        .in('instrument_id', instrumentIds);
      const countByInstrument = new Map<string, number>();
      for (const row of responseRows ?? []) {
        countByInstrument.set(
          row.instrument_id,
          (countByInstrument.get(row.instrument_id) ?? 0) + 1,
        );
      }
      for (const inst of instrumentList) {
        responseCountByEval.set(
          inst.evaluation_id,
          (responseCountByEval.get(inst.evaluation_id) ?? 0) +
            (countByInstrument.get(inst.id) ?? 0),
        );
      }
    }
  }

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Evaluations</h1>
        <p className="text-sm text-muted-foreground">All M&amp;E evaluations across projects.</p>
      </header>

      {evaluations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No evaluations yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Responses / Target</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => {
                const count = responseCountByEval.get(e.id) ?? 0;
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{e.name}</td>
                    <td className="px-4 py-2">{e.status}</td>
                    <td className="px-4 py-2">
                      {count} / {e.collection_target_n ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/workspace/projects/${e.project_id}/dashboard`}
                        className="text-primary hover:underline"
                      >
                        Dashboard
                      </Link>
                      <span className="mx-2 text-muted-foreground/40">&middot;</span>
                      <Link
                        href={`/workspace/evaluations/${e.id}/responses`}
                        className="text-primary hover:underline"
                      >
                        QC table
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
