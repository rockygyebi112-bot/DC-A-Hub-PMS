import { MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { AttachmentChip } from "./attachment-chip";
import { Card } from "./primitives";
import type { FeedItem } from "./types";

export function UpdatesCard({
  updates,
  composer,
}: {
  updates: FeedItem[];
  composer: React.ReactNode;
}) {
  return (
    <Card icon={<MessageSquare className="size-4" />} title="Updates">
      {updates.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground">
          No updates yet. Share progress with the team below.
        </p>
      ) : (
        <ul className="space-y-5">
          {updates.map((u, i) => (
            <li key={u.id} className="flex gap-3">
              <UserAvatar email={u.email} name={u.actor} size="md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">
                    {u.actor}
                  </span>
                  {i === 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Latest
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{u.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {u.body}
                </p>
                {u.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {u.attachments.map((p) => (
                      <AttachmentChip key={p.id} proof={p} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {composer && <div className="mt-5">{composer}</div>}
    </Card>
  );
}
