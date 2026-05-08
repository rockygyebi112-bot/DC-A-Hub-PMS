import { z } from "zod";

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  contact_email: z
    .string()
    .trim()
    .email("Must be a valid email")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  logo_url: z
    .string()
    .url()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});
export type ClientFormInput = z.input<typeof clientFormSchema>;
export type ClientFormParsed = z.output<typeof clientFormSchema>;

export const projectStatusSchema = z.enum([
  "planning",
  "active",
  "paused",
  "completed",
]);

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, _ and - only"),
  client_id: z.string().uuid("Pick a client"),
  status: projectStatusSchema.default("planning"),
  description: z.string().max(2000).optional(),
  start_date: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  end_date: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});
export type ProjectFormInput = z.input<typeof projectFormSchema>;
export type ProjectFormParsed = z.output<typeof projectFormSchema>;

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Must be a valid email"),
  full_name: z.string().trim().max(200).optional(),
  role: z.enum(["staff", "client"]),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const assignMemberSchema = z.object({
  user_id: z.string().uuid(),
  project_role: z.enum(["member", "viewer"]),
});
export type AssignMemberInput = z.infer<typeof assignMemberSchema>;

export const inviteClientViewerSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().max(200).optional(),
});
export type InviteClientViewerInput = z.infer<typeof inviteClientViewerSchema>;

export const setUserRoleSchema = z.object({
  role: z.enum(["admin", "staff", "client"]),
});
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
