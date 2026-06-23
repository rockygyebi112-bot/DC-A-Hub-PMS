# DC&A Hub Proposal Writer Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a prompt-driven Claude Code skill that turns a ToR/RFP into a complete first-draft submission (technical proposal or EOI) as a Word `.docx`, within page limits and in DC&A Hub's house style.

**Architecture:** A project skill at `.claude/skills/proposal-writer/` made of a `SKILL.md` procedure plus reference material: a distilled `house-style.md`, the firm's past winning proposals (kept local, gitignored), and the shared firm profile reused from the opportunity-scanner skill. At runtime the agent reads the ToR, extracts a structured "ToR brief", plans a section/page budget, drafts each section in house style, runs a compliance check, and renders a `.docx` using the available docx tooling.

**Tech Stack:** Claude Code skill (Markdown + frontmatter); the `docx` document tooling for Word generation/reading; the firm profile from `../opportunity-scanner/references/dcahub-profile.md`. No npm deps, no build step.

**Note on "tests":** Like the scanner, this deliverable is instructions + data, not unit-testable code. The validation task *runs the skill against a real ToR and inspects the produced `.docx` + compliance checklist*. No pytest/vitest by design.

---

## File Structure

| File | Responsibility |
|---|---|
| `.claude/skills/proposal-writer/SKILL.md` | The agent procedure: analyze ToR → plan → draft → compliance → render. |
| `.claude/skills/proposal-writer/references/house-style.md` | Distilled DC&A Hub proposal structure + tone (committed). |
| `.claude/skills/proposal-writer/references/winning-proposals/` | Raw past proposals for deep reference (gitignored, local only). |
| `proposals/.gitkeep` | Keeps the output folder in git. |
| `proposals/<slug>/<slug>-draft.docx` | Run output (runtime-created). |
| `proposals/<slug>/compliance-checklist.md` | Run output (runtime-created). |
| `.gitignore` (modify) | Ignore the raw winning-proposals folder. |

Reused (not created): `.claude/skills/opportunity-scanner/references/dcahub-profile.md`.

---

## Task 1: Scaffold the skill and seed the winning proposals

**Files:**
- Create: `.claude/skills/proposal-writer/references/winning-proposals/` (with the 4 docx copied in)
- Create: `proposals/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create directories**

```bash
mkdir -p ".claude/skills/proposal-writer/references/winning-proposals"
mkdir -p "proposals"
touch "proposals/.gitkeep"
```

- [ ] **Step 2: Copy the four winning proposals into the skill (local seed material)**

```bash
SRC="C:/Users/ishma/Desktop/rocky/DC&A Hub"
DST=".claude/skills/proposal-writer/references/winning-proposals"
cp "$SRC/SOCO Project/Technical Proposal - Mid Term Survey for the SOCO Project - DC&A HUB (1).docx" "$DST/SOCO-midterm-technical-proposal.docx"
cp "$SRC/EOI - Ghana CE and Investment Planning.docx" "$DST/Ghana-CE-investment-EOI.docx"
cp "$SRC/CLEAR Project/Clear Technical Proposal_Updated.docx" "$DST/CLEAR-technical-proposal.docx"
cp "$SRC/YUW Project/Technical Proposal_Young Urban Women Project.docx" "$DST/YUW-technical-proposal.docx"
ls "$DST"
```

Expected: the four `.docx` files listed with the new names.

- [ ] **Step 3: Gitignore the raw proposals (keep them local, not in git)**

Append to `.gitignore`:

```
# Proposal-writer: raw proprietary proposals kept local, not committed
.claude/skills/proposal-writer/references/winning-proposals/
```

- [ ] **Step 4: Verify the raw proposals are ignored but the skill dir is otherwise tracked**

Run: `git check-ignore ".claude/skills/proposal-writer/references/winning-proposals/SOCO-midterm-technical-proposal.docx" && echo "ignored-ok"`
Expected: prints the path and `ignored-ok`.

- [ ] **Step 5: Commit scaffold**

```bash
git add .gitignore proposals/.gitkeep
git commit -m "chore: scaffold proposal-writer skill, seed local winning proposals"
```

---

## Task 2: Distill `house-style.md` from the winning proposals

**Files:**
- Create: `.claude/skills/proposal-writer/references/house-style.md`

This requires READING the four proposals. They are Word files (no pandoc/python-docx available); read them by extracting `word/document.xml` from each `.docx` (a zip) and stripping tags. A working extraction approach (PowerShell) is below.

- [ ] **Step 1: Extract full text from each proposal to read it**

Use this PowerShell snippet (run via the PowerShell tool) to dump readable text of one file at a time; repeat per file:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$path = ".claude/skills/proposal-writer/references/winning-proposals/CLEAR-technical-proposal.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $path))
$entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" }
$reader = New-Object System.IO.StreamReader($entry.Open())
$xml = $reader.ReadToEnd(); $reader.Close(); $zip.Dispose()
# paragraph breaks + strip tags
$txt = [regex]::Replace($xml, '</w:p>', "`n")
$txt = [regex]::Replace($txt, '<[^>]+>', '')
[System.Net.WebUtility]::HtmlDecode($txt)
```

Read all four (CLEAR, SOCO, YUW, Ghana-CE-EOI).

- [ ] **Step 2: Write `house-style.md`**

Capture what is OBSERVED in the proposals (do not invent). The file MUST contain these sections, seeded with the known structures below and enriched from your reading:

```markdown
# DC&A Hub — Proposal House Style

