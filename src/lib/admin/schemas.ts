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
    .refine(
      (v) => /^https?:\/\//i.test(v),
      "Only http(s) URLs are allowed",
    )
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

// Project roles a member row can hold. 'manager' is the designated
// Project Manager (one per project, write access + treated as the
// staff lead surfaced to clients). 'member' is a regular staff team
// member (write). 'viewer' is a client (read-only).
export const projectRoleSchema = z.enum(["manager", "member", "viewer"]);
export type ProjectRole = z.infer<typeof projectRoleSchema>;

// Combined "Add staff/client" dialog payload. Admin may pick any number of
// existing users AND/OR include a single new-invite block. Either side is
// optional but at least one must be present (validated server-side).
export const addTeamMembersSchema = z.object({
  kind: z.enum(["staff", "client"]),
  existing_user_ids: z.array(z.string().uuid()).max(100).default([]),
  invite_email: z
    .string()
    .trim()
    .email("Must be a valid email")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  invite_full_name: z
    .string()
    .trim()
    .max(200)
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  // Only honoured for kind='staff'. When true and exactly one user is being
  // added, that user becomes the project manager (clears any prior PM).
  make_manager: z.boolean().optional().default(false),
});
export type AddTeamMembersInput = z.input<typeof addTeamMembersSchema>;
export type AddTeamMembersParsed = z.output<typeof addTeamMembersSchema>;

export const setProjectManagerSchema = z.object({
  member_id: z.string().uuid(),
});
export type SetProjectManagerInput = z.infer<typeof setProjectManagerSchema>;

export const setUserRoleSchema = z.object({
  role: z.enum(["admin", "staff", "client"]),
});
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;

/* ---------------------------------------------------------------- */
/* Finance / Budget                                                  */
/* ---------------------------------------------------------------- */

const moneyNumber = z.coerce
  .number()
  .nonnegative("Amount must be 0 or greater")
  .max(1_000_000_000_000, "Amount is too large");

export const currencySchema = z
  .string()
  .trim()
  .min(1, "Currency required")
  .max(8)
  .toUpperCase();

export const budgetSetupSchema = z.object({
  total_amount: moneyNumber,
  currency: currencySchema.default("GHS"),
  notes: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});
export type BudgetSetupInput = z.input<typeof budgetSetupSchema>;
export type BudgetSetupParsed = z.output<typeof budgetSetupSchema>;

export const budgetCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  allocated_amount: moneyNumber,
});
export type BudgetCategoryInput = z.input<typeof budgetCategorySchema>;

export const expenseStatusSchema = z.enum([
  "planned",
  "incurred",
  "reimbursed",
  "cancelled",
]);

export const expenseSchema = z.object({
  category_id: z
    .string()
    .uuid()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  amount: moneyNumber.refine((v) => v > 0, "Amount must be greater than 0"),
  currency: currencySchema.default("GHS"),
  expense_date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date"),
  vendor: z
    .string()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  description: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  status: expenseStatusSchema.default("incurred"),
});
export type ExpenseInput = z.input<typeof expenseSchema>;
export type ExpenseParsed = z.output<typeof expenseSchema>;

