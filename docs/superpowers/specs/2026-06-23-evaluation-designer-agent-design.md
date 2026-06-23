# DC&A Hub Evaluation Designer Agent — Design Spec

**Date:** 2026-06-23
**Status:** Draft (pending user review of written spec)
**Authors:** Ishmael + Claude

## 1. Goal

Build the third DC&A Hub agent — the first deliverable of the **MEL Technical Advisor**:
an agent that turns an **evaluation ToR** (or, absent a ToR, a stated evaluation purpose
+ project background) into a complete, **inception-ready evaluation design**, delivered
as a **Word `.docx`**, with an OECD-DAC-anchored **evaluation matrix** at its core.

It complements the other two agents: the [Opportunity Scanner](2026-06-23-opportunity-scanner-agent-design.md)
finds work, the [Proposal Writer](2026-06-23-proposal-writer-agent-design.md) wins it,
and the Evaluation Designer helps *deliver* it. It is distinct from the Proposal Writer:
the proposal-writer drafts a persuasive methodology to win a bid; this agent produces the
rigorous technical design a MEL team uses to run the evaluation (and which a proposal can
be built on).

This spec covers the **Evaluation Design** deliverable only. Other MEL artifacts
(Theory of Change, logframe/results framework, indicator reference guide, DQA tools,
learning systems) are future deliverables of the same MEL Advisor family, out of scope here.

## 2. Context & reuse

- Built as a Claude Code **skill** at `.claude/skills/evaluation-designer/`, consistent
  with the opportunity-scanner and proposal-writer skills.
- **Reads** the proposal-writer's `house-style.md`
  (`../proposal-writer/references/house-style.md`) for DC&A Hub's voice/tone.
- **Does not** rely on the firm profile/track record — an evaluation design concerns the
  *evaluand*, not DC&A Hub's past experience.
- Word generation uses the available `docx` document tooling at runtime.

## 3. Inputs

- **Primary:** an **evaluation ToR** (PDF or Word).
- **Fallback (no ToR):** the user states the evaluation purpose, the project/programme
  being evaluated, its objectives/results, scope (period, geography), and intended users;
  the agent asks for these if not provided.

## 4. The evaluation brief (extracted first)

Before designing, the agent reads the ToR and produces a structured **evaluation brief**:
- The **evaluand** (project/programme being evaluated) and its objectives/results.
- **Purpose** and **intended users** of the evaluation.
- **Evaluation type** (formative/summative; midterm/endline/impact/process).
- **Scope** — time period, geography, components, exclusions.
- **Stated evaluation questions** and **criteria** (if the ToR lists them).
- **Methodological requirements** the ToR mandates (e.g. specific designs, sample sizes).
- **Deliverables, timeline, page limits, language**.
Anything unclear is recorded as a `[REVIEW]` note rather than guessed.

## 5. Output: the evaluation design document

A Word `.docx` at `evaluations/<slug>/<slug>-evaluation-design.docx`, with sections:

1. **Understanding of the assignment** — evaluand, purpose, intended users, scope, type.
2. **Evaluation questions** — primary + sub-questions, organised by OECD-DAC criteria.
3. **Evaluation matrix** (centrepiece table): columns = *Evaluation question | OECD-DAC
   criterion | Judgement criteria / indicators | Data sources | Data-collection methods |
   Analysis approach*.
4. **Evaluation approach & design** — overall design (e.g. theory-based, mixed-methods,
   participatory, contribution analysis) with a **GESI lens**.
5. **Sampling strategy** — sites, respondents, sample sizes, sampling method.
6. **Data-collection methods & tools outline** — surveys, KIIs, FGDs, document review,
   observation; a tool *list/outline* (not full instruments).
7. **Analysis plan** — quantitative + qualitative; triangulation.
8. **Ethics & safeguarding** — consent, confidentiality, do-no-harm, GESI, child
   safeguarding.
9. **Limitations & mitigations**.

Plus a short `design-checklist.md` mapping each ToR evaluation question/criterion to the
matrix row(s) that address it, and listing all `[REVIEW]`/`[ASSUMPTION]` markers.

## 6. The methods reference (what gives it rigour)

A `references/evaluation-methods.md` capturing DC&A Hub's standard evaluation toolbox:
- The **OECD-DAC criteria** (relevance, coherence, effectiveness, efficiency, impact,
  sustainability) with one-line definitions, as the default question backbone.
- The **evaluation-matrix column template** (Section 5.3).
- Common **methods** (household/structured surveys, KIIs, FGDs, document/secondary
  review, observation, outcome harvesting, contribution analysis, Most Significant
  Change) with when-to-use notes.
- **Sampling approaches** (probability vs purposive; site/respondent selection).
- **GESI and research-ethics standards** (disaggregation, inclusion, consent, do-no-harm,
  child safeguarding).

## 7. Procedure (the skill's steps)

1. **Analyze the ToR → evaluation brief** (Section 4).
2. **Develop the evaluation framework** — derive/organise evaluation questions against
   OECD-DAC criteria (plus any ToR-specific criteria); define judgement criteria/indicators.
3. **Build the evaluation matrix** (Section 5.3) from the framework.
4. **Design the rest** — approach, sampling, methods & tools outline, analysis, ethics,
   limitations (Sections 5.4–5.9), drawing on `evaluation-methods.md`.
5. **Render output** — write the `.docx` (via docx tooling) and the `design-checklist.md`
   to `evaluations/<slug>/`; report the path + a one-line summary (evaluation type, number
   of questions/criteria, open `[REVIEW]` items).

## 8. Quality & safety rules

- **Ground questions in the ToR.** Any evaluation question or criterion the agent infers
  (not stated in the ToR) is flagged so the team can confirm it.
- **OECD-DAC by default, adapted to the ToR** — use the ToR's criteria where given;
  don't force criteria the assignment doesn't need.
- **GESI and ethics always present** — disaggregation and safeguarding are not optional.
- **Never fabricate** baseline figures, sample frames, or findings — the design proposes
  *how* evidence will be gathered, not results.
- **Respect any page limit** in the ToR.
- It is a **first draft for expert review** — say so; flag inception-dependent choices.

## 9. Non-goals (v1)

- Not the **proposal** (that is the proposal-writer).
- Not full **data-collection instruments** — methods/tools are outlined, not written out.
- Not the **final evaluation report** or findings.
- Not **budgeting** or staffing.
- Not the other MEL artifacts (ToC, logframe, indicator guide) — future deliverables.

## 10. Success criteria

- Given a real evaluation ToR, the agent produces a `.docx` design that (a) correctly
  states the evaluand, purpose, type and scope; (b) presents evaluation questions mapped
  to OECD-DAC criteria; (c) contains a complete, internally consistent evaluation matrix
  where every question has sources, methods and an analysis approach; (d) includes
  coherent sampling, methods, analysis, ethics and limitations; and (e) reads in DC&A
  Hub's house style.
- A MEL lead can move from the draft to an inception report by refining, not rewriting.
- No fabricated data; inferred questions and inception-dependent choices are flagged.

## 11. Open questions / to confirm during build

- Whether to default the matrix to all six OECD-DAC criteria or only those the ToR names
  (default: ToR's criteria if listed; otherwise the standard six, trimmed to relevance).
- How `<slug>` is chosen (default: short kebab-case from the evaluand/ToR title).
- Whether future versions should also emit the matrix as Excel (deferred; Word-only for v1).
