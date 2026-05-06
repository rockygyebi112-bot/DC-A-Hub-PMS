"use client";

import { Button } from "@/components/ui/button";

interface FormActionsProps {
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  onCancel?: () => void;
}

export function FormActions({
  saving,
  submitLabel,
  onSubmit,
  onSaveDraft,
  onCancel,
}: FormActionsProps) {
  return (
    <div className="sticky bottom-3 z-20 pt-2">
      <div className="rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Required fields are marked with <span className="font-semibold">*</span>. Save a draft if you need to come back later.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            )}
            {onSaveDraft && (
              <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
                Save Draft
              </Button>
            )}
            <Button
              onClick={onSubmit}
              disabled={saving}
              className="bg-srsf-green-500 hover:bg-srsf-green-600 text-white sm:min-w-36"
            >
              {saving ? "Saving..." : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
