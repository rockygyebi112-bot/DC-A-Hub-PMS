"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import {
  archiveClient,
  deleteClientOrg,
  restoreClient,
} from "@/lib/admin/actions/clients";

export function ClientDangerActions({
  clientId,
  clientName,
  archived,
}: {
  clientId: string;
  clientName: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Optimistic flip: the button label/icon updates instantly, then the
  // transition runs the server action. If the action fails the state reverts
  // automatically because useOptimistic only commits inside a transition.
  const [optimisticArchived, flipArchived] = useOptimistic(
    archived,
    (_state, next: boolean) => next,
  );

  function toggleArchive() {
    const next = !optimisticArchived;
    startTransition(async () => {
      flipArchived(next);
      const result = next
        ? await archiveClient(clientId)
        : await restoreClient(clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Client archived" : "Client restored");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={optimisticArchived ? "default" : "outline"}
        disabled={pending}
        onClick={toggleArchive}
      >
        {optimisticArchived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {pending
          ? optimisticArchived
            ? "Restoring..."
            : "Archiving..."
          : optimisticArchived
            ? "Restore client"
            : "Archive client"}
      </Button>

      <DeleteConfirm
        trigger={
          <Button variant="destructive">
            <Trash2 className="size-4" />
            Delete client
          </Button>
        }
        title="Delete client"
        description={
          <>
            This permanently deletes <strong>{clientName}</strong>. Clients with
            projects cannot be deleted; archive them instead to preserve project
            history.
          </>
        }
        confirmWord="DELETE"
        confirmLabel="Delete permanently"
        redirectTo="/admin/clients"
        action={() => deleteClientOrg(clientId)}
      />
    </div>
  );
}
