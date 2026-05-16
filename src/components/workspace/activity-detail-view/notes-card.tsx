import { GitBranch } from "lucide-react";
import { Card, Muted } from "./primitives";

export function NotesCard({ description }: { description: string | null }) {
  return (
    <Card icon={<GitBranch className="size-4" />} title="Notes">
      {description ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{description}</p>
      ) : (
        <Muted text="No notes yet." />
      )}
    </Card>
  );
}
