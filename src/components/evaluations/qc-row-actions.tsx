'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { setQcStatus } from '@/lib/evaluations/actions';

type QcStatus =
  | 'pending'
  | 'approved'
  | 'edited'
  | 'cancelled_redo'
  | 'cancelled_dropped';

export function QcRowActions({
  responseId,
  current,
}: {
  responseId: string;
  current: QcStatus;
}) {
  const [pending, startTransition] = useTransition();

  function send(next: 'approved' | 'cancelled_redo' | 'cancelled_dropped') {
    const fd = new FormData();
    fd.set('response_id', responseId);
    fd.set('next_status', next);
    startTransition(async () => {
      const res = await setQcStatus(fd);
      if (res.ok) toast.success(`Marked ${next}`);
      else toast.error(res.error ?? 'Update failed');
    });
  }

  return (
    <div className="flex gap-1 text-xs">
      <button
        type="button"
        disabled={pending || current === 'approved'}
        onClick={() => send('approved')}
        className="rounded border px-2 py-0.5 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending || current === 'cancelled_redo'}
        onClick={() => send('cancelled_redo')}
        className="rounded border px-2 py-0.5 disabled:opacity-50"
      >
        Redo
      </button>
      <button
        type="button"
        disabled={pending || current === 'cancelled_dropped'}
        onClick={() => send('cancelled_dropped')}
        className="rounded border px-2 py-0.5 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
