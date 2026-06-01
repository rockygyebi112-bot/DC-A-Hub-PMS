'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/require-role-server';
import { dbErrorMessage } from '@/lib/db-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { setDashboardSpecVersion } from '@/lib/supabase/rpcs';
import type { ActionResult } from '@/lib/action-result';

import { DashboardSpec } from './dashboard-spec';
import { ingestInstrument } from './ingest';
import { encryptToken } from './kobo-crypto';
import {
  evaluationCreateSchema,
  instrumentUpdateSchema,
  qcActionSchema,
} from './schemas';

export async function setQcStatus(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;

  const parsed = qcActionSchema.safeParse({
    response_id: formData.get('response_id'),
    next_status: formData.get('next_status'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const sb = await createClient();
  const { error } = await sb
    .from('evaluation_responses')
    .update({
      qc_status: parsed.data.next_status,
      qc_checked_at: new Date().toISOString(),
      qc_checked_by: auth.userId,
    })
    .eq('id', parsed.data.response_id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath('/workspace/projects/[id]/responses', 'page');
  return { ok: true };
}

export async function createEvaluation(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;

  const parsed = evaluationCreateSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const sb = await createClient();
  const { error } = await sb.from('evaluations').insert(parsed.data);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath('/admin/projects/[id]/evaluation', 'page');
  return { ok: true };
}

export async function updateInstrument(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;

  const raw: Record<string, unknown> = Object.fromEntries(formData);
  // schema_config is sent as a JSON string; pre-parse before Zod.
  if (typeof raw.schema_config === 'string') {
    try {
      raw.schema_config = JSON.parse(raw.schema_config);
    } catch {
      return { ok: false, error: 'schema_config must be valid JSON' };
    }
  }
  const parsed = instrumentUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, ...patch } = parsed.data;
  const sb = await createClient();
  const { error } = await sb
    .from('evaluation_instruments')
    .update(patch)
    .eq('id', id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath('/admin/projects/[id]/evaluation', 'page');
  return { ok: true };
}

export async function setKoboToken(args: {
  instrumentId: string;
  token: string;
}): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;
  if (!args.token || args.token.length < 8) {
    return { ok: false, error: 'token looks too short' };
  }

  // App-level AES-256-GCM encryption (pgsodium is unusable on this tier).
  // The bytea column stores a `\x`-prefixed hex string — see kobo-crypto.ts.
  const ciphertext = encryptToken(args.token);
  const stored = '\\x' + ciphertext.toString('hex');

  const sb = createServiceClient();
  const { error } = await sb
    .from('evaluation_instruments')
    .update({ kobo_api_token_encrypted: stored })
    .eq('id', args.instrumentId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath('/admin/projects/[id]/evaluation', 'page');
  return { ok: true };
}

export async function setDashboardSpec(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;

  const evaluationId = String(formData.get('evaluation_id') ?? '');
  const specText = String(formData.get('spec') ?? '');
  let json: unknown;
  try {
    json = JSON.parse(specText);
  } catch {
    return { ok: false, error: 'spec is not valid JSON' };
  }
  const parsed = DashboardSpec.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Deactivate the prior config and insert version+1 in one atomic, advisory-
  // locked RPC (migration 0042). The previous read-modify-write across three
  // statements could collide on version or briefly leave NO active config
  // under concurrent saves. The RPC enforces admin-only via is_admin().
  const sb = await createClient();
  const { error } = await setDashboardSpecVersion(sb, {
    evaluation_id: evaluationId,
    spec: parsed.data,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath('/admin/projects/[id]/evaluation', 'page');
  return { ok: true };
}

export async function triggerManualSync(
  instrumentId: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;

  // 60s rate limit, keyed on caller + instrument (matches the sync route).
  // Keying on the instrument alone let one user's debounce lock out another
  // and didn't track per-user abuse.
  const rl = await checkRateLimit(
    'evaluations-sync',
    `${auth.userId}:${instrumentId}`,
    1,
    60,
  );
  if (!rl.ok) {
    return {
      ok: false,
      error: `Sync was triggered recently — try again in ${rl.retryAfterSeconds}s.`,
    };
  }

  // Call the ingest pipeline directly instead of self-HTTP to the sync route.
  try {
    await ingestInstrument({ instrumentId, trigger: 'manual' });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'sync failed',
    };
  }

  revalidatePath('/admin/projects/[id]/evaluation', 'page');
  return { ok: true };
}

export async function resolveIngestionIssue(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;

  const id = String(formData.get('id') ?? '');
  const sb = await createClient();
  const { error } = await sb
    .from('evaluation_ingestion_issues')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: auth.userId,
    })
    .eq('id', id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath('/admin/projects/[id]/evaluation', 'page');
  return { ok: true };
}
