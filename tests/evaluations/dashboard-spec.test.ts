import { describe, expect, it } from 'vitest';
import { DashboardSpec } from '@/lib/evaluations/dashboard-spec';

const goodSpec = {
  kpis: [
    { id: 'a', label: 'A', instrument: 'hh', numerator: { field: 'x', eq: 1 },
      denominator: 'all_responses', format: 'percent' },
  ],
  sections: [
    { id: 's1', title: 'S1', charts: [{ type: 'donut', field: 'x', title: 'X' }] },
  ],
  disaggregations: {
    geography: { fields: ['region','district','community'],
                 labels: ['Region','District','Community'] },
    gender: { field: 'gender' },
    soco_exposure: { 'Heard of SOCO': { field: 'x', eq: 1 } },
  },
};

describe('DashboardSpec', () => {
  it('accepts a well-formed spec', () => {
    expect(() => DashboardSpec.parse(goodSpec)).not.toThrow();
  });

  it('rejects an unknown chart type', () => {
    const bad = structuredClone(goodSpec);
    (bad.sections[0].charts[0] as { type: string }).type = 'pie3d';
    expect(() => DashboardSpec.parse(bad)).toThrow();
  });

  it('rejects a KPI with no denominator', () => {
    const bad = structuredClone(goodSpec);
    delete (bad.kpis[0] as Partial<typeof bad.kpis[0]>).denominator;
    expect(() => DashboardSpec.parse(bad)).toThrow();
  });
});