Distilled from past winning proposals. The agent follows this for tone and structure,
and adapts to whatever structure a specific ToR mandates.

## Submission types we write
- **Full technical proposal** — responding to an RFP/ToR.
- **EOI / Expression of Interest** — shorter capability + relevant-experience pitch.

## Standard technical-proposal structure (when the ToR does not mandate forms)
Observed in the CLEAR and YUW proposals:
1. Consultant's Organization (who DC&A Hub is)
2. Why We Are a Good Fit for this Assignment
3. Approach and Methodology
4. Work Schedule and Planning for Deliverables
5. Proposed Experts / Team

## Donor-form structure (when the ToR mandates standard forms)
Observed in the SOCO (World Bank style) proposal — use the ToR's exact form labels:
- TECH-1: Technical Proposal Submission Form
- TECH-2: Consultant's Organization and Experience
- TECH-3: Comments/Suggestions on the ToR, counterpart staff, facilities
- TECH-4/5: Description of Approach, Methodology, and Work Plan
- Team Composition / CVs

## EOI structure
Observed in the Ghana CE & Investment Planning EOI: <fill from reading — cover/intro,
firm capability, relevant experience, key personnel, closing>.

## Tone & conventions
<Fill from reading: e.g. formal third-person ("DC&A Hub"), evidence-led, references
specific past projects by name, uses OECD-DAC / MEL terminology, etc.>

## Recurring framings to reuse
<Fill from reading: e.g. how the firm frames "understanding of the assignment",
how methodology is broken into phases, how it ties experience to the client's need.>
```

- [ ] **Step 3: Verify the file has all required sections and no unfilled `<...>` placeholders**

Run: `grep -nE "^## |<[^>]*fill[^>]*>|<\.\.\.>" .claude/skills/proposal-writer/references/house-style.md`
Expected: lists the `##` sections; shows NO remaining `<fill ...>` or `<...>` placeholders.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/proposal-writer/references/house-style.md
git commit -m "feat: distill DC&A Hub proposal house-style from winning proposals"
```

---

## Task 3: Write the SKILL.md procedure

**Files:**
- Create: `.claude/skills/proposal-writer/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Write `.claude/skills/proposal-writer/SKILL.md` with exactly this content:

````markdown
---
name: proposal-writer
description: Use when the user wants to draft a proposal, EOI, or technical response to a Terms of Reference (ToR/RFP) for DC&A Hub — reads the ToR, drafts a full first-draft submission in house style within the ToR's page limits, and outputs a Word .docx. Triggers include "draft a proposal", "respond to this ToR/RFP", "write an EOI", "proposal for this tender".
---

# DC&A Hub Proposal Writer

Turn a ToR/RFP into a complete first-draft submission as a Word .docx.

## Inputs (read these first)
1. The **ToR/RFP** file the user provides (PDF or Word). If none is provided, ask for it.
2. `references/house-style.md` — DC&A Hub's proposal structure and tone.
3. `../opportunity-scanner/references/dcahub-profile.md` — firm profile + 22-project track record (for org text, relevant experience, team).
4. `references/winning-proposals/` — past proposals for deeper reference if needed (local).

## Procedure

### 1. Analyze the ToR → ToR brief
Read the ToR and extract a structured brief: submission type (full technical proposal
vs. EOI); required sections / mandated forms; **page or word limits** (overall and per
section); evaluation criteria + weights; mandatory/eligibility requirements; format
rules (language, font); deadline. If anything is unclear, record it as a `[REVIEW]`
note rather than guessing.

### 2. Plan the response
- Choose the structure: the ToR's mandated forms if any; otherwise the standard
  structure in `house-style.md`.
- Allocate a **page budget** per section so the total respects the limit.
- Select the most relevant projects from the firm profile track record (match sector,
  client/donor, method, country) — only real projects.
- Decide the methodology approach to argue.

### 3. Draft each section
Write each required section in house style (per `house-style.md`), anchored on the
template/winning-proposal tone. Typical sections: cover letter; understanding/context;
technical approach & methodology; workplan/activities & schedule; team & rationale
(key-personnel summaries); relevant experience (selected); management & QA. Stay within
each section's page budget.

