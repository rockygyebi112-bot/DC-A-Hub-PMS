import { NextResponse, type NextRequest } from 'next/server';
import { ingestInstrument, type IngestResult } from '@/lib/evaluations/ingest';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireRole } from '@/lib/auth/require-role-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Vercel cron authenticates by sending `Authorization: Bearer <CRON_SECRET>`.
 * We accept either that header or `x-vercel-cron-secret` and do a loose
 * `.includes` match — good enough for a non-security-critical sync trigger.
 */
function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const headerSecret =
    req.headers.get('x-vercel-cron-secret') ?? req.headers.get('authorization');
  return !!secret && !!headerSecret && headerSecret.includes(secret);
}

type SyncEntry =
  | ({ instrument_id: string } & IngestResult)
  | { instrument_id: string; status: 'error'; error: string };

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const instrumentId = url.searchParams.get('instrument_id');
  const triggerParam = url.searchParams.get('trigger');

  const trigger: 'schedule' | 'manual' | 'backfill' =
    triggerParam === 'manual'
      ? 'manual'
      : triggerParam === 'backfill'
        ? 'backfill'
        : 'schedule';

  // Cron path: no auth, just the shared secret.
  // Manual / backfill: require staff or admin, plus rate limit on manual.
  if (!isCron(req)) {
    const auth = await requireRole(['admin', 'staff']);
    if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });
    if (trigger === 'backfill' && auth.role !== 'admin') {
      return new NextResponse('Forbidden', { status: 403 });
    }
    if (trigger === 'manual' && instrumentId) {
      const rl = await checkRateLimit(
        'evaluations-sync',
        instrumentId,
        1,
        60,
      );
      if (!rl.ok) return new NextResponse('Rate limited', { status: 429 });
    }
  }

  const sb = createServiceClient();

  // Resolve target instruments.
  let targets: { id: string }[] = [];
  if (instrumentId) {
    targets = [{ id: instrumentId }];
  } else {
    const { data, error } = await sb
      .from('evaluation_instruments')
      .select('id, evaluation_id, evaluations!inner(status)')
      .eq('evaluations.status', 'collecting');
    if (error) {
      console.error('[evaluations/sync] instrument lookup failed', error);
      return new NextResponse('Lookup failed', { status: 500 });
    }
    targets = (data ?? []).map((r) => ({ id: r.id }));
  }

  const results: SyncEntry[] = [];
  for (const t of targets) {
    try {
      const r = await ingestInstrument({ instrumentId: t.id, trigger });
      results.push({ instrument_id: t.id, ...r });
    } catch (e) {
      results.push({
        instrument_id: t.id,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ trigger, results });
}
