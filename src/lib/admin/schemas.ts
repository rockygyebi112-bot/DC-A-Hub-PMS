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

export const assignMemberSchema = z.object({
  user_id: z.string().uuid(),
  project_role: z.enum(["member", "viewer"]),
});
export type AssignMemberInput = z.infer<typeof assignMemberSchema>;

// Bulk variant for the multi-select assign dialog. Lets an admin add many
// staff (or viewers) to a project in one round-trip instead of clicking
// through the single-select dialog repeatedly.
export const assignMembersSchema = z.object({
  user_ids: z
    .array(z.string().uuid())
    .min(1, "Pick at least one user")
    .max(100, "Too many users in one batch"),
  project_role: z.enum(["member", "viewer"]),
});
export type AssignMembersInput = z.infer<typeof assignMembersSchema>;

export const inviteClientViewerSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().max(200).optional(),
});
export type InviteClientViewerInput = z.infer<typeof inviteClientViewerSchema>;

export const setUserRoleSchema = z.object({
  role: z.enum(["admin", "staff", "client"]),
});
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;

/* ---------------------------------------------------------------- */
/* Finance / Budget                                                  */
/* ---------------------------------------------------------------- */

const moneyString = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Use a valid amount")
  .transform((v) => (v === "" ? 0 : Number(v)));

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

// kept as utility (unused for now, exposed for future text inputs)
export const moneyTextSchema = moneyString;
