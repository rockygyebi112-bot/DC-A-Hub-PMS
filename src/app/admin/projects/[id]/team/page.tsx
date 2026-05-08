import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProject,
  listProjectMembers,
  listAssignableUsers,
} from "@/lib/admin/queries";
import { removeProjectMember } from "@/lib/admin/actions/members";
import { AssignMemberForm } from "@/components/admin/forms/assign-member-form";
import { InviteClientViewerForm } from "@/components/admin/forms/invite-client-viewer-form";

export default async function ProjectTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, members, staffCandidates, clientCandidates] = await Promise.all([
    getProject(id),
    listProjectMembers(id),
    listAssignableUsers(id, "staff"),
    listAssignableUsers(id, "client"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/projects/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to project
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{project.name} — Team</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <AssignMemberForm
          projectId={id}
          candidates={staffCandidates.map((c) => ({
            user_id: c.user_id,
            full_name: c.full_name,
            email: c.email,
          }))}
          projectRole="member"
          buttonLabel="Add staff member"
        />
        <AssignMemberForm
          projectId={id}
          candidates={clientCandidates.map((c) => ({
            user_id: c.user_id,
            full_name: c.full_name,
            email: c.email,
          }))}
          projectRole="viewer"
          buttonLabel="Add existing client viewer"
        />
        <InviteClientViewerForm projectId={id} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Global role</TableHead>
            <TableHead>Project role</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                No team members yet.
              </TableCell>
            </TableRow>
          )}
          {members.map((m) => {
            async function remove() {
              "use server";
              await removeProjectMember(id, m.id);
            }
            return (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.profile?.full_name}</TableCell>
                <TableCell>{m.profile?.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{m.profile?.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge>{m.project_role}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <form action={remove}>
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
