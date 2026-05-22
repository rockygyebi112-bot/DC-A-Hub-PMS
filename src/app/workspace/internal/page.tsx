import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas, listTasks } from '@/lib/internal/queries';
import { TaskList } from '@/components/internal/task-list';
import { NewTaskForm } from '@/components/internal/new-task-form';
import { PageHeader } from '@/components/admin/ui/page-header';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export default async function InternalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; status?: string; project?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const params = await searchParams;
  const [areas, tasks] = await Promise.all([
    listAreas(),
    listTasks({
      areaId: params.area,
      status: params.status,
      projectId: params.project,
    }),
  ]);

  // Build a filter href that mutates one param and preserves the rest.
  function filterHref(patch: { area?: string; status?: string }) {
    const next = new URLSearchParams();
    const area = 'area' in patch ? patch.area : params.area;
    const status = 'status' in patch ? patch.status : params.status;
    if (area) next.set('area', area);
    if (status) next.set('status', status);
    if (params.project) next.set('project', params.project);
    const qs = next.toString();
    return qs ? `/workspace/internal?${qs}` : '/workspace/internal';
  }

  return (
    <>
      <PageHeader
        title="Internal workspace"
        subtitle="DC&A Hub internal tasks. Not visible to clients."
        backFallbackHref="/workspace"
        action={<NewTaskForm areas={areas} />}
      />

      <nav aria-label="Task filters" className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2 text-sm">
          <FilterPill
            href={filterHref({ area: undefined })}
            label="All areas"
            active={!params.area}
          />
          {areas.map((a) => (
            <FilterPill
              key={a.id}
              href={filterHref({ area: a.id })}
              label={a.name}
              active={params.area === a.id}
              color={a.color ?? undefined}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <FilterPill
            href={filterHref({ status: undefined })}
            label="All statuses"
            active={!params.status}
          />
          {STATUS_FILTERS.map((s) => (
            <FilterPill
              key={s.value}
              href={filterHref({ status: s.value })}
              label={s.label}
              active={params.status === s.value}
            />
          ))}
        </div>
      </nav>

      <TaskList tasks={tasks} areas={areas} />
    </>
  );
}

function FilterPill({
  href,
  label,
  active,
  color,
}: {
  href: string;
  label: string;
  active: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
      style={color && !active ? { borderColor: color, color } : undefined}
    >
      {label}
    </Link>
  );
}
