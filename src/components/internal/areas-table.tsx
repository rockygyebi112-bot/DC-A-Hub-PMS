'use client';

import { useTransition } from 'react';
import { createArea, updateArea, archiveArea } from '@/lib/internal/actions';
import type { ActionResult } from '@/lib/action-result';

type Area = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  archived_at?: string | null;
};

export function AreasTable({ areas }: { areas: Area[] }) {
  const [pending, start] = useTransition();

  // Server actions return `ActionResult`, but `useTransition`'s start callback
  // requires a void-returning function. Run the action, surface failures to the
  // console (toast plumbing is a follow-up), and discard the resolved value.
  async function run<T>(p: Promise<ActionResult<T>>) {
    const r = await p;
    if (!r.ok) console.error('[internal area] action failed:', r.error);
  }

  return (
    <section className="space-y-6">
      <form action={(fd) => start(() => run(createArea(fd)))} className="flex items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500">Name</label>
          <input name="name" required className="rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Color (#hex)</label>
          <input name="color" placeholder="#7c3aed" className="rounded border px-2 py-1 text-sm" />
        </div>
        <button disabled={pending} className="rounded-md bg-gray-900 px-3 py-1 text-sm text-white">+ Add area</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-gray-500">
          <tr><th>Name</th><th>Color</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {areas.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2">
                <form action={(fd) => start(() => run(updateArea(a.id, fd)))} className="flex gap-2">
                  <input name="name" defaultValue={a.name} className="rounded border px-2 py-1 text-sm" />
                  <button className="text-xs text-gray-500 hover:text-gray-900">Save</button>
                </form>
              </td>
              <td><span className="inline-block h-4 w-4 rounded" style={{ background: a.color ?? '#ccc' }} /></td>
              <td>{a.archived_at ? 'Archived' : 'Active'}</td>
              <td className="text-right">
                {!a.archived_at && (
                  <button
                    disabled={pending}
                    onClick={() => start(() => run(archiveArea(a.id)))}
                    className="text-xs text-red-600"
                  >
                    Archive
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
