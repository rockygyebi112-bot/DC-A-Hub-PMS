import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas } from '@/lib/internal/queries';
import { AreasTable } from '@/components/internal/areas-table';

export default async function AreasAdminPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') redirect('/');
  const areas = await listAreas({ includeArchived: true });
  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Internal areas</h1>
        <p className="text-sm text-gray-600">Top-level buckets for internal tasks.</p>
      </header>
      <AreasTable areas={areas} />
    </main>
  );
}
