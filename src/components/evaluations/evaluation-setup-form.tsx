'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createEvaluation } from '@/lib/evaluations/actions';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function EvaluationSetupForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [targetN, setTargetN] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const fd = new FormData();
      fd.set('project_id', projectId);
      fd.set('name', name);
      fd.set('slug', slug || slugify(name));
      if (targetN.trim()) fd.set('collection_target_n', targetN.trim());
      const r = await createEvaluation(fd);
      if (r.ok) {
        toast.success('Data collection set up');
        router.refresh();
      } else {
        toast.error(r.error ?? 'Setup failed');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="ev-name" className="text-sm font-medium">
          Evaluation name
        </label>
        <Input
          id="ev-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="SOCO Baseline Evaluation"
          required
          minLength={2}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ev-slug" className="text-sm font-medium">
          Slug
        </label>
        <Input
          id="ev-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="soco-baseline"
          pattern="[a-z0-9-]+"
          required
        />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers and hyphens only.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ev-target" className="text-sm font-medium">
          Collection target (optional)
        </label>
        <Input
          id="ev-target"
          type="number"
          inputMode="numeric"
          min={1}
          value={targetN}
          onChange={(e) => setTargetN(e.target.value)}
          placeholder="e.g. 1200"
        />
        <p className="text-xs text-muted-foreground">
          Expected number of household responses.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || name.trim().length < 2}>
          {pending ? 'Setting up…' : 'Set up data collection'}
        </Button>
      </div>
    </form>
  );
}
