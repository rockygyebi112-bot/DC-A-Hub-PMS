# DC&A Hub Evaluation Designer Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a prompt-driven Claude Code skill that turns an evaluation ToR into an inception-ready evaluation design (OECD-DAC evaluation matrix + sampling, methods, analysis, ethics) delivered as a Word `.docx`.

**Architecture:** A project skill at `.claude/skills/evaluation-designer/` made of a `SKILL.md` procedure plus a single `references/evaluation-methods.md` rigour reference. At runtime the agent reads the evaluation ToR, extracts an evaluation brief, derives OECD-DAC-anchored evaluation questions, builds the evaluation matrix, designs the rest, and renders a `.docx` using the available docx tooling. It reads the proposal-writer's `house-style.md` for DC&A Hub's voice but does not use the firm track record.

**Tech Stack:** Claude Code skill (Markdown + frontmatter); the `docx` document tooling for Word generation; reuse of `../proposal-writer/references/house-style.md`. No npm deps, no build step.

**Note on "tests":** Like the other DC&A Hub agents, this deliverable is instructions + data, not unit-testable code. The validation task *runs the skill against a real evaluation ToR and inspects the produced `.docx` + design checklist*. No pytest/vitest by design.

---

## File Structure

| File | Responsibility |
|---|---|
| `.claude/skills/evaluation-designer/SKILL.md` | The agent procedure: analyze ToR → brief → questions → matrix → design → render. |
| `.claude/skills/evaluation-designer/references/evaluation-methods.md` | OECD-DAC criteria, matrix column template, methods, sampling, GESI/ethics (the rigour reference). |
| `evaluations/.gitkeep` | Keeps the output folder in git. |
| `evaluations/<slug>/<slug>-evaluation-design.docx` | Run output (runtime-created). |
| `evaluations/<slug>/design-checklist.md` | Run output (runtime-created). |
| `.gitignore` (modify) | Ignore per-run docx build scratch under `evaluations/`. |

Reused (not created): `.claude/skills/proposal-writer/references/house-style.md`.

---

## Task 1: Scaffold the skill and output folder

**Files:**
- Create: `.claude/skills/evaluation-designer/references/.gitkeep`
- Create: `evaluations/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create directories**

```bash
mkdir -p ".claude/skills/evaluation-designer/references"
mkdir -p "evaluations"
touch ".claude/skills/evaluation-designer/references/.gitkeep"
touch "evaluations/.gitkeep"
```

- [ ] **Step 2: Ignore per-run docx build scratch**

Append to `.gitignore`:

```
# Evaluation-designer: per-run docx build scratch
evaluations/**/build-docx.js
```

- [ ] **Step 3: Verify structure**

Run: `find .claude/skills/evaluation-designer evaluations -type f`
Expected: lists the two `.gitkeep` files.

- [ ] **Step 4: Commit**

```bash
git add .gitignore .claude/skills/evaluation-designer/references/.gitkeep evaluations/.gitkeep
git commit -m "chore: scaffold evaluation-designer skill directories"
```

---

## Task 2: Write the methods reference

**Files:**
- Create: `.claude/skills/evaluation-designer/references/evaluation-methods.md`

- [ ] **Step 1: Write `evaluation-methods.md`**

Write the file with exactly this content:

````markdown
# DC&A Hub — Evaluation Methods Reference

The rigour reference for the evaluation-designer skill. Edit to evolve DC&A Hub's
standard evaluation toolbox.

## OECD-DAC criteria (default question backbone)
Use the criteria the ToR names; otherwise default to these six, trimmed to what the
assignment needs:
- **Relevance** — is the intervention doing the right things (responsive to needs/priorities)?
- **Coherence** — how well does it fit with other interventions (internal & external)?
- **Effectiveness** — is it achieving its objectives/results?
- **Efficiency** — how well are resources/time converted to results (value for money)?
- **Impact** — what difference has it made (higher-level, including unintended effects)?
- **Sustainability** — will the benefits last?
Add **cross-cutting**: gender equality & social inclusion (GESI), and equity.

## Evaluation matrix — column template
Each row answers one evaluation (sub-)question:
| Evaluation question | OECD-DAC criterion | Judgement criteria / indicators | Data sources | Data-collection methods | Analysis approach |

Every question must have at least one source, one method, and an analysis approach.
Triangulate: most questions draw on ≥2 sources/methods.

## Evaluation approaches (pick per assignment)
- **Theory-based** — test the programme's theory of change / results chain.
- **Mixed-methods** — combine quantitative breadth with qualitative depth (default).
- **Participatory** — centre stakeholder/beneficiary voice.
- **Contribution analysis** — assess the programme's contribution where attribution is hard.
- **Most Significant Change (MSC)** — structured qualitative outcome stories.
- **Outcome harvesting** — identify outcomes then work back to contribution.

## Data-collection methods (when to use)
- **Structured/household survey** — representative quantitative evidence; needs a sample frame.
- **Key informant interviews (KIIs)** — depth from officials, implementers, experts.
- **Focus group discussions (FGDs)** — community perspectives, norms, lived experience.
- **Document / secondary review** — programme docs, MIS data, results frameworks, reports.
- **Observation** — site/service verification.
- **Outcome harvesting / MSC** — qualitative outcome and contribution evidence.

## Sampling
- **Probability sampling** (e.g. multi-stage cluster, stratified) — for representative
  quantitative estimates; state confidence/precision and how the frame is built.
- **Purposive sampling** — for KIIs/FGDs; select information-rich cases by criteria
  (role, geography, gender, vulnerability).
- Always state: sites, respondent groups, indicative sample sizes, and selection method;
  disaggregate by sex, disability, location, and other equity dimensions where feasible.

## Analysis
- **Quantitative** — descriptive + disaggregated analysis; comparison to baseline/targets
  where available; tests/cross-tabs as appropriate.
- **Qualitative** — thematic/framework analysis; coding against evaluation questions.
- **Triangulation** — converge quantitative + qualitative + document evidence per question.

## GESI & research ethics (always present)
- Disaggregate data and analysis (sex, disability, age, location, wealth where feasible).
- Inclusive, accessible methods; centre marginalised groups explicitly.
- Informed consent, confidentiality, voluntary participation, do-no-harm, safe data handling.
- Apply child-safeguarding good practice where fieldwork touches communities with children.
````

- [ ] **Step 2: Verify the reference has the matrix template and the six criteria**

Run: `grep -nE "Evaluation question \| OECD-DAC|Relevance|Coherence|Effectiveness|Efficiency|Impact|Sustainability" .claude/skills/evaluation-designer/references/evaluation-methods.md`
Expected: shows the matrix template row and all six criteria.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/evaluation-designer/references/evaluation-methods.md
git commit -m "feat: add evaluation methods reference (OECD-DAC, matrix, methods, sampling)"
```

