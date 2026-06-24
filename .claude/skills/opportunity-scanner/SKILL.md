---
name: opportunity-scanner
description: Use when the user wants to find new business opportunities (tenders, RFPs, EOIs, consultancy calls) for DC&A Hub — scans development-sector sources, screens against DC&A Hub's capabilities, and writes a ranked bid/no-bid digest. Triggers include "scan for opportunities", "find tenders", "what's out there for DC&A Hub", "opportunity scan".
---

# DC&A Hub Opportunity Scanner

Find and rank business opportunities for DC&A Hub, then write a dated digest.

## Inputs (read these first, every run)
1. `../_shared/dcahub-profile.md` — what DC&A Hub does (score fit against this).
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

**Deadlines — parse and date-check every one.** Source deadlines come in mixed
formats ("19.03.26", "16th June 2026", "18 September 2025, 17:00 EAT"). Convert each
to an ISO calendar date (`YYYY-MM-DD`). Then compute `days_left = deadline − today`
using the authoritative today's date in the runtime context. Record both the ISO
date and `days_left`. If no deadline is stated, set `deadline = "not stated"` and
leave `days_left` blank.

### 3. Hard filter
Apply ALL hard-filter gates in `rubric.md` and drop anything that fails:
(a) Capability fit = 0 (no match to any DC&A Hub service);
(b) not firm-biddable — an individual staff/employment job rather than a
tender/RFP/EOI/consultancy;
(c) **deadline already passed** — `days_left < 0` (deadline is before today).

A dropped opportunity is gone: do **not** place it in BID, CONSIDER, or NO-BID, and
do **not** keep it "as evidence of fit", "to validate the pipeline", or under any
other framing. The only trace an expired or non-biddable item may leave is a count
in Run metadata (e.g. "expired and dropped: 3"). If a deadline is genuinely "not
stated", keep the item but score Win probability conservatively and cap confidence
at Medium.

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

All deadlines below are live (`days_left >= 0`); expired ones were dropped in the
hard filter and never appear here. Sort each section by `days_left` ascending
(soonest first) so the most urgent bids are at the top.

```markdown
# DC&A Hub Opportunity Scan — <date> <time>

**Summary:** <N> new opportunities — <X> BID, <Y> CONSIDER, <Z> NO-BID. Soonest
deadline: <ISO date> (<days_left> days).

## 🟢 BID
### <title>
- **Donor/Agency:** … | **Country:** … | **Sector:** …
- **Deadline:** <YYYY-MM-DD> (<days_left> days left) | **Est. value:** … | **Source:** [<source>](<url>)
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
- Dropped: <N expired> expired, <N> non-biddable (jobs), <N> duplicates already seen
```

Notes on the deadline field:
- `(<days_left> days left)` — for a deadline that is today, write `(due today)`.
- If the deadline is "not stated", write `**Deadline:** not stated` with no
  days-left parenthetical.

## Rules
- Never invent opportunities, deadlines, or values. If unknown, write "not stated".
- Never surface an expired opportunity (`days_left < 0`) in any section. An expired
  deadline is an automatic drop — no exceptions, no "for reference" framing.
- Never recommend BID on an ineligible opportunity (see rubric eligibility override).
- Write the digest plainly per `_shared/writing-style.md`: no meta-narration, no
  self-justification, no hedging filler. Report the facts and the recommendation.
- If the profile still has `[CONFIRM]` markers in firm parameters, note in the summary
  that eligibility/commercial scoring is provisional until those are filled.
