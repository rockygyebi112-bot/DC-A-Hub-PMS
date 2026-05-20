import { z } from 'zod';

export const CHART_TYPES = [
  'donut','bar_pct','stacked_bar','horizontal_bar',
  'heatmap','choropleth','progress_bars','trend_line',
] as const;
export type ChartType = (typeof CHART_TYPES)[number];

const ChartFilter = z.object({
  field: z.string(),
  eq: z.union([z.string(), z.number(), z.boolean()]).optional(),
  in: z.array(z.union([z.string(), z.number()])).optional(),
});

export const ChartEntry = z.object({
  type: z.enum(CHART_TYPES),
  field: z.string(),
  title: z.string(),
  by: z.string().optional(),
  filter: ChartFilter.optional(),
});
export type ChartEntry = z.infer<typeof ChartEntry>;

export const KpiEntry = z.object({
  id: z.string(),
  label: z.string(),
  instrument: z.string(),
  numerator: z.record(z.string(), z.unknown()),
  denominator: z.union([
    z.literal('all_responses'),
    z.literal('approved_responses'),
    z.literal('target_n'),
    z.literal('districts_total'),
    z.literal('qc_decided'),
  ]),
  format: z.enum(['percent','count','fraction']),
});
export type KpiEntry = z.infer<typeof KpiEntry>;

export const Section = z.object({
  id: z.string(),
  title: z.string(),
  charts: z.array(ChartEntry).min(1),
});
export type Section = z.infer<typeof Section>;

export const DashboardSpec = z.object({
  kpis: z.array(KpiEntry),
  sections: z.array(Section),
  disaggregations: z.object({
    geography: z.object({
      fields: z.array(z.string()).min(1),
      labels: z.array(z.string()).min(1),
    }),
    gender: z.object({ field: z.string() }),
    soco_exposure: z.record(
      z.string(),
      z.object({ field: z.string(), eq: z.union([z.string(), z.number(), z.boolean()]) }),
    ),
  }),
});
export type DashboardSpec = z.infer<typeof DashboardSpec>;
