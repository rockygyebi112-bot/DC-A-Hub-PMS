'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { triggerManualSync } from '@/lib/evaluations/actions';

export function SyncNowButton({ instrumentId }: { instrumentId: string }) {
  const [pending, startTransition] = useTransition();
  const [cooling, setCooling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function onClick() {
    startTransition(async () => {
      const res = await triggerManualSync(instrumentId);
      if (res.ok) {
        toast.success('Sync triggered');
        setCooling(true);
        timerRef.current = setTimeout(() => setCooling(false), 60_000);
      } else {
        toast.error(res.error ?? 'Sync failed');
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending || cooling}
      onClick={onClick}
      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
    >
      {cooling ? 'Cooling down…' : pending ? 'Syncing…' : 'Sync now'}
    </button>
  );
}
