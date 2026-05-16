import { ProofAccessButton } from "@/components/workspace/proof-access-button";
import type { WorkspaceProof } from "@/lib/workspace/queries";
import { cn } from "@/lib/utils";
import { fileVisuals } from "./file-visuals";
import { formatBytes } from "./format";

export function AttachmentChip({ proof }: { proof: WorkspaceProof }) {
  const meta = fileVisuals(proof);
  return (
    <ProofAccessButton
      proofId={proof.id}
      fileName={proof.file_name}
      caption={proof.caption}
      kind={proof.kind}
      hint={proof.kind === "link" ? proof.url : proof.mime_type}
      trigger={
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-background py-1.5 pl-1.5 pr-3 text-left text-xs transition-colors hover:bg-muted"
        >
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-bold uppercase text-white",
              meta.bg,
            )}
          >
            {meta.label}
          </span>
          <span className="truncate font-medium">{proof.file_name}</span>
          {proof.size_bytes && (
            <span className="shrink-0 text-muted-foreground">
              {formatBytes(proof.size_bytes)}
            </span>
          )}
        </button>
      }
    />
  );
}
