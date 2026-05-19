import { z } from 'zod';

const optionalDate = z.string().optional().or(z.literal(''))
  .transform((v) => (v === '' ? undefined : v));

export const areaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type AreaInput = z.input<typeof areaSchema>;

export const taskSchema = z.object({
  area_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(['not_started', 'in_progress', 'blocked', 'done']).default('not_started'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  due_date: optionalDate,
});
export type TaskInput = z.input<typeof taskSchema>;
