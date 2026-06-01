'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

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
      <Select value={pick || undefined} onValueChange={(v) => setPick(v ?? '')}>
        <SelectTrigger size="sm" className="flex-1">
          <SelectValue placeholder="Add assignee…" />
        </SelectTrigger>
        <SelectContent>
          {available.map((s) => (
            <SelectItem key={s.user_id} value={s.user_id}>
              {s.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={!pick}
        onClick={() => {
          onAdd(pick);
          setPick('');
        }}
      >
        Add
      </Button>
    </div>
  );
}
