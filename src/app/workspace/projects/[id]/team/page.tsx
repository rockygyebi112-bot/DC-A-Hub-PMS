import { notFound } from "next/navigation";
import { Crown, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { getWorkspaceProject, listProjectTeam } from "@/lib/workspace/queries";
import { SetBreadcrumbLabels } from "@/components/shell/breadcrumb-context";

export default async function WorkspaceTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [projectMaybe, team] = await Promise.all([
    getWorkspaceProject(id),
    listProjectTeam(id),
  ]);
  if (!projectMaybe) notFound();
  const project = projectMaybe;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SetBreadcrumbLabels labels={{ [id]: project.name }} />
      <PageHeader
        title={`${project.name} team`}
        subtitle="Project members and client viewers."
        backFallbackHref={`/workspace/projects/${id}`}
      />
      <SectionCard title="Team">
        {team.length === 0 ? (
          <EmptyState icon={Users} title="No team members" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Global role</TableHead>
                  <TableHead>Project role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((member) => {
                  const name = member.profile?.full_name ?? "Unknown user";
                  const email = member.profile?.email ?? "unknown@example.com";
                  const isManager = member.project_role === "manager";
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar email={email} name={name} size="sm" />
                          <span className="font-medium">{name}</span>
                          {isManager && (
                            <Crown
                              className="size-3.5 text-amber-500"
                              aria-label="Project Manager"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{member.profile?.email ?? "-"}</TableCell>
                      <TableCell>
                        <StatusPill status={(member.profile?.role ?? "client") as "admin" | "staff" | "client"} />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={member.project_role as "manager" | "member" | "viewer"} />
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
