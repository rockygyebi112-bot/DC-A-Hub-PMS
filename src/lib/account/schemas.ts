import { z } from "zod";

export const updateNameSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
});

export const updateEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  current_password: z.string().min(1, "Enter your current password"),
});

export const updatePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password is too long"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  })
  .refine((d) => d.new_password !== d.current_password, {
    path: ["new_password"],
    message: "New password must differ from current",
  });

export type UpdateNameInput = z.infer<typeof updateNameSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
