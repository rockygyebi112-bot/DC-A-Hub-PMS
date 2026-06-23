# DC&A Hub Opportunity Scanner Agent — Design Spec

**Date:** 2026-06-23
**Status:** Draft (pending user review of written spec)
**Authors:** Ishmael + Claude

## 1. Goal

Build an AI agent that **actively finds business opportunities** (tenders, RFPs, EOIs, consultancy calls) for DC&A Hub — a Ghana-based Monitoring, Evaluation & Learning (MEL) / research consultancy — rather than waiting for opportunities to arrive.

The agent sweeps a defined set of development-sector opportunity sources, screens each finding against DC&A Hub's capabilities, scores it for fit and win-probability, and delivers a **ranked digest with bid / consider / no-bid recommendations**. It is the "front door" agent: a strong bid/no-bid decision later feeds a Proposal Writer agent.

This spec covers **Phase 1 only** (a manually-triggered scanner). Phases 2–3 are sketched so Phase 1 is built to grow into them, but are out of scope for the first implementation plan.

## 2. Context & why Claude (not a no-code Custom GPT)

DC&A Hub explored ChatGPT "Custom GPTs" for this. A no-code assistant **cannot** autonomously browse sources and run on a cadence, so the scanner is built as a **Claude Code skill/agent with web tools** (`WebSearch` / `WebFetch`), run from this repo (`dcahub-pms`). This keeps it version-controlled, reusable, and on a path to integrate with the existing PMS (Next.js 16 + Supabase + Resend) in a later phase.

## 3. Scope of opportunities (the relevance model)

The user wants maximum coverage. Therefore:

- **Capability fit is the hard filter.** An opportunity must plausibly match DC&A Hub's services (MEL, evaluation, research, data collection, learning systems) to appear at all.
- **Geography is a scoring weight, not a filter.** Priority gradient: **Ghana > West Africa > Sub-Saharan Africa > Global / remote-friendly.** Nothing is excluded purely on geography; distant opportunities simply score lower on the geographic criterion.

## 4. Sources

A maintained config file (`sources`) lists each source with how to query it. Three tiers by reachability:

| Tier | Sources | How the agent reads them |
|---|---|---|
| **A — Feed/API (most reliable)** | ReliefWeb (jobs/tenders API), UNGM (feeds where available) | Direct fetch of structured feeds |
| **B — Public web search** | World Bank procurement, UN Development Business, EU TED, FCDO, USAID (grants.gov / SAM.gov), GIZ, jobsinghana.com, Devex *public* listings | Targeted `WebSearch` queries + `WebFetch` of result pages |
| **C — Paywalled (flag-only)** | Devex (full), DevelopmentAid, DGMarket, Tenders.info | Agent does **not** log in. It flags "a relevant opportunity likely exists here — check manually," with a search link. Designed so the user's own access can be added later. |

The source list is **data, not code** — editable without touching agent logic, so coverage can grow over time ("everywhere there is opportunity" is approached incrementally).

## 5. DC&A Hub profile (what "fit" is scored against)

A single distilled `dcahub-profile` knowledge file, built once from the user's existing materials:

- **Capability statement** → services, sectors, methodologies, what we do / don't do.
- **Past project list / track record** → client, country, sector, value, our role (evidence of experience).
- **Team CVs / expert roster** → staff and associate experts, specializations.
- Plus a short **firm parameters** block the user fills in: minimum / typical contract size, target donors, registration/eligibility facts (years in operation, certifications).

This file is the agent's reference; updating the firm's strategy means editing one file.

## 6. Scoring rubric (the tunable "brain")

Each opportunity is scored on seven criteria:

