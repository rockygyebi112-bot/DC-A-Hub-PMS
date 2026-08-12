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
- For each **Tier B** source (this includes Devex, DevelopmentAid, DGMarket, and the
  other global tender aggregators — see `sources.md`): run the suggested `WebSearch`,
  then `WebFetch` the most relevant 1–3 result pages to read details. Actually search
  and read these; don't just point the user at them.
- Only fall back to a "could not confirm" mention (see Digest format) if you tried a
  source and hit a real block (login wall, CAPTCHA, no usable public listing) — not
  as a default for anything that sounds paywalled.
- Cast a wide net: don't stop at the named sources in `sources.md`. Run at least one
  or two open-ended sweeps (general procurement/tender search terms combined with
  DC&A Hub's sectors and Ghana/West Africa) to catch opportunities on sites not
  already listed, and add anything solid you find to `sources.md` under the right
  tier so future runs pick it up too.
- **Sweep for remote work explicitly.** Remote and home-based assignments pass the
  reach gate from any country, so they widen the pipeline more than any other
  search. Run the Tier B remote rows in `sources.md` every run, using the terms
  the sector actually uses: "home-based", "remote", "desk-based", "virtual",
  "work from anywhere", "location independent", "no travel required". Pair them
  with DC&A Hub's services (evaluation, MEL, research, desk review, data analysis).
- **Sweep for international-competition calls.** The other way into a non-West-Africa
  country is an explicitly international tender. Search "international consultant",
  "international firm", "open to international bidders", "international competitive
  bidding" alongside evaluation/research terms.
- Prefer depth over breadth once a candidate looks real: open the notice and read it
  rather than collecting more headlines. One page read properly beats five snippets.
- Be economical about volume, not coverage: a few targeted searches per source beats
  dozens of near-duplicate queries on the same site, but every source in `sources.md`
  should actually get swept each run.

### 2. Normalize
For every candidate opportunity, capture: `title`, `donor/agency`, `country`,
`sector`, `deadline`, `estimated value` (if stated), `source name`, `url`,
`delivery_mode`, `open_to_outsiders`, and a one-line `description`. Use "not
stated" where a field is missing.

**Delivery and reach — read these off the notice, don't infer them.**
- `delivery_mode` = `remote` (home-based, desk-based, or fully virtual with no
  required in-country fieldwork), `in-country` (fieldwork, enumerators, or
  physical presence required), or `hybrid` (remote with limited travel).
- `open_to_outsiders` = `yes` if the notice explicitly admits firms or consultants
  from outside the implementing country (phrases like "international consultant",
  "international competition", "open to firms of any nationality", "international
  and national firms", an open EOI under World Bank/AfDB international procurement
  rules); `no` if it restricts to nationals or locally registered entities
  ("national consultant", "nationals only", "must be registered in <country>",
  "local firms only"); `unclear` if the notice says neither.

**Deadlines — parse and date-check every one.** Source deadlines come in mixed
formats ("19.03.26", "16th June 2026", "18 September 2025, 17:00 EAT"). Convert each
to an ISO calendar date (`YYYY-MM-DD`). Then compute `days_left = deadline − today`
using the authoritative today's date in the runtime context. Record both the ISO
date and `days_left`. If no deadline is stated, set `deadline = "not stated"` and
leave `days_left` blank.

### 3. Hard filter
Apply ALL hard-filter gates in `rubric.md` and drop anything that fails:
(a) Capability fit = 0 (no match to any DC&A Hub service);
(b) not biddable — a salaried staff/employment position or internship rather than a
tender/RFP/EOI/consultancy. **Individual consultant calls (ICs) are biddable**: DC&A
Hub fields its named experts for them. Keep them, mark them "Individual consultant
call" in the digest entry, and score Team fit against the named experts' profiles
in `dcahub-profile.md`;
(c) **deadline already passed** — `days_left < 0` (deadline is before today);
(d) **out of reach** — DC&A Hub cannot actually deliver it from Accra (see below).

**Gate (d) — reach. Keep the opportunity ONLY if at least one is true:**
1. `country` is **Ghana**.
2. `country` is **West Africa** — Benin, Burkina Faso, Cabo Verde, Côte d'Ivoire,
   The Gambia, Guinea, Guinea-Bissau, Liberia, Mali, Mauritania, Niger, Nigeria,
   Senegal, Sierra Leone, Togo. A multi-country assignment counts if Ghana or any
   of these is in scope.
3. `delivery_mode` is **remote** — home-based, desk-based, or fully virtual, with
   no required in-country fieldwork. Country is irrelevant when the work is remote.
4. `open_to_outsiders` is **yes** — the notice explicitly admits firms or
   consultants from outside the implementing country.

Drop everything else. In particular, drop an in-country assignment in East,
Southern, Central, or North Africa (or anywhere outside West Africa) when the
notice does not explicitly invite international bidders. DC&A Hub has no office,
no field agents, and no registration there, and a nationals-only or
locally-registered-only call is unwinnable no matter how well the sector fits.

**`unclear` is a drop, not a maybe.** If the country is outside West Africa, the
work is not remote, and you could not find explicit wording admitting outside
firms, drop it. Do not reason "UNDP tenders are usually open", "the ToR doesn't
say we can't", "we could partner with a local firm", or "the sector fit is too
good to skip". Those are the rationalizations this gate exists to stop. A hoped-for
teaming arrangement is not evidence of eligibility.

A dropped opportunity is gone: do **not** place it in BID, CONSIDER, or NO-BID, and
do **not** keep it "as evidence of fit", "to validate the pipeline", or under any
other framing. The only trace an expired or non-biddable item may leave is a count
in Run metadata (e.g. "expired and dropped: 3"). If a deadline is genuinely "not
stated", keep the item but score Win probability conservatively and cap confidence
at Medium.

**Be strict about the year.** The runtime context's today's date is authoritative —
not the date a search engine snippet implies, not a page's "last crawled" date, not
the year in a filename. Tender listing pages (GIZ, ReliefWeb, UN agency vacancy
boards, etc.) routinely stay live and indexed for years after they closed. For every
candidate:
- Find the actual stated deadline/closing date on the page itself, not just the
  snippet. If the page shows no deadline but shows a **posting date**, and that
  posting date is more than ~6 months before today, treat the opportunity as
  almost certainly closed — drop it unless you can find explicit evidence
  ("currently open", "extended to <date>") that it is still live.
- If the deadline's year is earlier than the current year, drop it immediately —
  no exception, regardless of how good the capability fit looks.
- Do not round in the opportunity's favor. When a date is ambiguous (e.g. "March"
  with no year, or a format you're unsure how to parse), treat it as passed rather
  than assuming the most favorable reading.

**Final sweep, right before writing the digest:** re-list every surviving
opportunity with its parsed `deadline`, `days_left`, `country`, `delivery_mode`
and `open_to_outsiders` one more time. Confirm `days_left >= 0`, the deadline year
is the current year or later, and the item still passes one of the four reach
tests in gate (d) — naming which one. Drop anything that fails this last check —
it catches drift from earlier steps. Do this silently; only the counts show up in
Run metadata.

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

## BID
### <title>
- **Donor/Agency:** … | **Country:** … | **Sector:** …
- **Deadline:** <YYYY-MM-DD> (<days_left> days left) | **Est. value:** … | **Source:** [<source>](<url>)
- **Reach:** <Ghana | West Africa | Remote | Open to international firms> — <the exact wording or fact that satisfied gate (d)>
- **Score:** <weighted>/36 · **Confidence:** <High/Med/Low>
- **Why:** <top 2–3 reasons>
- **Gaps / teaming needs:** <…>

## CONSIDER
<same shape>

## NO-BID
<same shape, one-liner reasons fine>

## Also flagged (could not confirm status)
- Only list an opportunity here if you searched for it and read a page, but
  couldn't confirm whether it's still open or firm-biddable (e.g. genuinely
  gated behind a login wall after a real attempt). Give the title, source, and a
  direct search/listing URL. This is a short list, not a directory of links — do
  not pad it with sources you didn't actually search.

## Run metadata
- Sources swept: <list>
- Sources unreachable/failed: <list or "none">
- Dropped: <N> expired, <N> non-biddable (staff jobs/internships), <N> out of reach (outside West Africa, in-country, not open to international firms), <N> duplicates already seen
```

Notes on the deadline field:
- `(<days_left> days left)` — for a deadline that is today, write `(due today)`.
- If the deadline is "not stated", write `**Deadline:** not stated` with no
  days-left parenthetical.

## Rules
- Never invent opportunities, deadlines, or values. If unknown, write "not stated".
- Never surface an expired opportunity (`days_left < 0`) in any section. An expired
  deadline is an automatic drop — no exceptions, no "for reference" framing. When in
  doubt about whether a listing is stale, treat it as expired (see the year check in
  Step 3) rather than including it "just in case".
- Never recommend BID on an ineligible opportunity (see rubric eligibility override).
- Never surface an out-of-reach opportunity. Every entry in the digest must state,
  on its **Reach** line, which of the four tests in gate (d) it passed and the
  wording that proves it. If you cannot write that line from something you actually
  read, the opportunity does not go in the digest.
- Score and label only from a notice page you actually read. A search-engine
  snippet is enough to decide whether to fetch a page, never enough to place an
  opportunity in BID or CONSIDER. Snippet-only items go under "Also flagged" or
  get dropped.
- Write the digest plainly per `_shared/writing-style.md`: no meta-narration, no
  self-justification, no hedging filler, no emoji anywhere (including section
  headers). Report the facts and the recommendation.
- If the profile still has `[CONFIRM]` markers in firm parameters, note in the summary
  that eligibility/commercial scoring is provisional until those are filled.
- The digest file keeps the full **Run metadata** section (sources swept, failures,
  drop counts) for the team's own record. The scheduled email strips that section
  automatically before sending — it's an internal log, not something to compose for
  the recipient.
