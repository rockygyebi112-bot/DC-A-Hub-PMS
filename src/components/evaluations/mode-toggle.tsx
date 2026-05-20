'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function ModeToggle({
  defaultMode,
}: {
  defaultMode: 'progress' | 'findings';
}) {
  const router = useRouter();
  const params = useSearchParams();
  const mode =
    (params.get('mode') as 'progress' | 'findings' | null) ?? defaultMode;

  function setMode(m: 'progress' | 'findings') {
    const next = new URLSearchParams(params.toString());
    next.set('mode', m);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border p-1 text-sm">
      <button
        type="button"
        onClick={() => setMode('progress')}
        className={`rounded px-3 py-1 ${
          mode === 'progress' ? 'bg-sky-500 text-white' : ''
        }`}
      >
        Progress
      </button>
      <button
        type="button"
        onClick={() => setMode('findings')}
        className={`rounded px-3 py-1 ${
          mode === 'findings' ? 'bg-sky-500 text-white' : ''
        }`}
      >
        Findings
      </button>
    </div>
  );
}
