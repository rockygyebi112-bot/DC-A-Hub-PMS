"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ImportSummary = {
  phasesCreated: number;
  activitiesCreated: number;
  activitiesUpdated: number;
};

type UploadPhase = "idle" | "uploading" | "processing" | "done";

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function WorkplanImportForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);

  const pending = phase === "uploading" || phase === "processing";

  function reset() {
    setPhase("idle");
    setProgress(0);
    setUploadedBytes(0);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("workplan");
    const hasFile =
      file instanceof File ? file.size > 0 : typeof file === "string" && file.length > 0;
    if (!hasFile) {
      toast.error("Choose an Excel file before importing.");
      return;
    }

    const totalBytes = file instanceof File ? file.size : 0;
    setPhase("uploading");
    setProgress(0);
    setUploadedBytes(0);

    // XHR is used here (instead of the server action) so we can surface real
    // upload byte progress via `xhr.upload.onprogress`. The server action
    // still owns all the import logic — the /api/workplan/import route is a
    // thin proxy over it.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/workplan/import/${projectId}`);

    xhr.upload.onprogress = (progressEvent) => {
      if (!progressEvent.lengthComputable) return;
      const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      setProgress(pct);
      setUploadedBytes(progressEvent.loaded);
    };

    xhr.upload.onload = () => {
      // File fully uploaded — server is now parsing/inserting rows.
      setProgress(100);
      setUploadedBytes(totalBytes);
      setPhase("processing");
    };

    xhr.onerror = () => {
      toast.error("Upload failed. Check your connection and try again.");
      reset();
    };

    xhr.onload = () => {
      let payload: { ok: boolean; error?: string; data?: ImportSummary } | null = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      if (!payload || !payload.ok) {
        toast.error(payload?.error ?? "Workplan import failed.");
        reset();
        return;
      }
      const summary = payload.data;
      toast.success(
        `Imported ${summary?.activitiesCreated ?? 0} activities, updated ${
          summary?.activitiesUpdated ?? 0
        }, added ${summary?.phasesCreated ?? 0} phases.`,
      );
      setPhase("done");
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
      router.refresh();
      // Reset the progress UI shortly after so the success state is visible.
      window.setTimeout(reset, 1500);
    };

    xhr.send(formData);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-background px-3 py-5 text-center transition-colors hover:bg-accent",
          pending && "pointer-events-none opacity-60",
        )}
      >
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
          disabled={pending}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            setFileName(selected?.name ?? "");
            setFileSize(selected?.size ?? 0);
          }}
        />
      </label>

      {phase !== "idle" && (
        <div
          className="space-y-3 rounded-lg border bg-muted/40 px-3 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium">
            <span className="text-foreground">
              {phase === "uploading"
                ? "Uploading workplan"
                : phase === "processing"
                  ? "Processing workplan"
                  : "Workplan imported"}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {phase === "uploading"
                ? `${progress}%`
                : phase === "processing"
                  ? "Step 2 of 3"
                  : "Done"}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-[width] duration-200",
                phase === "processing" && "animate-pulse",
              )}
              style={{
                width:
                  phase === "uploading"
                    ? `${progress}%`
                    : phase === "processing"
                      ? "66%"
                      : "100%",
              }}
            />
          </div>

          <ol className="grid grid-cols-3 gap-2 text-[11px] font-medium">
            {(
              [
                {
                  key: "upload",
                  label: "Upload",
                  caption:
                    phase === "uploading" && fileSize > 0
                      ? `${formatBytes(uploadedBytes)} of ${formatBytes(fileSize)}`
                      : phase === "uploading"
                        ? `${progress}%`
                        : "Complete",
                  state:
                    phase === "uploading"
                      ? ("active" as const)
                      : ("done" as const),
                },
                {
                  key: "process",
                  label: "Process",
                  caption:
                    phase === "uploading"
                      ? "Waiting"
                      : phase === "processing"
                        ? "Parsing rows"
                        : "Complete",
                  state:
                    phase === "uploading"
                      ? ("pending" as const)
                      : phase === "processing"
                        ? ("active" as const)
                        : ("done" as const),
                },
                {
                  key: "finish",
                  label: "Finish",
                  caption:
                    phase === "done" ? "Imported" : "Pending",
                  state:
                    phase === "done"
                      ? ("done" as const)
                      : ("pending" as const),
                },
              ] as const
            ).map((step) => {
              const Icon =
                step.state === "active"
                  ? Loader2
                  : step.state === "done"
                    ? Check
                    : null;
              return (
                <li
                  key={step.key}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
                    step.state === "active" && "border-primary/40",
                    step.state === "pending" && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                      step.state === "done" &&
                        "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
                      step.state === "active" &&
                        "border-primary/40 bg-primary/10 text-primary",
                      step.state === "pending" &&
                        "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {Icon ? (
                      <Icon
                        className={cn(
                          "size-3",
                          step.state === "active" && "animate-spin",
                        )}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-foreground">
                      {step.label}
                    </span>
                    <span className="block text-[10px] leading-tight text-muted-foreground">
                      {step.caption}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        <Upload className="size-4" />
        {phase === "uploading"
          ? "Uploading..."
          : phase === "processing"
            ? "Processing..."
            : "Import workplan"}
      </Button>
    </form>
  );
}
