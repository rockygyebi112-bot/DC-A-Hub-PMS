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
