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
    // Validate in JS rather than relying on the input's `required` attribute.
    // The file <input> is visually hidden inside the dropzone label, so the
    // browser's native "Please fill out this field" popup gets anchored to an
    // off-screen 1x1 element and ends up scroll-shifting the whole page
    // horizontally when the user submits with no file selected.
    const file = formData.get("workplan");
    const hasFile =
      file instanceof File ? file.size > 0 : typeof file === "string" && file.length > 0;
    if (!hasFile) {
      toast.error("Choose an Excel file before importing.");
      return;
    }
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
          Phase, activity, deliverable, notes, responsible, status
        </span>
        {/* The template link is a sibling <a> rendered inside the dropzone
            label. stopPropagation prevents the parent label's click from
            also opening the file picker when the user just wants the
            template. */}
        <a
          href="/api/workplan/template"
          download="workplan-template.xlsx"
          onClick={(event) => event.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <Download className="size-3" />
          Download blank template
        </a>
        <Input
          ref={fileRef}
          name="workplan"
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        />
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        <Upload className="size-4" />
        {pending ? "Importing..." : "Import workplan"}
      </Button>
    </form>
  );
}