---

## Task 3: Write the SKILL.md procedure

**Files:**
- Create: `.claude/skills/evaluation-designer/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Write the file with exactly this content:

````markdown
---
name: evaluation-designer
description: Use when the user wants to design an evaluation for DC&A Hub — reads an evaluation ToR (or a stated evaluation purpose + project background) and produces an inception-ready evaluation design (OECD-DAC evaluation matrix, sampling, methods, analysis, ethics) as a Word .docx. Triggers include "design an evaluation", "evaluation matrix for this ToR", "inception design", "evaluation methodology design".
---

# DC&A Hub Evaluation Designer

Turn an evaluation ToR into an inception-ready evaluation design as a Word .docx.

## Inputs (read these first)
1. The **evaluation ToR** the user provides (PDF or Word). If none is provided, ask the
   user for: the evaluation purpose, the project/programme being evaluated and its
   objectives/results, scope (period, geography), and intended users.
2. `references/evaluation-methods.md` — OECD-DAC criteria, the matrix template, methods,
   sampling, GESI/ethics.
3. `../proposal-writer/references/house-style.md` — DC&A Hub's voice/tone.

## Procedure

### 1. Analyze the ToR → evaluation brief
Extract: the **evaluand** (project/programme) and its objectives/results; the evaluation
**purpose** and **intended users**; the **evaluation type** (formative/summative;
midterm/endline/impact/process); **scope** (period, geography, components, exclusions);
any **stated evaluation questions** and **criteria**; **methodological requirements**;
deliverables, timeline, **page limit**, language. Record anything unclear as `[REVIEW]`.

### 2. Develop the evaluation framework
Organise the evaluation questions against OECD-DAC criteria (use the ToR's criteria if
given; otherwise the standard six trimmed to what the assignment needs, plus GESI/equity).
For each question, define judgement criteria / indicators. Any question you infer (not in
the ToR) must be flagged `[REVIEW]`.

### 3. Build the evaluation matrix
Produce the matrix using the column template in `evaluation-methods.md`: one row per
evaluation (sub-)question, each with criterion, judgement criteria/indicators, data
sources, data-collection methods, and analysis approach. Every question gets ≥1 source,
≥1 method, and an analysis approach; triangulate where possible.

### 4. Design the rest
Using `evaluation-methods.md`, write: the **evaluation approach & design** (with a GESI
lens); **sampling strategy** (sites, respondents, indicative sample sizes, method);
**data-collection methods & tools outline** (a tool list, not full instruments);
**analysis plan**; **ethics & safeguarding**; **limitations & mitigations**.

### 5. Render output
Using the docx tooling, write the design to
`../../../evaluations/<slug>/<slug>-evaluation-design.docx` (`<slug>` = short kebab-case
from the evaluand/ToR title), with sections in this order: Understanding of the
assignment; Evaluation questions; Evaluation matrix; Evaluation approach & design;
Sampling strategy; Data-collection methods & tools outline; Analysis plan; Ethics &
safeguarding; Limitations & mitigations. Also write
`../../../evaluations/<slug>/design-checklist.md` mapping each ToR question/criterion to
the matrix row(s) addressing it, plus all `[REVIEW]`/`[ASSUMPTION]` markers. Report both
paths and a one-line summary (evaluation type; number of questions/criteria; open
`[REVIEW]` count).

## Rules
- **Ground questions in the ToR**; flag any inferred question/criterion as `[REVIEW]`.
- **OECD-DAC by default, adapted to the ToR** — don't force criteria the assignment doesn't need.
- **GESI and ethics are always present** — disaggregation and safeguarding are not optional.
- **Never fabricate** baselines, sample frames, or findings — design *how* evidence is
  gathered, not results.
- **Respect any page limit** in the ToR.
- It is a **first draft for expert review** — say so; flag inception-dependent choices.
````

- [ ] **Step 2: Verify frontmatter and the 5-step procedure**

Run: `grep -E "^name:|^description:|^### [1-5]\." .claude/skills/evaluation-designer/SKILL.md`
Expected: shows `name:`, `description:`, and steps 1–5.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/evaluation-designer/SKILL.md
git commit -m "feat: add evaluation-designer SKILL.md procedure"
```

