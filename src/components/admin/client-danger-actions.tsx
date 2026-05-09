"use client";

import { useTransition } from "react";
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

  function toggleArchive() {
    startTransition(async () => {
      const result = archived
        ? await restoreClient(clientId)
        : await archiveClient(clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? "Client restored" : "Client archived");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={archived ? "default" : "outline"}
        disabled={pending}
        onClick={toggleArchive}
      >
        {archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {pending
          ? archived
            ? "Restoring..."
            : "Archiving..."
          : archived
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
