# DC&A Hub Opportunity Scanner Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a prompt-driven Claude Code skill that sweeps development-sector opportunity sources, screens them against DC&A Hub's capabilities, and writes a ranked bid/no-bid digest.

**Architecture:** A project skill at `.claude/skills/opportunity-scanner/` made of a `SKILL.md` procedure plus three editable data files (source registry, scoring rubric, firm profile). At runtime the skill uses Claude's built-in `WebSearch`/`WebFetch` to gather opportunities, scores them with the rubric against the profile, deduplicates against a JSON memory file, and writes a dated Markdown digest to `opportunity-scans/`.

**Tech Stack:** Claude Code skill (Markdown + frontmatter), `WebSearch`/`WebFetch` runtime tools, JSON memory file. No npm deps, no build step, no database (those are Phase 2/3).

**Note on "tests":** This deliverable is instructions + data, not unit-testable code. Validation tasks therefore *run the skill against a controlled scope and inspect the produced digest file* — that is the real test for a prompt-driven agent. There is no pytest/vitest here by design (YAGNI for a Phase-1 validation tool).

---

## File Structure

| File | Responsibility |
|---|---|
| `.claude/skills/opportunity-scanner/SKILL.md` | The agent procedure: how to scan, score, dedupe, and write the digest. |
| `.claude/skills/opportunity-scanner/references/sources.md` | Editable source registry (3 tiers). Data, not logic. |
| `.claude/skills/opportunity-scanner/references/rubric.md` | Editable scoring rubric: criteria, scale, weights, thresholds. |
| `.claude/skills/opportunity-scanner/references/dcahub-profile.md` | DC&A Hub capability profile the agent scores "fit" against. Seeded skeleton; user populates. |
| `opportunity-scans/.gitkeep` | Keeps the output folder in git. |
| `opportunity-scans/.seen.json` | Dedup memory (runtime-created/updated). |
| `opportunity-scans/YYYY-MM-DD-HHmm-digest.md` | Run output (runtime-created). |

---

## Task 1: Scaffold the skill directory and output folder

**Files:**
- Create: `.claude/skills/opportunity-scanner/references/.gitkeep`
- Create: `opportunity-scans/.gitkeep`

- [ ] **Step 1: Create the directories with keep-files**

```bash
mkdir -p ".claude/skills/opportunity-scanner/references"
mkdir -p "opportunity-scans"
touch ".claude/skills/opportunity-scanner/references/.gitkeep"
touch "opportunity-scans/.gitkeep"
```

- [ ] **Step 2: Verify the structure exists**

Run: `find .claude/skills/opportunity-scanner opportunity-scans -type f`
Expected: lists both `.gitkeep` files.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/opportunity-scanner opportunity-scans
git commit -m "chore: scaffold opportunity-scanner skill directories"
```

---

## Task 2: Write the source registry

**Files:**
- Create: `.claude/skills/opportunity-scanner/references/sources.md`

- [ ] **Step 1: Write the source registry file**

Write `.claude/skills/opportunity-scanner/references/sources.md` with exactly this content:

````markdown
# Opportunity Source Registry

Edit this file to add/remove sources. The scanner reads every source listed under
Tier A and Tier B, and lists Tier C as "check manually". Keep entries concise.

## Tier A — Feed / API (read directly, most reliable)

| Source | Endpoint / how to fetch | Notes |
|---|---|---|
| ReliefWeb jobs | `https://api.reliefweb.int/v1/jobs?appname=dcahub-scanner&profile=list&limit=30&query[value]=monitoring%20OR%20evaluation%20OR%20research%20OR%20MEL` | Public JSON API. Filter results by relevance (Section: capability filter). Add `&query[value]=...Ghana` variants for country focus. |
| ReliefWeb reports (tenders) | `https://api.reliefweb.int/v1/reports?appname=dcahub-scanner&profile=list&limit=30&query[value]=tender%20OR%20procurement%20OR%20RFP%20evaluation` | Catches procurement notices posted as reports. |

