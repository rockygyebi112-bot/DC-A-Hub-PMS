import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { ingestInstrument, type IngestResult } from '@/lib/evaluations/ingest';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireRole } from '@/lib/auth/require-role-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Constant-time equality for two strings (length-safe). */
function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Vercel cron authenticates by sending `Authorization: Bearer <CRON_SECRET>`.
 * We accept the cron secret either as the raw `x-vercel-cron-secret` value or
 * as a `Bearer <secret>` Authorization header, and compare with a
 * constant-time EXACT match (no substring `.includes`, which both leaked via
 * timing and accepted any header merely containing the secret).
 */
function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const cronHeader = req.headers.get('x-vercel-cron-secret');
  if (cronHeader && secretsMatch(cronHeader, secret)) return true;

  const authz = req.headers.get('authorization');
  if (authz) {
    const presented = authz.startsWith('Bearer ')
      ? authz.slice('Bearer '.length)
      : authz;
    if (secretsMatch(presented, secret)) return true;
  }
  return false;
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
  // Otherwise: require staff or admin, and ALWAYS rate-limit — keyed on the
  // caller, not the instrument. The previous gate only fired for
  // `trigger=manual` WITH an instrument_id, so a caller could omit either and
  // trigger an unthrottled full-fleet ingest (expensive Kobo round-trips,
  // 300s budget) on a loop.
  if (!isCron(req)) {
    const auth = await requireRole(['admin', 'staff']);
    if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });
    if (trigger === 'backfill' && auth.role !== 'admin') {
      return new NextResponse('Forbidden', { status: 403 });
    }
    // Per-instrument syncs: 1 / 60s per instrument (debounce a single button).
    // Full-fleet syncs (no instrument_id): far stricter, since each one fans
    // out across every collecting instrument. Both keyed under the caller so
    // one user can't be locked out by another and can't evade by varying args.
    const rl = instrumentId
      ? await checkRateLimit(
          'evaluations-sync',
          `${auth.userId}:${instrumentId}`,
          1,
          60,
        )
      : await checkRateLimit('evaluations-sync-fleet', auth.userId, 2, 600);
    if (!rl.ok) return new NextResponse('Rate limited', { status: 429 });
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
      // L-5: log the real cause server-side; return a generic message so
      // upstream details (Kobo URLs, tokens embedded in errors) don't reach
      // the caller.
      console.error('[evaluations/sync] ingest failed', {
        instrument_id: t.id,
        error: e,
      });
      results.push({
        instrument_id: t.id,
        status: 'error',
        error: 'Sync failed for this instrument',
      });
    }
  }

  return NextResponse.json({ trigger, results });
}
