import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { AGENTS, type AgentId } from "./registry";
import { buildSystemPrompt } from "./skill-loader";

// Opus 4.8 is the default; override per-deployment with AGENTS_MODEL if needed.
const MODEL = process.env.AGENTS_MODEL || "claude-opus-4-8";
// Streaming is used (see below), so we can give the model generous room.
const MAX_TOKENS = 32000;
// Server-side tool loops (web search) can pause; cap how many times we resume.
const MAX_CONTINUATIONS = 6;

// The skills were written for the Claude Code CLI, where the final step renders
// a Word .docx to disk. In the PMS there is no filesystem to write to and the
// output is shown in the browser, so we override that last step: produce the
// whole deliverable as Markdown in the response instead.
const WEB_MODE_INSTRUCTIONS = `
# Output mode (PMS web app — overrides any "render to .docx / write files" step)
You are running inside the DC&A Hub PMS web app, not the Claude Code CLI. You
CANNOT write files, run scripts, or render a .docx. Ignore any instruction in
the procedure above about writing to a path or using docx tooling.

Instead, return the COMPLETE deliverable as GitHub-flavored Markdown directly in
your response:
- Use Markdown headings, tables, and lists. Tables are fine for the evaluation
  matrix / relevant-experience / compliance tables.
- Keep every \`[REVIEW]\` and \`[ASSUMPTION]\` marker inline exactly where it belongs.
- End with the checklist the procedure calls for (compliance checklist for the
  proposal; design checklist for the evaluation design) as a final \`##\` section,
  including a list of all open \`[REVIEW]\`/\`[ASSUMPTION]\` items.
- Do not describe what you would do — produce the actual draft.
`.trim();

export type AgentRunResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: "no_api_key" | "bad_request" | "upstream"; error: string };

function userContent(agentId: AgentId, input: string): string {
  const trimmed = input.trim();
  if (AGENTS[agentId].inputMode === "scan") {
    return trimmed
      ? `Run an opportunity scan now. Focus the scan on: ${trimmed}`
      : `Run a broad opportunity scan now across the sources in the reference.`;
  }
  // ToR-driven agents.
  return `Here is the Terms of Reference to work from:\n\n${trimmed}`;
}

/** Collect the text from a finished message, ignoring thinking/tool blocks. */
function collectText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function runAgent(args: {
  agentId: AgentId;
  input: string;
}): Promise<AgentRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      code: "no_api_key",
      error:
        "ANTHROPIC_API_KEY is not configured on the server. Add it to the environment to enable the AI agents.",
    };
  }

  const agent = AGENTS[args.agentId];
  const system = `${await buildSystemPrompt(args.agentId)}\n\n---\n\n${WEB_MODE_INSTRUCTIONS}`;
  const client = new Anthropic({ apiKey });

  const tools = agent.webSearch
    ? [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 10 }]
    : undefined;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userContent(args.agentId, args.input) },
  ];

  try {
    // Stream server-side (avoids SDK HTTP timeouts at high max_tokens) and use
    // finalMessage() to get the assembled response. Resume on pause_turn, which
    // the web-search server tool can trigger when its sampling loop hits a cap.
    for (let i = 0; i < MAX_CONTINUATIONS; i++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system,
        messages,
        ...(tools ? { tools } : {}),
      });
      const message = await stream.finalMessage();

      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: message.content });
        continue;
      }

      return { ok: true, text: collectText(message.content), model: message.model };
    }
    return {
      ok: false,
      code: "upstream",
      error: "The agent did not finish within the allowed number of steps. Try a narrower request.",
    };
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      return { ok: false, code: "bad_request", error: err.message };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, code: "upstream", error: `Claude API error ${err.status}: ${err.message}` };
    }
    return {
      ok: false,
      code: "upstream",
      error: err instanceof Error ? err.message : "Unknown error running the agent.",
    };
  }
}
