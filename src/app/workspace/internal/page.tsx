import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas, listTasks } from '@/lib/internal/queries';
import { TaskList } from '@/components/internal/task-list';
import { NewTaskForm } from '@/components/internal/new-task-form';

export default async function InternalWorkspacePage({
  searchParams,
}: { searchParams: Promise<{ area?: string; status?: string; project?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const params = await searchParams;
  const [areas, tasks] = await Promise.all([
    listAreas(),
    listTasks({ areaId: params.area, status: params.status, projectId: params.project }),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Internal workspace</h1>
          <p className="text-sm text-muted-foreground">DC&A Hub internal tasks. Not visible to clients.</p>
        </div>
        <NewTaskForm areas={areas} />
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterPill href="/workspace/internal" label="All areas" active={!params.area} />
        {areas.map((a) => (
          <FilterPill key={a.id} href={`/workspace/internal?area=${a.id}`} label={a.name} active={params.area === a.id} color={a.color ?? undefined} />
        ))}
      </div>

      <TaskList tasks={tasks} areas={areas} />
    </main>
  );
}

function FilterPill({ href, label, active, color }: { href: string; label: string; active: boolean; color?: string }) {
  return (
    <a href={href}
       className={`rounded-full border px-3 py-1 ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'}`}
       style={color && !active ? { borderColor: color, color } : undefined}>
      {label}
    </a>
  );
}
