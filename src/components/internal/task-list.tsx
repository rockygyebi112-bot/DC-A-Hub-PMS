import { TaskCard, type TaskRow } from './task-card';

type Area = { id: string; name: string; color?: string | null };
type Task = TaskRow & { area_id: string };

export function TaskList({ tasks, areas }: { tasks: Task[]; areas: Area[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-gray-500">No tasks yet. Create one above.</p>;
  }
  const grouped = new Map<string, Task[]>();
  for (const t of tasks) {
    const list = grouped.get(t.area_id) ?? [];
    list.push(t);
    grouped.set(t.area_id, list);
  }
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {areas
        .filter((a) => grouped.has(a.id))
        .map((a) => (
          <section key={a.id}>
            <h2 className="mb-2 text-sm font-semibold text-gray-800">{a.name}</h2>
            <div className="space-y-2">
              {grouped.get(a.id)!.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          </section>
        ))}
    </div>
  );
}
