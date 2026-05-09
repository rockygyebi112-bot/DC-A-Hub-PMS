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
  description: z.string().trim().max(2000).optional(),
  planned_date: optionalDate,
  location: z.string().trim().max(200).optional(),
  responsible: z.string().trim().max(200).optional(),
});

export const proofLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Link URL is required")
    .url("Enter a valid URL (https://…)")
    // Reject javascript:, data:, file:, vbscript:, etc. which would otherwise
    // execute in the viewer's browser when rendered as an <a href>.
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "Only http(s) links are allowed",
    )
    .refine((value) => value.length <= 2048, "URL is too long"),
  file_name: z.string().trim().max(200).optional(),
  caption: z.string().trim().max(500).optional(),
});
export type ProofLinkInput = z.input<typeof proofLinkSchema>;
export type ActivityInput = z.input<typeof activitySchema>;
export type ActivityParsed = z.output<typeof activitySchema>;

export const activityUpdateSchema = activitySchema.extend({
  status: z.enum(["not_started", "in_progress", "done"]),
  completed_date: optionalDate,
  participants_count: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  narrative_note: z.string().trim().max(5000).optional(),
});
export type ActivityUpdateInput = z.input<typeof activityUpdateSchema>;
export type ActivityUpdateParsed = z.output<typeof activityUpdateSchema>;

