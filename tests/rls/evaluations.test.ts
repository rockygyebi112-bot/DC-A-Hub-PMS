import { describe, expect, it } from 'vitest';
import { adminClient } from './setup';

describe('evaluations core tables', () => {
  it('evaluations / evaluation_instruments / evaluation_dashboard_configs exist', async () => {
    const admin = adminClient();
    const a = await admin.from('evaluations').select('id').limit(1);
    const b = await admin.from('evaluation_instruments').select('id').limit(1);
    const c = await admin.from('evaluation_dashboard_configs').select('id').limit(1);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(c.error).toBeNull();
  });
});
