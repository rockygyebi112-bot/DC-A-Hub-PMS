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
import { listClients } from "@/lib/admin/queries";
import { ArchiveToggle } from "@/components/admin/archive-toggle";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.archived === "1";
  const rows = await listClients({ includeArchived });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="flex items-center gap-4">
          <ArchiveToggle />
          <Button render={<Link href="/admin/clients/new" />}>New client</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                No clients yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((c) => (
            <TableRow key={c.id} className={c.archived_at ? "opacity-60" : ""}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.contact_email ?? "—"}</TableCell>
              <TableCell>
                {c.archived_at ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : (
                  <Badge>Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" render={<Link href={`/admin/clients/${c.id}`} />}>
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