### 4. Compliance check
Build a checklist mapping every ToR requirement and evaluation criterion to where it is
addressed. Insert `[REVIEW]` / `[ASSUMPTION]` markers wherever expert input is needed
(e.g. specific staffing, exact figures). Confirm the draft is within the page/word
limit; if over, trim the lowest-value content.

### 5. Render output
Using the docx tooling, write a formatted Word document to
`../../../proposals/<slug>/<slug>-draft.docx`, where `<slug>` is a short kebab-case name
from the ToR title/donor. Also write `../../../proposals/<slug>/compliance-checklist.md`
(the Step-4 checklist + the list of all `[REVIEW]`/`[ASSUMPTION]` markers). Then tell
the user both paths and a one-line summary (submission type, page count vs. limit,
number of open `[REVIEW]` items).

## Rules
- **Never fabricate** experience, references, personnel, certifications, or numbers.
  Use only projects/people in the firm profile; anything else is a `[REVIEW]` marker.
- **Methodology is a first draft for expert review**, never a final submission — say so.
- **Respect the ToR's page/word limit.** Trim rather than exceed it.
- **Honour the ToR's mandated structure/forms**; otherwise use the house-style structure.
- If the firm profile still has `[CONFIRM]` markers (e.g. registration facts), surface
  them as `[REVIEW]` items where the ToR asks for that information.
````

- [ ] **Step 2: Verify frontmatter and the 5-step procedure**

Run: `grep -E "^name:|^description:|^### [1-5]\." .claude/skills/proposal-writer/SKILL.md`
Expected: shows `name:`, `description:`, and steps 1–5.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/proposal-writer/SKILL.md
git commit -m "feat: add proposal-writer SKILL.md procedure"
```

---

## Task 4: Validation run against a real ToR

This is the real test: run the skill against an actual ToR and inspect the `.docx`.

- [ ] **Step 1: Obtain a ToR to draft against**

Use a real ToR the user provides (preferred). If none is available at build time, create
a clearly-labelled TEST fixture ToR at `proposals/_test-tor.md` containing: a title, a
donor, a required structure (use the house-style standard sections), a **5-page limit**,
3 evaluation criteria, and one mandatory eligibility requirement. Mark it
`# TEST FIXTURE — not a real solicitation` at the top.

- [ ] **Step 2: Run the skill against the ToR**

Invoke the proposal-writer skill with that ToR as input. Let it produce the ToR brief,
draft, compliance check, and `.docx`.

- [ ] **Step 3: Verify the output**

Run: `ls proposals/*/ && ls proposals/*/*-draft.docx`
Then confirm:
- A `<slug>-draft.docx` exists and opens (text extractable via the zip method in Task 2).
- It follows the ToR's required structure and is within the stated page limit.
- A `compliance-checklist.md` exists, mapping each ToR requirement/criterion to a section,
  and listing the `[REVIEW]`/`[ASSUMPTION]` markers.
- Spot-check: every named past project in the draft exists in the firm profile (no
  fabricated experience).

Expected: draft + checklist exist, on-structure, within limit, no fabricated experience.

- [ ] **Step 4: Commit the validation artifacts**

```bash
git add proposals
git commit -m "test: validation run of proposal-writer against a ToR"
```

Note: the draft `.docx` for a TEST fixture may be committed as evidence. Real-client
drafts produced later are also written under `proposals/` — decide per-case whether to
commit or gitignore client-confidential drafts.

---

## Task 5: Tune from the validation

- [ ] **Step 1: Review the draft quality with the user**

Open the draft and checklist with the user. Check: Does it read like DC&A Hub? Is the
methodology a credible first draft? Are the right past projects selected? Is the limit
respected? Are compliance gaps correctly flagged rather than papered over?

- [ ] **Step 2: Tune config based on findings**

Apply edits ONLY to the data files:
- Tone/structure off → edit `references/house-style.md`.
- Wrong experience selected → enrich the firm profile (shared file) so matching improves.
Do not change `SKILL.md` logic unless the procedure itself is wrong.

- [ ] **Step 3: Commit tuning**

```bash
git add .claude/skills/proposal-writer/references
git commit -m "chore: tune proposal-writer house-style after first draft"
```

---

## Done criteria
- Given a real ToR + the seed material, the agent produces a `.docx` first draft that
  follows the ToR's structure, respects its page/word limit, addresses every evaluation
  criterion (per the compliance checklist), and reads in DC&A Hub's house style with
  real track-record examples.
- No fabricated experience or personnel; gaps are `[REVIEW]` markers.
- Raw proprietary proposals stay local (gitignored); only the distilled house-style is committed.
- Budget, CV annexes, and auto-submission remain out of scope (v1), as designed.
