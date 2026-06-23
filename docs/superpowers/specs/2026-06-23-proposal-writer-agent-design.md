# DC&A Hub Proposal Writer Agent — Design Spec

**Date:** 2026-06-23
**Status:** Draft (pending user review of written spec)
**Authors:** Ishmael + Claude

## 1. Goal

Build a second AI agent for DC&A Hub — a Ghana-based research/M&E consultancy — that
turns a **Terms of Reference (ToR) / RFP** into a **complete first-draft submission**.
The agent reads the ToR, determines what is being asked (full technical proposal or
Expression of Interest), and drafts every required narrative section — including the
technical methodology — in DC&A Hub's house style, within the ToR's page/word limits,
delivered as a **Word `.docx`** the user reviews and submits.

This is the natural next link after the [Opportunity Scanner](2026-06-23-opportunity-scanner-agent-design.md):
the scanner decides *whether* to bid; the Proposal Writer drafts *what is submitted*.

## 2. Context & reuse

- Built as a Claude Code **skill** at `.claude/skills/proposal-writer/`, consistent with
  the opportunity-scanner skill.
- **Reuses the firm knowledge already built.** The Proposal Writer reads the *same*
  `dcahub-profile.md` (firm profile + 22-project track record) created for the scanner,
  at `../opportunity-scanner/references/dcahub-profile.md` — single source of truth,
  no duplication, no drift.
- Word generation uses the available `docx` document tooling at runtime.

## 3. Inputs

**Provided once (seed material, dropped into `references/`):**
- **Proposal template** — DC&A Hub's standard proposal/EOI template (section layout,
  cover page, formatting). File(s) under `references/template/`.
- **Past winning proposals** — 1–3 previous submissions (ideally winning) under
  `references/winning-proposals/`, for structure and tone anchoring.
- **`house-style.md`** — a short distilled style guide generated from the winning
  proposals (tone, section conventions, recurring framing).

**Provided per bid:**
- The **ToR / RFP** file (PDF or Word) to respond to.
- Optionally, the scanner's bid/no-bid note for that opportunity (extra context).

## 4. The ToR brief (what the agent extracts first)

Before drafting, the agent reads the ToR and produces a structured **ToR brief**:
- Submission type (full technical proposal vs. EOI/capability statement).
- Required sections / response structure.
- **Page or word limits** (overall and per-section if specified).
- Evaluation criteria and their weights.
- Mandatory/eligibility requirements (registration, experience thresholds, annexes).
- Format rules (font, margins, language) and submission deadline.

The ToR brief drives everything downstream; if a limit or requirement is unclear, the
agent records it as an explicit `[REVIEW]` note rather than guessing.

## 5. Procedure (the skill's steps)

1. **Analyze the ToR** → produce the ToR brief (Section 4).
2. **Plan the response** → allocate a **page budget** across required sections so the
   total respects the limit; auto-select the most relevant projects from the track
   record; choose the methodology approach to argue.
3. **Draft each section** in house style, anchored on the template structure and
   winning-proposal tone: cover letter, understanding/context, technical approach &
   methodology, workplan/activities, team & rationale (key-personnel summaries),
   relevant experience (selected), management & quality assurance.
4. **Compliance check** → verify every ToR requirement and evaluation criterion is
   addressed; insert `[REVIEW]` / `[ASSUMPTION]` markers where human input is needed;
   confirm the draft is within the page/word limit (trim if over).
5. **Render output** → write a Word `.docx` following the template's formatting, plus a
   `compliance-checklist.md`, into `proposals/<opportunity-slug>/`.

## 6. Output

A folder `proposals/<opportunity-slug>/` containing:
- `<opportunity-slug>-draft.docx` — the submittable first draft, within limits, in
  template format.
- `compliance-checklist.md` — a table mapping each ToR requirement / evaluation
  criterion to where it is addressed in the draft, plus a list of all `[REVIEW]` /
  `[ASSUMPTION]` markers the experts must resolve.

## 7. Architecture (logical units)

Each unit is independently understandable with a clear interface:

1. **Seed material** — `references/template/`, `references/winning-proposals/`,
   `references/house-style.md` (provided/distilled once).
2. **ToR analyzer** — ToR file → ToR brief (Section 4).
3. **Response planner** — ToR brief + firm profile → section plan with page budget and
   selected experience.
4. **Section drafter** — section plan → drafted prose per section, in house style.
5. **Compliance checker** — drafted prose + ToR brief → compliance checklist and
   `[REVIEW]` markers; enforces limits.
6. **Renderer** — drafted prose → formatted `.docx` (via docx tooling) + checklist file.

The `SKILL.md` encodes steps 2–6 as procedure; units 1 are data.

## 8. Quality & safety rules

- **Never fabricate** experience, references, personnel, certifications, or numbers.
  Only use projects/people present in the firm profile/track record; anything else is a
  `[REVIEW]` marker.
- **Methodology is a draft, not gospel** — always clearly a starting point for expert
  review; flag assumptions.
- **Respect limits** — if the draft exceeds the ToR page/word limit, trim lowest-value
  content rather than submitting over-limit.
- **Honour the template** — match the user's template structure/formatting; do not
  invent a different layout.

## 9. Non-goals (v1)

- No **budget / financial proposal** (separate Budget agent later).
- No full formatted **CV annexes** (user attaches; agent includes key-personnel summaries).
- No automatic submission — the agent drafts; the human reviews and submits.
- No direct integration with the scanner yet (manual hand-off of context for now).

## 10. Success criteria

- Given a real ToR + the seed material, the agent produces a `.docx` that (a) follows
  the ToR's required structure, (b) is within the stated page/word limit, (c) addresses
  every evaluation criterion (per the compliance checklist), and (d) reads in DC&A Hub's
  house style with real, relevant track-record examples.
- A reviewer can go from the draft to a submittable proposal by editing, not rewriting.
- No fabricated experience or personnel.

## 11. Open questions / to confirm during build

- File formats of the template and winning proposals (PDF vs. Word) — affects how the
  agent reads them; both are supported.
- Whether any ToRs require languages other than English (e.g. French for some donors).
- How `<opportunity-slug>` is chosen (default: short kebab-case from the ToR title/donor).
