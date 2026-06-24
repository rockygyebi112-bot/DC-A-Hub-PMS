import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { AGENTS, type AgentId } from "./registry";

// Root of the Claude Code skills tree, resolved from the project working
// directory. The same `.claude/skills/**` files power the CLI skills; the PMS
// reads them at runtime so there is one source of truth. (next.config.ts adds
// these to the serverless output file trace so they ship to production.)
const SKILLS_ROOT = path.join(process.cwd(), ".claude", "skills");

async function readSkillFile(relativePath: string): Promise<string | null> {
  // Guard against path traversal — every reference must stay inside SKILLS_ROOT.
  const resolved = path.resolve(SKILLS_ROOT, relativePath);
  if (resolved !== SKILLS_ROOT && !resolved.startsWith(SKILLS_ROOT + path.sep)) {
    return null;
  }
  try {
    return await fs.readFile(resolved, "utf8");
  } catch {
    return null;
  }
}

/**
 * Assemble an agent's system prompt from its skill `SKILL.md` plus the
 * reference files it declares in the registry. Missing files are skipped (the
 * loader is resilient to a renamed reference) but the SKILL.md is required.
 */
export async function buildSystemPrompt(agentId: AgentId): Promise<string> {
  const agent = AGENTS[agentId];

  const skillMd = await readSkillFile(path.join(agent.id, "SKILL.md"));
  if (!skillMd) {
    throw new Error(`Missing SKILL.md for agent "${agent.id}"`);
  }

  const sections: string[] = [
    `# Agent procedure (${agent.name})`,
    skillMd.trim(),
  ];

  for (const ref of agent.references) {
    // `_shared/x.md` lives directly under SKILLS_ROOT; other refs are relative
    // to the skill's own directory.
    const relPath = ref.startsWith("_shared/") ? ref : path.join(agent.id, ref);
    const content = await readSkillFile(relPath);
    if (content) {
      sections.push(`# Reference: ${ref}`, content.trim());
    }
  }

  return sections.join("\n\n---\n\n");
}
