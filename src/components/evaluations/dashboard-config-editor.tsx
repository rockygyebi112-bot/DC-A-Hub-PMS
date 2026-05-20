'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { setDashboardSpec } from '@/lib/evaluations/actions';

export function DashboardConfigEditor(props: {
  evaluationId: string;
  initialSpec: unknown;
}) {
  const [text, setText] = useState(
    JSON.stringify(props.initialSpec ?? {}, null, 2),
  );
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('evaluation_id', props.evaluationId);
      fd.set('spec', text);
      const r = await setDashboardSpec(fd);
      if (r.ok) toast.success('Dashboard spec saved');
      else toast.error(r.error ?? 'Save failed');
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        spellCheck={false}
        className="w-full rounded border border-border bg-card p-2 font-mono text-xs"
      />
      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save dashboard spec'}
      </button>
    </div>
  );
}
