import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';
import { MAX_PROOF_BYTES, MAX_RECEIPT_BYTES } from '@/lib/uploads';

/**
 * Guards the mismatch that broke internal-task document uploads.
 *
 * Every upload surface posts its files through a Server Action, and Next caps
 * a Server Action body at 1 MB unless `experimental.serverActions.bodySizeLimit`
 * says otherwise. That cap is enforced by a stream transform *before* the
 * action body runs, so `validateUpload`'s 25 MB allowance never gets a say —
 * the request dies as a thrown ApiError(413), which is an uncaught server
 * error rather than an `{ ok: false }` result, so it escalates to the route's
 * error boundary and the user sees "Couldn't load this page" instead of a
 * toast explaining the real problem.
 *
 * Keep the configured limit at or above what `validateUpload` accepts.
 */

/** Minimal parser for the `SizeLimit` strings Next accepts ("25mb", "1 MB"). */
function parseSizeLimit(value: string | number): number {
  if (typeof value === 'number') return value;
  const match = /^\s*([\d.]+)\s*(b|kb|mb|gb)?\s*$/i.exec(value);
  if (!match) throw new Error(`Unparseable size limit: ${value}`);
  const scale = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Number(match[1]) * scale[(match[2] ?? 'b').toLowerCase() as keyof typeof scale];
}

describe('server action body size limit', () => {
  it('is configured at all (Next defaults to 1 MB, which is below every upload cap)', () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBeDefined();
  });

  it('accepts the largest upload validateUpload() advertises', () => {
    const configured = parseSizeLimit(
      nextConfig.experimental!.serverActions!.bodySizeLimit!,
    );
    expect(configured).toBeGreaterThanOrEqual(
      Math.max(MAX_PROOF_BYTES, MAX_RECEIPT_BYTES),
    );
  });
});
