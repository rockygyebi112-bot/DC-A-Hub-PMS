"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { unlockProjectDocuments, type UnlockedDocument } from "@/lib/portal/actions";
import { cn } from "@/lib/utils";

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function fileTypePill(name: string, mime: string | null) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  const knownExt = ["PDF", "XLSX", "DOCX", "CSV", "PPTX", "PNG", "JPG", "JPEG"];
  if (knownExt.includes(ext)) return ext === "JPEG" ? "JPG" : ext;
  if (mime?.includes("pdf")) return "PDF";
  if (mime?.includes("sheet")) return "XLSX";
  if (mime?.includes("word")) return "DOCX";
  if (mime?.startsWith("image/")) return "IMG";
  return "FILE";
}

function fileIcon(pill: string) {
  if (pill === "PDF") return { Icon: FileText, color: "text-red-600 bg-red-50" };
  if (pill === "XLSX" || pill === "CSV")
    return { Icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50" };
  if (pill === "DOCX")
    return { Icon: FileText, color: "text-blue-600 bg-blue-50" };
  if (pill === "IMG" || pill === "JPG" || pill === "PNG")
    return { Icon: ImageIcon, color: "text-purple-600 bg-purple-50" };
  return { Icon: FileText, color: "text-muted-foreground bg-muted" };
}

type Group = {
  phaseName: string;
  activities: {
    activityId: string;
    activityName: string;
    documents: UnlockedDocument[];
  }[];
};

function groupDocuments(docs: UnlockedDocument[]): Group[] {
  const byPhase = new Map<string, Map<string, UnlockedDocument[]>>();
  for (const d of docs) {
    const phaseKey = d.phaseName ?? "Unsorted";
    const activityKey = d.activityId;
    if (!byPhase.has(phaseKey)) byPhase.set(phaseKey, new Map());
    const phaseGroup = byPhase.get(phaseKey)!;
    if (!phaseGroup.has(activityKey)) phaseGroup.set(activityKey, []);
    phaseGroup.get(activityKey)!.push(d);
  }
  return Array.from(byPhase.entries()).map(([phaseName, activities]) => ({
    phaseName,
    activities: Array.from(activities.entries()).map(([activityId, documents]) => ({
      activityId,
      activityName: documents[0]?.activityName ?? "Activity",
      documents,
    })),
  }));
}

export function UploadsGate({
  projectId,
  totalCount,
}: {
  projectId: string;
  totalCount: number;
}) {
  const [password, setPassword] = useState("");
  const [ack, setAck] = useState(false);
  const [pending, startTransition] = useTransition();
  const [documents, setDocuments] = useState<UnlockedDocument[] | null>(null);

  const groups = useMemo(
    () => (documents ? groupDocuments(documents) : []),
    [documents],
  );

  function unlock() {
    if (!ack) {
      toast.error("Please acknowledge the confidentiality notice");
      return;
    }
    if (!password) {
      toast.error("Enter your account password to continue");
      return;
    }
    startTransition(async () => {
      const res = await unlockProjectDocuments(projectId, password);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDocuments(res.data);
      setPassword("");
      toast.success(
        `Unlocked ${res.data.length} document${res.data.length === 1 ? "" : "s"} — your access has been logged`,
      );
    });
  }

  if (documents === null) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-[14px] border bg-card p-6 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              Confirm your identity to view uploads
            </h2>
            <p className="text-xs text-muted-foreground">
              {totalCount === 0
                ? "This project has no uploads yet, but access is still protected."
                : `${totalCount} confidential document${totalCount === 1 ? "" : "s"} are protected by project access controls.`}{" "}
              Your view will be recorded (who, when, IP, and device) and is
              visible to administrators and project leads.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="uploads-password"
              className="block text-xs font-medium text-muted-foreground"
            >
              Confirm with your account password
            </label>
            {/* Honeypot fields trick browser autofill into ignoring the real
                password input so the user has to type it every time. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden
              style={{ display: "none" }}
              readOnly
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden
              style={{ display: "none" }}
              readOnly
            />
            <Input
              id="uploads-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your sign-in password"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  unlock();
                }
              }}
            />
          </div>

          <label className="flex items-start gap-2">
            <Checkbox
              checked={ack}
              onCheckedChange={(value) => setAck(value === true)}
            />
            <span className="text-xs text-muted-foreground">
              I understand this material is confidential and I am authorised to
              access it for legitimate project work.
            </span>
          </label>

          <Button
            type="button"
            onClick={unlock}
            disabled={pending || !ack || !password}
            className="w-full"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Unlocking…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                Unlock uploads
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-[14px] border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
        No uploads have been shared for this project yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        <ShieldCheck className="size-4" />
        Unlocked for this session. Links expire after 5 minutes — refresh the
        page to relock.
      </div>

      {groups.map((group) => (
        <section
          key={group.phaseName}
          className="rounded-[14px] border bg-card shadow-card"
        >
          <header className="border-b px-5 py-3">
            <h3 className="font-heading text-sm font-semibold tracking-tight">
              {group.phaseName}
            </h3>
          </header>
          <div className="divide-y">
            {group.activities.map((activity) => (
              <div key={activity.activityId} className="px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {activity.activityName}
                </p>
                <ul className="mt-2 space-y-2">
                  {activity.documents.map((doc) => {
                    const isLink = doc.kind === "link";
                    const pill = isLink
                      ? "LINK"
                      : fileTypePill(doc.fileName, doc.mimeType);
                    const { Icon, color } = isLink
                      ? { Icon: ExternalLink, color: "text-muted-foreground bg-muted" }
                      : fileIcon(pill);
                    return (
                      <li key={doc.id}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-accent"
                        >
                          <span
                            className={cn(
                              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                              color,
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{doc.fileName}</p>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="rounded border px-1.5 py-px font-mono text-[10px] font-semibold tracking-wide">
                                {pill}
                              </span>
                              <span>{formatDate(doc.createdAt)}</span>
                              {doc.caption && (
                                <span className="truncate">· {doc.caption}</span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
