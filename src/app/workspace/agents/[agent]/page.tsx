import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { AGENTS, isAgentId } from "@/lib/agents/registry";
import { AgentRunner } from "@/components/workspace/agents/agent-runner";

export default async function AgentRunnerPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/");
  }

  const { agent: agentParam } = await params;
  if (!isAgentId(agentParam)) notFound();
  const agent = AGENTS[agentParam];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6">
      <div className="space-y-3">
        <Link
          href="/workspace/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Business Development
        </Link>
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-bold tracking-tight">{agent.name}</h1>
          <p className="text-sm text-muted-foreground">{agent.tagline}</p>
        </div>
      </div>

      <AgentRunner agent={agent} />
    </div>
  );
}
