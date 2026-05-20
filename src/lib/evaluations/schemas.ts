import { z } from 'zod';

export const evaluationCreateSchema = z.object({
  project_id: z.uuid(),
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  collection_target_n: z.coerce.number().int().positive().optional(),
});

export const evaluationUpdateSchema = evaluationCreateSchema.partial().extend({
  id: z.uuid(),
  status: z.enum(['draft','collecting','analyzing','closed']).optional(),
  dashboard_default_mode: z.enum(['auto','progress','findings']).optional(),
});

export const instrumentCreateSchema = z.object({
  evaluation_id: z.uuid(),
  kind: z.enum(['hh','cpic','custom']),
  name: z.string().min(2),
  kobo_form_id: z.string().min(1),
  schema_config: z.record(z.string(), z.string()).default({}),
});

export const instrumentUpdateSchema = instrumentCreateSchema.partial().extend({
  id: z.uuid(),
});

export const QC_STATUSES = [
  'pending','approved','edited','cancelled_redo','cancelled_dropped',
] as const;

export const qcActionSchema = z.object({
  response_id: z.uuid(),
  next_status: z.enum(QC_STATUSES),
});

export const filterStateSchema = z.object({
  region: z.string().optional(),
  district: z.string().optional(),
  community: z.string().optional(),
  gender: z.enum(['female','male','all']).default('all'),
  soco_exposure: z.string().default('All'),
});
export type FilterState = z.infer<typeof filterStateSchema>;
