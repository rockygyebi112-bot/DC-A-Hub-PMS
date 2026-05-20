'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function MisUploadForm({ evaluationId }: { evaluationId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onUpload() {
    if (!file) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('file', file);
      const r = await fetch(`/api/evaluations/${evaluationId}/mis/upload`, {
        method: 'POST',
        body: fd,
      });
      if (r.ok) {
        const body = (await r.json().catch(() => null)) as
          | { inserted?: number }
          | null;
        toast.success(`Uploaded ${body?.inserted ?? 0} investments`);
        setFile(null);
        router.refresh();
      } else {
        const msg = await r.text().catch(() => '');
        toast.error(msg || `Upload failed (${r.status})`);
      }
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="file"
        accept=".csv,.xlsx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-xs"
      />
      <button
        type="button"
        disabled={pending || !file}
        onClick={onUpload}
        className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
      >
        {pending ? 'Uploading…' : 'Upload MIS investments'}
      </button>
    </div>
  );
}
