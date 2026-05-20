import { notFound, redirect } from 'next/navigation';

import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { QcRowActions } from '@/components/evaluations/qc-row-actions';
import { getEvaluation, listResponses } from '@/lib/evaluations/queries';

export const dynamic = 'force-dynamic';

type QcStatus =
  | 'pending'
  | 'approved'
  | 'edited'
  | 'cancelled_redo'
  | 'cancelled_dropped';

export default async function QcTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const { id } = await params;
  const sp = await searchParams;
  const ev = await getEvaluation(id);
  if (!ev) return notFound();
  const hh = (ev.instruments ?? []).find(
    (i: { kind: string }) => i.kind === 'hh',
  );
  if (!hh) return notFound();

  const qcStatus = (
    Array.isArray(sp.qc_status) ? sp.qc_status[0] : sp.qc_status
  ) as
    | 'pending'
    | 'approved'
    | 'cancelled_redo'
    | 'cancelled_dropped'
    | undefined;
  const region = Array.isArray(sp.region) ? sp.region[0] : sp.region;

  const rows = await listResponses({ instrumentId: hh.id, qcStatus, region });

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">QC: {ev.name}</h1>
        <p className="text-xs text-gray-500">
          Internal QC view. Names, phone numbers, and any PII visible here stay
          out of the dashboard.
        </p>
      </header>

      <div className="flex gap-2 text-xs">
        {(
          ['pending', 'approved', 'cancelled_redo', 'cancelled_dropped'] as const
        ).map((s) => (
          <a
            key={s}
            href={`?qc_status=${s}`}
            className={`rounded border px-2 py-1 ${
              qcStatus === s ? 'border-sky-300 bg-sky-50' : ''
            }`}
          >
            {s}
          </a>
        ))}
        <a
          href="?"
          className={`rounded border px-2 py-1 ${
            !qcStatus ? 'border-sky-300 bg-sky-50' : ''
          }`}
        >
          All
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No responses for this filter.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Submitted</th>
                <th className="px-4 py-2">Region / District / Community</th>
                <th className="px-4 py-2">Gender</th>
                <th className="px-4 py-2">Age</th>
                <th className="px-4 py-2">QC</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    {new Date(r.submitted_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {[r.region, r.district, r.community]
                      .filter(Boolean)
                      .join(' / ')}
                  </td>
                  <td className="px-4 py-2">{r.gender ?? '—'}</td>
                  <td className="px-4 py-2">{r.age ?? '—'}</td>
                  <td className="px-4 py-2">{r.qc_status}</td>
                  <td className="px-4 py-2">
                    <QcRowActions
                      responseId={r.id}
                      current={r.qc_status as QcStatus}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