## Tier B — Public web search (use WebSearch, then WebFetch the listing)

Run a WebSearch for each, then fetch and read the top relevant results.

| Source | Suggested WebSearch query |
|---|---|
| World Bank procurement | `World Bank consulting opportunity monitoring evaluation site:worldbank.org` |
| UN Development Business | `UN Development Business tender monitoring evaluation consultancy` |
| UNGM | `UNGM tender notice evaluation research consultancy` |
| EU TED | `TED europa tender monitoring evaluation Africa` |
| FCDO | `FCDO supplier opportunity monitoring evaluation Ghana OR Africa` |
| USAID / grants.gov | `USAID OR grants.gov monitoring evaluation learning solicitation Africa` |
| GIZ | `GIZ tender monitoring evaluation consultancy Africa` |
| jobsinghana.com | `site:jobsinghana.com monitoring evaluation OR research OR consultant` |
| Devex (public) | `site:devex.com funding OR tender monitoring evaluation Ghana OR West Africa` |
| General sweep | `monitoring evaluation learning consultancy tender 2026 Ghana OR "West Africa" OR "sub-Saharan Africa"` |

## Tier C — Paywalled (flag only — do NOT attempt login)

For each, add a "check manually" entry in the digest with a ready-to-click search URL.

| Source | Manual-check search URL |
|---|---|
| Devex (full) | `https://www.devex.com/funding?query%5B%5D=monitoring%20evaluation` |
| DevelopmentAid | `https://www.developmentaid.org/tenders/search?query=monitoring+evaluation` |
| DGMarket | `https://www.dgmarket.com/tenders/np-search.do?keyword=monitoring+evaluation` |
````

- [ ] **Step 2: Verify the file is valid Markdown and lists all three tiers**

Run: `grep -c "Tier" .claude/skills/opportunity-scanner/references/sources.md`
Expected: `3` (three tier headings).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/opportunity-scanner/references/sources.md
git commit -m "feat: add opportunity source registry"
```

---

## Task 3: Write the scoring rubric

**Files:**
- Create: `.claude/skills/opportunity-scanner/references/rubric.md`

- [ ] **Step 1: Write the rubric file**

Write `.claude/skills/opportunity-scanner/references/rubric.md` with exactly this content:

````markdown
# Bid / No-Bid Scoring Rubric

Tune the weights and thresholds here after real runs. The scanner applies the
hard filter first, then scores the remaining opportunities.

## Hard filter (pass/fail — applied before scoring)

Drop the opportunity entirely if **Capability fit = 0** (it does not match any DC&A
Hub service: MEL, evaluation, research, data collection, learning systems).

## Criteria (score each 0–3)

| # | Criterion | 0 | 1 | 2 | 3 | Weight |
|---|---|---|---|---|---|---|
| 1 | Capability fit | none | tangential | partial | core service | ×3 |
| 2 | Experience fit | no track record | weak | some relevant projects | strong proven record | ×2 |
| 3 | Geographic fit | other | sub-Saharan Africa | West Africa | Ghana | ×2 |
| 4 | Eligibility | clearly ineligible | doubtful | likely meets | clearly meets | ×2 |
| 5 | Team fit | cannot field | major gaps | minor gaps | can field fully | ×1 |
| 6 | Commercial fit | not worth it | marginal | reasonable | strong value | ×1 |
| 7 | Win probability | very low | low | moderate | high | ×1 |

Max weighted score = (3×3)+(3×2)+(3×2)+(3×2)+(3×1)+(3×1)+(3×1) = **36**.

## Recommendation thresholds (on the weighted total)

| Weighted score | Label |
|---|---|
| ≥ 26 | **BID** |
| 16–25 | **CONSIDER** |
| < 16 | **NO-BID** |

Also drop to **CONSIDER** (regardless of score) if Eligibility = 1, and to
**NO-BID** if Eligibility = 0 — never recommend bidding on something we're ineligible for.

## Confidence

State confidence as High / Medium / Low based on how much of the source text the
scanner could actually read (full ToR vs. headline only). Headline-only ⇒ Low.
````

- [ ] **Step 2: Verify the thresholds and criteria are present**

Run: `grep -E "BID|CONSIDER|NO-BID|Weight" .claude/skills/opportunity-scanner/references/rubric.md | head`
Expected: shows the criteria table header and the three recommendation labels.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/opportunity-scanner/references/rubric.md
git commit -m "feat: add bid/no-bid scoring rubric"
```

