import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { isAgentId } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/run";

// Agent runs (especially the scanner's web search) can take a while; give the
// serverless function room. Vercel honours this up to the plan's ceiling.
export const maxDuration = 300;

const bodySchema = z.object({
  input: z.string().max(200_000).optional().default(""),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agent: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { agent } = await params;
  if (!isAgentId(agent)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await runAgent({ agentId: agent, input: parsed.input });

  if (!result.ok) {
    // no_api_key / bad_request are the caller's/operator's to fix → 400;
    // upstream failures are transient → 502.
    const status = result.code === "upstream" ? 502 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ text: result.text, model: result.model });
}