---

## Task 4: Validation run against a real evaluation ToR

This is the real test: run the skill against an actual evaluation ToR and inspect the `.docx`.

- [ ] **Step 1: Obtain an evaluation ToR**

Use a real evaluation ToR the user provides. If none is available at build time, use the
UNICEF MEAL Specialist ToR already in the repo context as a fallback — but note it is a
*framework-development* assignment, not a classic evaluation, so prefer a true evaluation
ToR (e.g. a midterm/endline evaluation) when available.

- [ ] **Step 2: Run the skill against the ToR**

Invoke the evaluation-designer skill with that ToR as input. Let it produce the evaluation
brief, framework, matrix, full design, and `.docx`.

- [ ] **Step 3: Verify the output**

Run: `ls evaluations/*/ && ls evaluations/*/*-evaluation-design.docx`
Then confirm:
- A `<slug>-evaluation-design.docx` exists and opens (extract text via the docx zip method).
- It contains all nine sections (Understanding … Limitations) and an **evaluation matrix**
  table where every question has criterion, sources, methods, and analysis.
- A `design-checklist.md` exists mapping ToR questions/criteria to matrix rows, listing
  `[REVIEW]`/`[ASSUMPTION]` markers.
- Spot-check: no fabricated baseline figures or findings; inferred questions are flagged.

Expected: design + checklist exist, all nine sections present, matrix complete, no fabrication.

- [ ] **Step 4: Commit the validation artifacts**

```bash
git add evaluations
git commit -m "test: validation run of evaluation-designer against an evaluation ToR"
```

---

## Task 5: Tune from the validation

- [ ] **Step 1: Review the design quality with the user**

Open the design and checklist with the user. Check: Are the evaluation questions sound and
ToR-grounded? Is the matrix complete and internally consistent (every question has sources,
methods, analysis)? Is sampling credible? Are OECD-DAC criteria applied sensibly? Are
GESI/ethics present? Are inferred items flagged rather than asserted?

- [ ] **Step 2: Tune config based on findings**

Apply edits ONLY to the data files:
- Methods/criteria gaps or wrong defaults → edit `references/evaluation-methods.md`.
- Tone/structure off → the agent reads `../proposal-writer/references/house-style.md`;
  adjust there only if it also serves the proposal-writer.
Do not change `SKILL.md` logic unless the procedure itself is wrong.

- [ ] **Step 3: Commit tuning**

```bash
git add .claude/skills/evaluation-designer/references
git commit -m "chore: tune evaluation-designer methods reference after first run"
```

---

## Done criteria
- Given a real evaluation ToR, the agent produces a `.docx` design that correctly states
  the evaluand/purpose/type/scope, presents OECD-DAC-mapped evaluation questions, contains
  a complete and internally consistent evaluation matrix, and includes coherent sampling,
  methods, analysis, ethics, and limitations — in DC&A Hub's house style.
- No fabricated data; inferred questions and inception-dependent choices are flagged.
- A MEL lead can move from the draft to an inception report by refining, not rewriting.
- The other MEL artifacts (ToC, logframe, indicator guide) remain out of scope (v1), as designed.