---

## Task 4: Seed the DC&A Hub profile skeleton

**Files:**
- Create: `.claude/skills/opportunity-scanner/references/dcahub-profile.md`

- [ ] **Step 1: Write the profile skeleton**

Write `.claude/skills/opportunity-scanner/references/dcahub-profile.md` with exactly this content. The `<!-- FILL IN -->` markers show the user what to replace from their capability statement, track record, and CVs.

````markdown
# DC&A Hub — Firm Profile (scoring reference)

> Populate every `<!-- FILL IN -->` from the capability statement, past-project
> list, and team CVs. The scanner scores opportunity "fit" against this file, so
> keep it accurate and current. Until populated, scoring quality is limited.

## Services (what we do)
<!-- FILL IN: e.g. monitoring & evaluation, baseline/endline studies, impact
evaluation, research, data collection, MEL system design, learning & KM -->

## Sectors
<!-- FILL IN: e.g. health, education, agriculture, governance, WASH, livelihoods -->

## Methodologies
<!-- FILL IN: e.g. mixed-methods, quasi-experimental designs, Theory of Change,
logframes, OECD-DAC criteria, MSC, outcome harvesting, mobile data collection -->

## Geographic experience
<!-- FILL IN: list countries where we have delivered work -->

## Track record (evidence of experience)
| Project | Client / Donor | Country | Sector | Value | Our role | Year |
|---|---|---|---|---|---|---|
<!-- FILL IN one row per relevant past/current project -->

## Team & associate experts
<!-- FILL IN: key staff and roster experts with specializations, e.g.
- [Name] — Lead Evaluator, 12 yrs, health & education
- [Name] — Statistician / data scientist
-->

## Firm parameters
- Minimum contract value we pursue: <!-- FILL IN -->
- Typical contract value: <!-- FILL IN -->
- Target donors: <!-- FILL IN: e.g. World Bank, USAID, FCDO, EU, UN agencies, GIZ -->
- Registration / eligibility facts: <!-- FILL IN: years in operation, legal
  registration, certifications, audited turnover if relevant -->

## Exclusions (what we do NOT do — auto-lower or drop)
<!-- FILL IN: e.g. pure construction, IT software builds, sectors we avoid -->
````

- [ ] **Step 2: Verify the skeleton has the key sections**

Run: `grep -E "^## " .claude/skills/opportunity-scanner/references/dcahub-profile.md`
Expected: lists Services, Sectors, Methodologies, Geographic experience, Track record, Team & associate experts, Firm parameters, Exclusions.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/opportunity-scanner/references/dcahub-profile.md
git commit -m "feat: add DC&A Hub firm-profile skeleton for scoring"
```

---

## Task 5: Write the SKILL.md procedure (the agent's brain)

**Files:**
- Create: `.claude/skills/opportunity-scanner/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Write `.claude/skills/opportunity-scanner/SKILL.md` with exactly this content:

````markdown
---
name: opportunity-scanner
description: Use when the user wants to find new business opportunities (tenders, RFPs, EOIs, consultancy calls) for DC&A Hub — scans development-sector sources, screens against DC&A Hub's capabilities, and writes a ranked bid/no-bid digest. Triggers include "scan for opportunities", "find tenders", "what's out there for DC&A Hub", "opportunity scan".
---

# DC&A Hub Opportunity Scanner

Find and rank business opportunities for DC&A Hub, then write a dated digest.

