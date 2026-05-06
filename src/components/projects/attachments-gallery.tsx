"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  deleteAttachment,
  getAttachmentSignedUrl,
  uploadAttachment,
} from "@/lib/projects/mutations";
import { listAttachments } from "@/lib/projects/queries";
import type { ProjectActivityAttachment } from "@/lib/projects/types";
import { cn } from "@/lib/utils";
import { ExternalLink, FileText, Trash2, UploadCloud } from "lucide-react";

const MAX_BYTES = 25 * 1024 * 1024;

interface Props {
  projectId: string;
  activityId: string;
  currentUserId: string;
  canUpload: boolean;
  canDelete: boolean;
  onChange: () => void;
  onCountChange?: (n: number) => void;
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsGallery({
  projectId,
  activityId,
  currentUserId,
  canUpload,
  canDelete,
  onChange,
  onCountChange,
}: Props) {
  const [items, setItems] = useState<ProjectActivityAttachment[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await listAttachments(activityId);
    setItems(list);
    onCountChange?.(list.length);

    const nextPreviews: Record<string, string> = {};
    await Promise.all(
      list.map(async (item) => {
        if (item.mime_type.startsWith("image/")) {
          nextPreviews[item.id] = await getAttachmentSignedUrl(item.file_path);
        }
      }),
    );
    setPreviews(nextPreviews);
  }, [activityId, onCountChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} exceeds 25 MB`);
        }

        await uploadAttachment({
          project_id: projectId,
          activity_id: activityId,
          uploaded_by: currentUserId,
          file,
        });
      }

      await refresh();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: ProjectActivityAttachment) {
    if (!confirm(`Delete ${item.file_name}?`)) return;
    await deleteAttachment(item.id, item.file_path);
    await refresh();
    onChange();
  }

  async function openInNewTab(item: ProjectActivityAttachment) {
    const url =
      previews[item.id] ?? (await getAttachmentSignedUrl(item.file_path));
    window.open(url, "_blank", "noreferrer");
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
          Proof of activity
        </h3>
        {canUpload && (
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#111827] transition hover:bg-[#F9FAFB]">
            <UploadCloud className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Upload"}
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf,.docx,.xlsx"
              disabled={uploading}
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-[#F7C1C1] bg-[#FCEBEB] px-3 py-2 text-[11px] text-[#A32D2D]">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <label
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-md border border-dashed border-[#D3D1C7] bg-white px-3 py-4 text-center text-[12px] text-[#6B7280]",
            !canUpload && "cursor-default",
          )}
        >
          {canUpload ? "Drop files here or click Upload" : "No files"}
        </label>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-2"
            >
              {previews[item.id] ? (
                <div className="relative h-10 w-10 overflow-hidden rounded-md bg-[#F3F4F6]">
                  <Image
                    src={previews[item.id]}
                    alt={item.file_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#E6F1FB] text-[#185FA5]">
                  <FileText className="h-4 w-4" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[#111827]">
                  {item.file_name}
                </p>
                <p className="text-[10px] text-[#6B7280]">
                  {formatBytes(item.size_bytes)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void openInNewTab(item)}
                className="rounded p-1 text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                title="Open file"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  className="rounded p-1 text-[#6B7280] transition hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                  title="Delete file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
