'use client';

import { useEffect, useState } from 'react';

type Staff = { user_id: string; full_name: string };

export function AssigneePicker({
  existingIds,
  onAdd,
}: {
  existingIds: string[];
  onAdd: (id: string) => void;
}) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pick, setPick] = useState('');

  useEffect(() => {
    fetch('/api/internal/staff')
      .then((r) => r.json())
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  const available = staff.filter((s) => !existingIds.includes(s.user_id));
  if (available.length === 0) return null;

  return (
    <div className="mt-3 flex gap-2">
      <select
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        className="rounded border bg-background text-foreground px-2 py-1 text-sm"
      >
        <option value="">Add assignee…</option>
        {available.map((s) => (
          <option key={s.user_id} value={s.user_id}>
            {s.full_name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!pick}
        onClick={() => {
          onAdd(pick);
          setPick('');
        }}
        className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
      >
        Add
      </button>
    </div>
  );
}
