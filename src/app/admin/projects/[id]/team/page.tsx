import { notFound } from "next/navigation";
import { Crown, Users } from "lucide-react";
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
import { AddTeamMemberForm } from "@/components/admin/forms/add-team-member-form";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import {
  removeProjectMember,
  setProjectManager,
  unsetProjectManager,
} from "@/lib/admin/actions/members";
import {
  getProject,
  listAssignableUsers,
  listProjectMembers,
} from "@/lib/admin/queries";
import { SetBreadcrumbLabels } from "@/components/shell/breadcrumb-context";

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
  const hasManager = members.some((m) => m.project_role === "manager");

  return (
    <div className="max-w-5xl space-y-6">
      <SetBreadcrumbLabels labels={{ [id]: project.name }} />
      <PageHeader
        title={`${project.name} team`}
        subtitle={`${members.length} member${members.length === 1 ? "" : "s"} with project access`}
        backFallbackHref={`/admin/projects/${id}`}
        action={
          <div className="flex flex-wrap gap-2">
            <AddTeamMemberForm
              projectId={id}
              kind="staff"
              hasManager={hasManager}
              candidates={staffCandidates.map((candidate) => ({
                user_id: candidate.user_id,
                full_name: candidate.full_name,
                email: candidate.email,
                role: candidate.role as "admin" | "staff" | "client",
              }))}
            />
            <AddTeamMemberForm
              projectId={id}
              kind="client"
              hasManager={hasManager}
              candidates={clientCandidates.map((candidate) => ({
                user_id: candidate.user_id,
                full_name: candidate.full_name,
                email: candidate.email,
                role: candidate.role as "admin" | "staff" | "client",
              }))}
            />
          </div>
        }
      />

      <SectionCard
        title="Team access"
        description="Staff manage the workplan and upload documents. One staff person can be designated Project Manager. Clients get read-only progress visibility."
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
                  async function promote() {
                    "use server";
                    await setProjectManager(id, { member_id: member.id });
                  }
                  async function demote() {
                    "use server";
                    await unsetProjectManager(id);
                  }

                  const profile = member.profile;
                  const displayName = profile?.full_name ?? "Unknown user";
                  const email = profile?.email ?? "unknown@example.com";
                  const isClient = member.project_role === "viewer";
                  const isManager = member.project_role === "manager";

                  return (
                    <TableRow key={member.id} style={{ height: "var(--admin-row-h)" }}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar email={email} name={displayName} size="sm" />
                          <span className="font-medium">{displayName}</span>
                          {isManager && (
                            <Crown
                              className="size-3.5 text-amber-500"
                              aria-label="Project Manager"
                            />
                          )}
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
                        <div className="flex justify-end gap-1">
                          {!isClient &&
                            (isManager ? (
                              <form action={demote}>
                                <Button type="submit" variant="ghost" size="sm">
                                  Remove as PM
                                </Button>
                              </form>
                            ) : (
                              <form action={promote}>
                                <Button type="submit" variant="ghost" size="sm">
                                  Make PM
                                </Button>
                              </form>
                            ))}
                          <form action={remove}>
                            <Button type="submit" variant="ghost" size="sm">
                              Remove
                            </Button>
                          </form>
                        </div>
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