## Inputs (read these first, every run)
1. `references/dcahub-profile.md` — what DC&A Hub does (score fit against this).
2. `references/sources.md` — where to look.
3. `references/rubric.md` — how to score and label each opportunity.
4. `../../../opportunity-scans/.seen.json` — opportunities already shown (for dedup).
   If it does not exist, treat the seen-list as empty.

## Procedure

### 1. Gather
- For each **Tier A** source in `sources.md`: `WebFetch` the endpoint and read the JSON list.
- For each **Tier B** source: run the suggested `WebSearch`, then `WebFetch` the most
  relevant 1–3 result pages to read details.
- Do **not** attempt to log into **Tier C** sources. Just note them for the manual list.
- Be economical: a few targeted searches beat dozens. Aim for breadth across sources,
  not depth on any one.

### 2. Normalize
For every candidate opportunity, capture: `title`, `donor/agency`, `country`,
`sector`, `deadline`, `estimated value` (if stated), `source name`, `url`,
and a one-line `description`. Use "not stated" where a field is missing.

### 3. Hard filter
Drop anything where **Capability fit = 0** per `rubric.md` (no match to any DC&A Hub
service). Do not include filtered-out items in the digest.

### 4. Score
Score each surviving opportunity on the 7 criteria in `rubric.md` (0–3 each),
apply the weights, total it, and assign **BID / CONSIDER / NO-BID** using the
thresholds and the eligibility override. Record a confidence level.

### 5. Deduplicate
Build a stable key for each opportunity: lowercase `source` + "|" + `title` + "|"
+ (`deadline` or `url`). Drop any opportunity whose key is already in `.seen.json`.

### 6. Write the digest
Create `../../../opportunity-scans/<YYYY-MM-DD-HHmm>-digest.md` using the
**Digest format** below (BID first, then CONSIDER, then NO-BID).

### 7. Update memory
Append every newly-shown opportunity's key to `.seen.json` (create the file as a
JSON array of strings if absent). Keep it sorted and de-duplicated.

### 8. Report
Tell the user the digest path and the one-line summary.

## Digest format

```markdown
# DC&A Hub Opportunity Scan — <date> <time>

**Summary:** <N> new opportunities — <X> BID, <Y> CONSIDER, <Z> NO-BID.

## 🟢 BID
### <title>
- **Donor/Agency:** … | **Country:** … | **Sector:** …
- **Deadline:** … | **Est. value:** … | **Source:** [<source>](<url>)
- **Score:** <weighted>/36 · **Confidence:** <High/Med/Low>
- **Why:** <top 2–3 reasons>
- **Gaps / teaming needs:** <…>

## 🟡 CONSIDER
<same shape>

## 🔴 NO-BID
<same shape, one-liner reasons fine>

## 🔎 Check manually (paywalled)
- [Devex funding search](<url>) — likely relevant MEL calls
- [DevelopmentAid tenders](<url>)
- [DGMarket](<url>)

## Run metadata
- Sources swept: <list>
- Sources unreachable/failed: <list or "none">
```

## Rules
- Never invent opportunities, deadlines, or values. If unknown, write "not stated".
- Never recommend BID on an ineligible opportunity (see rubric eligibility override).
- If the profile still has `<!-- FILL IN -->` markers, note in the summary that
  scoring is provisional until the profile is completed.
````

- [ ] **Step 2: Verify frontmatter and the 8-step procedure are present**

Run: `grep -E "^name:|^description:|^### [1-8]\." .claude/skills/opportunity-scanner/SKILL.md`
Expected: shows `name:`, `description:`, and steps 1–8.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/opportunity-scanner/SKILL.md
git commit -m "feat: add opportunity-scanner SKILL.md procedure"
```

---

## Task 6: Add the dedup memory store and ignore noise

**Files:**
- Create: `opportunity-scans/.seen.json`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize the seen-store as an empty JSON array**

Write `opportunity-scans/.seen.json` with exactly this content:

```json
[]
```

- [ ] **Step 2: Decide what to ignore**

We commit digests (useful history) but the seen-store is machine state that will
churn. Append to `.gitignore`:

```
# Opportunity scanner runtime state
opportunity-scans/.seen.json
```

- [ ] **Step 3: Verify .gitignore entry and that seen.json is valid JSON**

Run: `grep "opportunity-scans/.seen.json" .gitignore && node -e "JSON.parse(require('fs').readFileSync('opportunity-scans/.seen.json','utf8')); console.log('valid')"`
Expected: prints the gitignore line and `valid`.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore opportunity-scanner seen-store"
```

