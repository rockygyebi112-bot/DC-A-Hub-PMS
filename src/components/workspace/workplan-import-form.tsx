"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importWorkplanSheet } from "@/lib/workspace/actions";

export function WorkplanImportForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await importWorkplanSheet(projectId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const summary = result.data;
      toast.success(
        `Imported ${summary?.activitiesCreated ?? 0} activities, updated ${
          summary?.activitiesUpdated ?? 0
        }, added ${summary?.phasesCreated ?? 0} phases.`,
      );
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-background px-3 py-5 text-center transition-colors hover:bg-accent">
        <FileSpreadsheet className="mb-2 size-5 text-primary" />
        <span className="text-sm font-medium">
          {fileName || "Upload Excel checklist"}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          Category, activity, deliverable, status, notes, responsible
        </span>
        <Input
          ref={fileRef}
          name="workplan"
          type="file"
          accept=".xlsx,.xls,.csv"
          required
          className="sr-only"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        />
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <Button type="submit" disabled={pending}>
          <Upload className="size-4" />
          {pending ? "Importing..." : "Import workplan"}
        </Button>
        {/* Renders as an anchor so the browser handles the file download
            directly; we don't want this inside the <form> submit flow. */}
        <Button
          type="button"
          variant="outline"
          render={
            <a
              href="/api/workplan/template"
              download="workplan-template.xlsx"
            />
          }
        >
          <Download className="size-4" />
          Download template
        </Button>
      </div>
    </form>
  );
}
