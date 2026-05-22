'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function ModeToggle({
  defaultMode,
}: {
  defaultMode: 'progress' | 'findings';
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const mode =
    (params.get('mode') as 'progress' | 'findings' | null) ?? defaultMode;

  function setMode(m: 'progress' | 'findings') {
    const next = new URLSearchParams(params.toString());
    next.set('mode', m);
    startTransition(() => {
      router.push(`?${next.toString()}`);
    });
  }

  return (
    <div
      data-pending={isPending ? '' : undefined}
      className="inline-flex rounded-lg border border-border p-1 text-sm transition-opacity data-[pending]:opacity-50"
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => setMode('progress')}
        className={`rounded px-3 py-1 disabled:cursor-not-allowed ${
          mode === 'progress' ? 'bg-primary text-primary-foreground' : ''
        }`}
      >
        Progress
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setMode('findings')}
        className={`rounded px-3 py-1 disabled:cursor-not-allowed ${
          mode === 'findings' ? 'bg-primary text-primary-foreground' : ''
        }`}
      >
        Findings
      </button>
    </div>
  );
}
