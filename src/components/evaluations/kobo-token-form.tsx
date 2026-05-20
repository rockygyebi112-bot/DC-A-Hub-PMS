'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { setKoboToken } from '@/lib/evaluations/actions';

export function KoboTokenForm({ instrumentId }: { instrumentId: string }) {
  const [token, setToken] = useState('');
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const r = await setKoboToken({ instrumentId, token });
      if (r.ok) {
        toast.success('Token saved');
        setToken('');
      } else {
        toast.error(r.error ?? 'Save failed');
      }
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Kobo API token"
        className="w-72 rounded border border-border bg-card px-2 py-1 text-xs"
      />
      <button
        type="button"
        disabled={pending || token.length < 8}
        onClick={onSave}
        className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save token'}
      </button>
    </div>
  );
}
