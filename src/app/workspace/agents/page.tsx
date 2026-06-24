import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, FilePen, ScanSearch, type LucideIcon } from "lucide-react";

import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { AGENT_LIST, type AgentDef } from "@/lib/agents/registry";

const ICONS: Record<AgentDef["icon"], LucideIcon> = {
  "scan-search": ScanSearch,
  "file-pen": FilePen,
  "clipboard-list": ClipboardList,
};

export default async function AgentsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-bold tracking-tight">Business Development</h1>
        <p className="text-sm text-muted-foreground">
          AI agents that help DC&A Hub find work, win it, and deliver it. Each produces a first
          draft for expert review — never a final submission.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {AGENT_LIST.map((agent) => {
          const Icon = ICONS[agent.icon];
          return (
            <Link
              key={agent.id}
              href={`/workspace/agents/${agent.id}`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-heading text-sm font-semibold tracking-tight">{agent.name}</h2>
                <p className="text-sm text-muted-foreground">{agent.tagline}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
