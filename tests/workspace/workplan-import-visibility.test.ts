import { describe, expect, it } from 'vitest';
import { parseWorkplanRowVisibility } from '@/lib/workspace/workplan-parse';

describe('workplan import visibility column', () => {
  it('accepts client_visible and internal', () => {
    expect(parseWorkplanRowVisibility('client_visible')).toEqual({ ok: true, value: 'client_visible' });
    expect(parseWorkplanRowVisibility('Client_Visible')).toEqual({ ok: true, value: 'client_visible' });
    expect(parseWorkplanRowVisibility('INTERNAL')).toEqual({ ok: true, value: 'internal' });
  });

  it('rejects missing visibility', () => {
    expect(parseWorkplanRowVisibility('')).toEqual({ ok: false, error: expect.stringMatching(/required/i) });
    expect(parseWorkplanRowVisibility(undefined)).toEqual({ ok: false, error: expect.stringMatching(/required/i) });
  });

  it('rejects unknown values', () => {
    expect(parseWorkplanRowVisibility('public')).toEqual({ ok: false, error: expect.stringMatching(/client_visible/i) });
  });
});
