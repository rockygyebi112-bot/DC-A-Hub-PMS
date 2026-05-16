import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import type { WorkspaceProof } from "@/lib/workspace/queries";

/**
 * File-type → icon + colour mapping shared by the attachment chip and the
 * uploads list. Returns JSX so callers don't have to know the icon set.
 */
export function fileVisuals(proof: WorkspaceProof): {
  bg: string;
  label: string;
  icon: React.ReactNode;
} {
  if (proof.kind === "link") {
    return {
      bg: "bg-sky-500",
      label: "URL",
      icon: <ExternalLink className="size-4" />,
    };
  }
  const name = proof.file_name.toLowerCase();
  const mime = proof.mime_type ?? "";
  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    return { bg: "bg-red-500", label: "PDF", icon: <FileText className="size-4" /> };
  }
  if (name.endsWith(".doc") || name.endsWith(".docx") || mime.includes("word")) {
    return { bg: "bg-blue-500", label: "DOC", icon: <FileText className="size-4" /> };
  }
  if (
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv") ||
    mime.includes("sheet")
  ) {
    return {
      bg: "bg-emerald-500",
      label: "XLS",
      icon: <FileSpreadsheet className="size-4" />,
    };
  }
  if (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".gif") ||
    name.endsWith(".webp") ||
    mime.startsWith("image/")
  ) {
    return {
      bg: "bg-violet-500",
      label: "IMG",
      icon: <ImageIcon className="size-4" />,
    };
  }
  return {
    bg: "bg-slate-500",
    label: "FILE",
    icon: <FileText className="size-4" />,
  };
}
