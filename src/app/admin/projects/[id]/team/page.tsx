import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignMemberForm } from "@/components/admin/forms/assign-member-form";
import { InviteClientViewerForm } from "@/components/admin/forms/invite-client-viewer-form";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { removeProjectMember } from "@/lib/admin/actions/members";
import {
  getProject,
  listAssignableUsers,
  listProjectMembers,
} from "@/lib/admin/queries";

export default async function ProjectTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [projectMaybe, members, staffCandidates, clientCandidates] = await Promise.all([
    getProject(id),
    listProjectMembers(id),
    listAssignableUsers(id, "staff"),
    listAssignableUsers(id, "client"),
  ]);
  if (!projectMaybe) notFound();
  const project = projectMaybe;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={`${project.name} team`}
        subtitle={`${members.length} member${members.length === 1 ? "" : "s"} with project access`}
        backFallbackHref={`/admin/projects/${id}`}
        action={
          <div className="flex flex-wrap gap-2">
            <AssignMemberForm
              projectId={id}
              candidates={staffCandidates.map((candidate) => ({
                user_id: candidate.user_id,
                full_name: candidate.full_name,
                email: candidate.email,
              }))}
              projectRole="member"
              buttonLabel="Add staff"
            />
            <AssignMemberForm
              projectId={id}
              candidates={clientCandidates.map((candidate) => ({
                user_id: candidate.user_id,
                full_name: candidate.full_name,
                email: candidate.email,
              }))}
              projectRole="viewer"
              buttonLabel="Add viewer"
            />
            <InviteClientViewerForm projectId={id} />
          </div>
        }
      />

      <SectionCard
        title="Team access"
        description="Staff get delivery access. Client viewers get read-only progress visibility."
      >
        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Add staff or invite a client viewer to give them access."
          />
        ) : (
          <div className="overflow-x-auto">
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
                {members.map((member) => {
                  async function remove() {
                    "use server";
                    await removeProjectMember(id, member.id);
                  }

                  const profile = member.profile;
                  const displayName = profile?.full_name ?? "Unknown user";
                  const email = profile?.email ?? "unknown@example.com";

                  return (
                    <TableRow key={member.id} style={{ height: "var(--admin-row-h)" }}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar email={email} name={displayName} size="sm" />
                          <span className="font-medium">{displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{profile?.email ?? "-"}</TableCell>
                      <TableCell>
                        <StatusPill
                          status={(profile?.role ?? "client") as "admin" | "staff" | "client"}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={member.project_role} />
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
        )}
      </SectionCard>
    </div>
  );
}
