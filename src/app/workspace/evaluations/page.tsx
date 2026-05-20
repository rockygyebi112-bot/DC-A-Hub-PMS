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
    for (const inst of instruments ?? []) {
      const { count } = await sb
        .from('evaluation_responses')
        .select('id', { count: 'exact', head: true })
        .eq('instrument_id', inst.id);
      responseCountByEval.set(
        inst.evaluation_id,
        (responseCountByEval.get(inst.evaluation_id) ?? 0) + (count ?? 0),
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Evaluations</h1>
        <p className="text-sm text-gray-600">All M&amp;E evaluations across projects.</p>
      </header>

      {evaluations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No evaluations yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
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
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium">{e.name}</td>
                    <td className="px-4 py-2">{e.status}</td>
                    <td className="px-4 py-2">
                      {count} / {e.collection_target_n ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/workspace/projects/${e.project_id}/dashboard`}
                        className="text-sky-600 hover:underline"
                      >
                        Dashboard
                      </Link>
                      <span className="mx-2 text-gray-300">&middot;</span>
                      <Link
                        href={`/workspace/evaluations/${e.id}/responses`}
                        className="text-sky-600 hover:underline"
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
