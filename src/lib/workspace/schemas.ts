import { z } from "zod";

const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" ? undefined : value));

export const phaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(2000).optional(),
  start_date: optionalDate,
  end_date: optionalDate,
});
export type PhaseInput = z.input<typeof phaseSchema>;
export type PhaseParsed = z.output<typeof phaseSchema>;

export const activitySchema = z.object({
  phase_id: z.string().uuid("Pick a phase"),
  name: z.string().trim().min(1, "Name is required").max(200),
  // `description` now stores plain notes/dependencies — Deliverable lives in
  // its own column, and Responsible is captured via `responsible`.
  description: z.string().trim().max(2000).optional(),
  deliverable: z.string().trim().max(500).optional(),
  planned_date: optionalDate,
  responsible: z.string().trim().max(200).optional(),
});

export type ActivityInput = z.input<typeof activitySchema>;
export type ActivityParsed = z.output<typeof activitySchema>;

export const activityUpdateSchema = activitySchema.extend({
  status: z.enum(["not_started", "in_progress", "done"]),
  completed_date: optionalDate,
  narrative_note: z.string().trim().max(5000).optional(),
});
export type ActivityUpdateInput = z.input<typeof activityUpdateSchema>;
export type ActivityUpdateParsed = z.output<typeof activityUpdateSchema>;

