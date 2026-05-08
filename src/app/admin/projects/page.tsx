import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listProjects } from "@/lib/admin/queries";
import { ArchiveToggle } from "@/components/admin/archive-toggle";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listProjects({ includeArchived: sp.archived === "1" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <div className="flex items-center gap-4">
          <ArchiveToggle />
          <Button render={<Link href="/admin/projects/new" />}>New project</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                No projects yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((p) => (
            <TableRow key={p.id} className={p.archived_at ? "opacity-60" : ""}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell><code>{p.code}</code></TableCell>
              <TableCell>{p.client?.name ?? "—"}</TableCell>
              <TableCell>
                {p.archived_at ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : (
                  <Badge>{p.status}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={`/admin/projects/${p.id}`} />}
                >
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
