---
name: proposal-writer
description: Use when the user wants to draft a proposal, EOI, or technical response to a Terms of Reference (ToR/RFP) for DC&A Hub — reads the ToR, drafts a full first-draft submission in house style within the ToR's page limits, and outputs a Word .docx. Triggers include "draft a proposal", "respond to this ToR/RFP", "write an EOI", "proposal for this tender".
---

# DC&A Hub Proposal Writer

Turn a ToR/RFP into a complete first-draft submission as a Word .docx.

## Inputs (read these first)
1. The **ToR/RFP** file the user provides (PDF or Word). If none is provided, ask for it.
2. `../_shared/house-style.md` — DC&A Hub's proposal structure and tone.
3. `../_shared/dcahub-profile.md` — firm profile + track record (for org text, relevant experience, team).
4. `references/winning-proposals/` — past proposals for deeper reference if needed (local; Word files, read by extracting `word/document.xml`).

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
Write each required section in house style (per `house-style.md`). For technical
proposals, draft the Approach & Methodology as Understanding → Approach → numbered
Methodology steps. Typical sections: cover letter; understanding/context; technical
approach & methodology; workplan/activities & schedule; team & rationale (key-personnel
summaries); relevant experience (selected); management & QA. Stay within each section's
page budget.

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
- **Man-days / level of effort:** when the ToR states days per deliverable, report each
  deliverable's days as given and show the simple additive total, but flag with
  `[ASSUMPTION]` that overlapping calendar windows may imply concurrent (not additive)
  effort — the firm confirms before pricing. Keep the total consistent across the
  workplan, budget, and compliance checklist.