| Criterion | Question |
|---|---|
| **Capability fit** | Matches DC&A Hub's MEL / evaluation / research services? *(hard filter — fails → dropped)* |
| **Experience fit** | Relevant past projects to be credible? |
| **Geographic fit** | Ghana > West Africa > Sub-Saharan Africa > Global/remote |
| **Eligibility** | Plausibly meets mandatory requirements (turnover, registration, prior similar contracts)? |
| **Team fit** | Can we field the required experts from staff/roster? |
| **Commercial fit** | Value worth the effort? |
| **Win probability** | Competition, incumbents, existing relationships |

**Output per opportunity:** overall score → **BID / CONSIDER / NO-BID** label + confidence + top reasons + identified gaps / teaming needs.

The rubric (criteria, weights, thresholds) lives in an editable config so the user can tune it after real runs.

## 7. Memory / deduplication

The agent records opportunities it has already surfaced (stable key = source + title + deadline/URL) so each run shows only **new** items. Phase 1: a local JSON store in the repo. Phase 3: migrates to Supabase.

## 8. Output (Phase 1)

A **dated Markdown digest file** written to a known folder (e.g. `opportunity-scans/YYYY-MM-DD-digest.md`), **run on demand**. Structure:

1. **Summary line** — N new opportunities, of which X BID / Y CONSIDER.
2. **Ranked opportunities** (BID first), each with: title, donor/agency, country, sector, deadline, estimated value, source link, fit score, recommendation, top reasons, gaps/teaming needs.
3. **Check-manually list** — paywalled (Tier C) sources likely to hold relevant opportunities, with search links.
4. **Run metadata** — date, sources swept, sources that failed/were unreachable.

Rationale for on-demand Markdown (vs. scheduled email): until sources and scoring are validated against the user's real judgment, automating delivery only automates noise. Iterate first, automate second.

## 9. Architecture (Phase 1)

Built as a Claude Code **skill** in this repo. Logical units, each independently understandable:

1. **Source registry** — the editable source config (Section 4).
2. **Fetchers** — per-tier retrieval: feed fetch (A), web-search+fetch (B), flag-only stub (C). Each returns a normalized list of raw opportunity records.
3. **Normalizer** — maps raw records to a common shape (title, donor, country, sector, deadline, value, url, description).
4. **Screener/scorer** — applies the hard capability filter, then the rubric (Section 6) using the DC&A Hub profile (Section 5).
5. **Deduper** — drops already-seen items against the memory store (Section 7).
6. **Digest writer** — renders the Markdown output (Section 8) and updates the memory store.

Well-defined interfaces between units mean a source can be added (registry only) or the rubric retuned (scorer config only) without touching the rest.

## 10. Phasing

- **Phase 1 (this spec):** Manual-trigger skill → dated Markdown digest. Validate sources & scoring on real runs.
- **Phase 2:** Schedule it (cron / scheduled task) and deliver a **weekly email digest** via Resend (already a PMS dependency). Daily deferred until noise is tuned down.
- **Phase 3:** Persist opportunities to **Supabase** and surface them in the PMS app for the team, with a bid/no-bid workflow (assign, comment, track outcome).

## 11. Non-goals (Phase 1)

- No automated login to paywalled sites (Devex / DevelopmentAid) — flag-only.
- No email or scheduling (Phase 2).
- No PMS/Supabase integration or team UI (Phase 3).
- Not a Proposal Writer — this agent stops at the bid/no-bid recommendation.

## 12. Success criteria

- Running the agent produces a digest of **genuinely relevant** opportunities (capability-filtered), ranked sensibly, with no duplicates from prior runs.
- The user can read a recommendation and agree/disagree with its reasoning — i.e., the rubric output is legible and tunable.
- Adding a new source or adjusting a weight requires editing only config, not agent logic.

## 13. Open questions / to confirm during build

- Exact ReliefWeb / UNGM feed endpoints and query parameters that surface MEL-relevant calls.
- Whether the user can later supply Devex/DevelopmentAid access (changes Tier C from flag-only to readable).
- Final weights/thresholds for the rubric — seeded with sensible defaults, tuned after the first real runs.
