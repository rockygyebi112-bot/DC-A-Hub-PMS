import { describe, it, expect } from 'vitest';
import { completionPercent, spendPercent } from '@/lib/format/progress';

describe('completionPercent', () => {
  it('rounds to a whole percent', () => {
    expect(completionPercent(1, 3)).toBe(33);
    expect(completionPercent(2, 3)).toBe(67);
    expect(completionPercent(3, 4)).toBe(75);
  });

  it('treats an empty denominator as no progress, not NaN', () => {
    expect(completionPercent(0, 0)).toBe(0);
    expect(completionPercent(5, 0)).toBe(0);
    expect(completionPercent(1, -2)).toBe(0);
  });

  it('clamps to 0-100 so a stale done count cannot overflow a bar', () => {
    expect(completionPercent(7, 5)).toBe(100);
    expect(completionPercent(-3, 5)).toBe(0);
  });

  it('survives non-finite input', () => {
    expect(completionPercent(NaN, 5)).toBe(0);
    expect(completionPercent(1, Infinity)).toBe(0);
  });

  it('reports the exact ends', () => {
    expect(completionPercent(0, 9)).toBe(0);
    expect(completionPercent(9, 9)).toBe(100);
  });
});

describe('spendPercent', () => {
  it('reports overspend rather than hiding it', () => {
    expect(spendPercent(150, 100)).toBe(150);
  });

  it('caps absurd values so the layout cannot break', () => {
    expect(spendPercent(1_000_000, 100)).toBe(999);
  });

  it('treats a missing allocation as zero', () => {
    expect(spendPercent(50, 0)).toBe(0);
  });
});
