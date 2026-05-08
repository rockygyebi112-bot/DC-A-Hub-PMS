import { redirect } from "next/navigation";
import { FolderKanban, LayoutDashboard, ListChecks, Users } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listWorkspaceProjects } from "@/lib/workspace/queries";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile: Awaited<ReturnType<typeof getCurrentProfile>>;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    return renderLayoutError("getCurrentProfile", err);
  }
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "staff") redirect("/portal");

  let projects: Awaited<ReturnType<typeof listWorkspaceProjects>>;
  try {
    projects = await listWorkspaceProjects();
  } catch (err) {
    return renderLayoutError("listWorkspaceProjects", err);
  }
  const activeCount = projects.filter((p) => p.status === "active").length;

  const groups = [
    {
      group: "Workspace",
      items: [
        { href: "/workspace", label: "Dashboard", icon: LayoutDashboard, exact: true },
        {
          href: "/workspace#projects",
          label: "Projects",
          icon: FolderKanban,
          badge: projects.length || undefined,
        },
      ],
    },
    {
      group: "Quick links",
      items: projects.slice(0, 5).map((p) => ({
        href: `/workspace/projects/${p.id}`,
        label: p.name,
        icon: ListChecks,
      })),
    },
    profile.role === "admin"
      ? {
          group: "Admin",
          items: [{ href: "/admin", label: "Admin console", icon: Users }],
        }
      : { items: [] },
  ].filter((g) => g.items.length > 0);

  const projectBrands = Object.fromEntries(
    projects.map((p) => [
      p.id,
      { name: p.client?.name ?? p.name, logoUrl: p.client?.logo_url ?? null },
    ]),
  );

  return (
    <AppShell
      brand="DC&A Hub"
      subtitle="Workspace"
      groups={groups}
      storageKey="workspace-sidebar-collapsed"
      defaultLogoUrl="/logo.png"
      projectBrands={projectBrands}
      projectPathPrefix="/workspace/projects"
      user={{ name: profile.fullName, email: profile.email }}
      sidebarFooter={
        <div className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Operations</p>
          <p className="mt-1">{activeCount} active / {projects.length} projects</p>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

function renderLayoutError(where: string, err: unknown) {
  const e = err as Error & { code?: string; details?: string; hint?: string };
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
        <h1 className="font-heading text-xl font-bold text-destructive">
          Workspace layout failed
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Source: <code className="font-mono">{where}</code>
        </p>
        <pre className="mt-4 overflow-auto rounded-lg bg-muted p-3 text-xs">
{`Name:    ${e?.name ?? "(no name)"}
Message: ${e?.message ?? "(no message)"}
Code:    ${e?.code ?? "(none)"}
Details: ${e?.details ?? "(none)"}
Hint:    ${e?.hint ?? "(none)"}
Stack:   ${e?.stack ?? "(no stack)"}`}
        </pre>
      </div>
    </div>
  );
}
