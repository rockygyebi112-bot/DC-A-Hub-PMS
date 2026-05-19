import { describe, expect, it } from 'vitest';
import { activitySchema, activityUpdateSchema } from '@/lib/workspace/schemas';

describe('activitySchema visibility field', () => {
  it('rejects missing visibility', () => {
    const r = activitySchema.safeParse({
      phase_id: '00000000-0000-0000-0000-000000000000',
      name: 'X',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('visibility'))).toBe(true);
    }
  });

  it('accepts client_visible and internal', () => {
    const base = { phase_id: '00000000-0000-0000-0000-000000000000', name: 'X' };
    expect(activitySchema.safeParse({ ...base, visibility: 'client_visible' }).success).toBe(true);
    expect(activitySchema.safeParse({ ...base, visibility: 'internal' }).success).toBe(true);
  });

  it('rejects unknown visibility value', () => {
    const r = activitySchema.safeParse({
      phase_id: '00000000-0000-0000-0000-000000000000',
      name: 'X',
      visibility: 'private',
    });
    expect(r.success).toBe(false);
  });

  it('activityUpdateSchema also requires visibility', () => {
    const r = activityUpdateSchema.safeParse({
      phase_id: '00000000-0000-0000-0000-000000000000',
      name: 'X',
      status: 'not_started',
    });
    expect(r.success).toBe(false);
  });
});
