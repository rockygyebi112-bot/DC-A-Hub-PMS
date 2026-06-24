// Registry of the DC&A Hub AI agents surfaced inside the PMS.
//
// This module is intentionally *data only* and client-safe: it is imported by
// both the server (the API route + skill loader) and client components (the
// agent pages). It must not import the Anthropic SDK, `node:fs`, or anything
// server-only — keep that in `skill-loader.ts` / `run.ts`.
//
// Each agent maps 1:1 to a Claude Code skill under `.claude/skills/<id>/`. The
// PMS reuses the *same* skill instructions + references as the canonical
// source of truth, so tuning a skill improves both the CLI and the web app.

export const AGENT_IDS = [
  "opportunity-scanner",
  "proposal-writer",
  "evaluation-designer",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

/** How the agent takes its input from the user. */
export type AgentInputMode =
  // Paste a Terms of Reference / RFP (or evaluation ToR) as text.
  | "tor"
  // No document needed; an optional free-text focus for a fresh scan.
  | "scan";

export type AgentDef = {
  id: AgentId;
  /** Lucide icon name resolved by the UI. */
  icon: "scan-search" | "file-pen" | "clipboard-list";
  name: string;
  /** One-line value proposition for the landing card. */
  tagline: string;
  inputMode: AgentInputMode;
  /** Label above the input control. */
  inputLabel: string;
  inputPlaceholder: string;
  /** Primary action button label. */
  runLabel: string;
  /** Whether the run needs the server-side web search tool (scanner only). */
  webSearch: boolean;
  /**
   * Files (relative to the skill dir) inlined into the system prompt, in order.
   * `SKILL.md` is always loaded first by the loader; list the references here.
   * Paths beginning with `_shared/` resolve against `.claude/skills/_shared/`.
   */
  references: string[];
};

export const AGENTS: Record<AgentId, AgentDef> = {
  "opportunity-scanner": {
    id: "opportunity-scanner",
    icon: "scan-search",
    name: "Opportunity Scanner",
    tagline:
      "Scan development-sector sources for tenders, RFPs and EOIs, then rank them bid / no-bid against DC&A Hub's capabilities.",
    inputMode: "scan",
    inputLabel: "Focus (optional)",
    inputPlaceholder:
      "Optional: narrow the scan, e.g. \"WASH and MEL tenders in West Africa\" or leave blank for a broad sweep.",
    runLabel: "Run scan",
    webSearch: true,
    references: [
      "_shared/writing-style.md",
      "_shared/dcahub-profile.md",
      "references/sources.md",
      "references/rubric.md",
    ],
  },
  "proposal-writer": {
    id: "proposal-writer",
    icon: "file-pen",
    name: "Proposal Writer",
    tagline:
      "Turn a ToR/RFP into a complete first-draft technical proposal or EOI in DC&A Hub's house style.",
    inputMode: "tor",
    inputLabel: "Paste the ToR / RFP text",
    inputPlaceholder:
      "Paste the full Terms of Reference or RFP here (copy the text out of the PDF/Word file)…",
    runLabel: "Draft proposal",
    webSearch: false,
    references: ["_shared/writing-style.md", "_shared/house-style.md", "_shared/dcahub-profile.md"],
  },
  "evaluation-designer": {
    id: "evaluation-designer",
    icon: "clipboard-list",
    name: "Evaluation Designer",
    tagline:
      "Turn an evaluation ToR into an inception-ready design — OECD-DAC evaluation matrix, sampling, methods, analysis and ethics.",
    inputMode: "tor",
    inputLabel: "Paste the evaluation ToR text",
    inputPlaceholder:
      "Paste the full evaluation Terms of Reference here (copy the text out of the PDF/Word file)…",
    runLabel: "Design evaluation",
    webSearch: false,
    references: ["_shared/writing-style.md", "references/evaluation-methods.md", "_shared/house-style.md"],
  },
};

export const AGENT_LIST: AgentDef[] = AGENT_IDS.map((id) => AGENTS[id]);
