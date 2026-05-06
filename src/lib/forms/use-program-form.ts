/**
 * Shared hook for program entry forms
 * Consolidates common form operations: loading, saving, auth checks
 */

"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TableName, TABLES } from "@/lib/db/tables";
import { toast } from "sonner";

export interface UseProgramFormOptions<T extends Record<string, unknown>> {
  tableName: TableName;
  requiredField?: string;
  requiredFieldLabel?: string;
  buildRecord: (formData: T, userId: string) => Record<string, unknown>;
  onSuccess?: () => void;
}

export interface UseProgramFormReturn<T> {
  saving: boolean;
  error: string | null;
  submitForm: (formData: T, editId?: string | null, isDraft?: boolean) => Promise<boolean>;
}

/**
 * Shared form submission hook for program entries
 * Handles auth checks, validation, and database operations
 */
export function useProgramForm<T extends Record<string, unknown>>(
  options: UseProgramFormOptions<T>
): UseProgramFormReturn<T> {
  const { tableName, requiredField, requiredFieldLabel, buildRecord, onSuccess } = options;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const submitForm = useCallback(
    async (formData: T, editId?: string | null, isDraft: boolean = false): Promise<boolean> => {
      setError(null);

      // Validation
      if (!isDraft && requiredField) {
        const value = formData[requiredField as keyof T];
        if (!value || String(value).trim() === "") {
          const message = `${requiredFieldLabel || requiredField} is required`;
          toast.error(message);
          setError(message);
          return false;
        }
      }

      setSaving(true);

      try {
        // Auth check
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          toast.error("You must be logged in");
          setError("Authentication required");
          setSaving(false);
          return false;
        }

        // Build and submit record
        const record = buildRecord(formData, user.id);

        let result;
        if (editId) {
          result = await supabase.from(tableName).update(record).eq("id", editId);
        } else {
          result = await supabase.from(tableName).insert(record);
        }

        if (result.error) {
          toast.error(result.error.message);
          setError(result.error.message);
          setSaving(false);
          return false;
        }

        // Success
        const action = isDraft ? "saved" : editId ? "updated" : "submitted";
        toast.success(`Entry ${action} successfully`);
        onSuccess?.();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [supabase, tableName, requiredField, requiredFieldLabel, buildRecord, onSuccess]
  );

  return { saving, error, submitForm };
}
