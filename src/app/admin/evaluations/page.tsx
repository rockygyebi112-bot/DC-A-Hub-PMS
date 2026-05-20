import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/admin/ui/page-header';
import { SectionCard } from '@/components/admin/ui/section-card';
import { listEvaluations } from '@/lib/evaluations/queries';

export const dynamic = 'force-dynamic';

export default async function AdminEvaluationsIndex() {
  const evs = await listEvaluations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evaluations"
        subtitle="Instrument config, dashboard specs, MIS data, and ingestion triage."
        backFallbackHref="/admin"
      />

      <SectionCard
        title="Evaluation roster"
        description={`${evs.length} total`}
      >
        {evs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No evaluations yet"
            description="Evaluations are created against a project."
          />
        ) : (
          <ul className="divide-y divide-border">
            {evs.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <Link
                  href={`/admin/evaluations/${e.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {e.name}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {e.status} · target {e.collection_target_n ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