---

## Task 7: Validation run — single source (ReliefWeb), verify digest shape

This is the real test: run the skill against ONE Tier A source and inspect the output.

- [ ] **Step 1: Pre-seed a minimal profile so scoring can run**

Temporarily replace the `<!-- FILL IN -->` markers in
`.claude/skills/opportunity-scanner/references/dcahub-profile.md` with a minimal real
profile (or the user's actual data if provided): Services = "monitoring & evaluation,
research, data collection"; Sectors = "health, education, agriculture, governance";
Geographic experience = "Ghana, West Africa"; Firm parameters target donors = "World
Bank, USAID, FCDO, EU, UN, GIZ". Leave the rest as-is.

- [ ] **Step 2: Run the skill scoped to ReliefWeb only**

Invoke the skill, instructing it to gather from **only the two ReliefWeb Tier A
endpoints** this run (to keep the validation fast and deterministic).

- [ ] **Step 3: Verify a digest was produced with the required structure**

Run: `ls opportunity-scans/*-digest.md | tail -1`
Then open that file and confirm it contains: a `**Summary:**` line, at least the
`## 🟢 BID` / `## 🟡 CONSIDER` / `## 🔴 NO-BID` headings, a `## 🔎 Check manually`
section, and `## Run metadata`. Each listed opportunity must have a score `/36`,
a confidence level, and a real source URL (no invented data).

Expected: digest exists and matches the format in SKILL.md.

- [ ] **Step 4: Verify dedup — run again, expect zero (or only brand-new) items**

Invoke the skill again with the same ReliefWeb-only scope.
Run: `cat opportunity-scans/.seen.json | node -e "let a=JSON.parse(require('fs').readFileSync(0));console.log('seen keys:',a.length)"`
Expected: the second digest's summary shows 0 new (or only genuinely new) opportunities,
and `.seen.json` did not double-count the first run's keys.

- [ ] **Step 5: Commit the validation digest(s)**

```bash
git add opportunity-scans/*-digest.md .claude/skills/opportunity-scanner/references/dcahub-profile.md
git commit -m "test: validation run of opportunity-scanner against ReliefWeb"
```

---

## Task 8: Full run across all public sources, then tune

- [ ] **Step 1: Run the full scan**

Invoke the skill with no scope restriction. It should sweep all Tier A + Tier B
sources and list Tier C under "check manually".

- [ ] **Step 2: Review output quality with the user**

Read the digest with the user. Check: Are the BID items genuinely relevant? Are
any obvious good opportunities missing (source gap)? Are scores sensible?

- [ ] **Step 3: Tune config based on findings**

Apply edits ONLY to the data files:
- Missing/weak sources → edit `references/sources.md`.
- Scores feel wrong → adjust weights/thresholds in `references/rubric.md`.
- Fit misjudged → enrich `references/dcahub-profile.md`.
Do not change `SKILL.md` logic for tuning.

- [ ] **Step 4: Commit tuning changes**

```bash
git add .claude/skills/opportunity-scanner/references opportunity-scans/*-digest.md
git commit -m "chore: tune opportunity-scanner sources/rubric/profile after first full run"
```

---

## Done criteria
- Invoking the skill produces a ranked, deduplicated digest of genuinely relevant
  opportunities with legible bid/no-bid reasoning.
- Adding a source or changing a weight requires editing only the `references/` data files.
- No invented opportunities; paywalled sources appear under "check manually".
- Phase 2 (schedule + Resend email) and Phase 3 (Supabase + PMS UI) remain untouched, as designed.
```
