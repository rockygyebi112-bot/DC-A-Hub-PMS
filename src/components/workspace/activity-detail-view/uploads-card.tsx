import { ProofAccessButton } from "@/components/workspace/proof-access-button";
import type { WorkspaceProof } from "@/lib/workspace/queries";
import { cn } from "@/lib/utils";
import { fileVisuals } from "./file-visuals";
import { formatBytes, formatShortDate } from "./format";

function FileRow({ proof }: { proof: WorkspaceProof }) {
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
          className="group/file flex w-full items-center gap-3 rounded-xl border bg-background p-2.5 text-left transition-colors hover:bg-muted/40"
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg text-white",
              meta.bg,
            )}
          >
            {meta.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {proof.file_name}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Uploaded {formatShortDate(proof.created_at)}
              {proof.caption ? ` · ${proof.caption}` : ""}
            </span>
          </span>
          <span className="ml-2 flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
            {proof.size_bytes ? formatBytes(proof.size_bytes) : null}
          </span>
        </button>
      }
    />
  );
}

export function UploadsCard({ proofs }: { proofs: WorkspaceProof[] }) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Uploads</h2>
        <span className="text-[11px] text-muted-foreground">
          {proofs.length} {proofs.length === 1 ? "item" : "items"}
        </span>
      </header>
      <div className="px-5 py-4">
        {proofs.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-5 text-center text-xs text-muted-foreground">
            No uploads yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {proofs.map((proof) => (
              <li key={proof.id}>
                <FileRow proof={proof} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
