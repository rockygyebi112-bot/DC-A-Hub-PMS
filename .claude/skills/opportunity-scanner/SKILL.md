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
Apply ALL hard-filter gates in `rubric.md` and drop anything that fails: (a) Capability
fit = 0 (no match to any DC&A Hub service), (b) not firm-biddable — an individual
staff/employment job rather than a tender/RFP/EOI/consultancy, (c) deadline already
passed (before today). Do not include filtered-out items in the digest, but you may
note how many were dropped and why in the NO-BID section or Run metadata.

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
- If the profile still has `[CONFIRM]` markers in firm parameters, note in the summary
  that eligibility/commercial scoring is provisional until those are filled.
