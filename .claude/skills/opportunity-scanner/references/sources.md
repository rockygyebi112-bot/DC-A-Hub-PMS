# Opportunity Source Registry

Edit this file to add/remove sources. The scanner reads every source listed under
Tier A, Tier B, and Tier B-R, and lists Tier C as "check manually". Keep entries
concise.

Sources are geared to what DC&A Hub can actually deliver from Accra: Ghana, West
Africa, remote assignments, and tenders explicitly open to international firms.
See hard-filter gate (d) in `rubric.md` — an in-country assignment outside West
Africa that does not invite outside bidders gets dropped, so don't add sources
that only carry that kind of notice.

## Tier A — Feed / API (read directly, most reliable)

> **Setup required (one-time):** ReliefWeb's API now needs a free, pre-registered
> `appname` (a domain or email you control). Register at
> https://apidoc.reliefweb.int/parameters#appname then replace `YOUR_APPNAME` below.
> The old `v1` API is decommissioned — use `v2`. Until an appname is registered,
> the API returns HTTP 403; in that case rely on the ReliefWeb **Tier B** search row.

| Source | Endpoint / how to fetch | Notes |
|---|---|---|
| ReliefWeb jobs (API) | `https://api.reliefweb.int/v2/jobs?appname=YOUR_APPNAME&profile=list&limit=30&query[value]=monitoring%20OR%20evaluation%20OR%20research%20OR%20MEL` | Needs registered appname (see setup note). Add `Ghana` to `query[value]` for country focus. |
| ReliefWeb reports (API) | `https://api.reliefweb.int/v2/reports?appname=YOUR_APPNAME&profile=list&limit=30&query[value]=tender%20OR%20procurement%20OR%20RFP%20evaluation` | Catches procurement notices posted as reports. Needs appname. |
| UNDP Procurement Notices | Fetch `https://procurement-notices.undp.org/` directly — page is readable and lists current notices (title, country, deadline) across all UNDP offices worldwide. No Ghana/MEL filter on the base URL, so scan the listing for Ghana/West Africa/Africa entries and for MEL-relevant titles (evaluation, research, MEL, IC individual-consultant calls) rather than assuming every row is relevant. |

## Tier B — Public web search (use WebSearch, then WebFetch the listing)

Run a WebSearch for each, then fetch and read the most relevant 1-3 result pages.
**Always include the current year (or "<year> OR <year+1>") in the query** — dropping
the year is how stale, long-closed listings creep back in.

| Source | Suggested WebSearch query |
|---|---|
| ReliefWeb (search fallback) | `site:reliefweb.int (tender OR procurement OR RFP OR EOI OR consultancy) monitoring evaluation Africa <year>` |
| World Bank procurement | `World Bank consulting opportunity monitoring evaluation site:worldbank.org <year>` |
| UN Development Business | `UN Development Business tender monitoring evaluation consultancy <year>` |
| UNGM | `UNGM tender notice evaluation research consultancy <year>` |
| EU TED | `TED europa tender monitoring evaluation Africa <year>` |
| FCDO | `FCDO supplier opportunity monitoring evaluation Ghana OR Africa <year>` |
| USAID / grants.gov | `USAID OR grants.gov monitoring evaluation learning solicitation Africa <year>` |
| GIZ | `GIZ tender monitoring evaluation consultancy Africa <year>` |
| jobsinghana.com | `site:jobsinghana.com monitoring evaluation OR research OR consultant` |
| **Devex** | `site:devex.com (funding OR tender OR opportunity) monitoring evaluation Ghana OR "West Africa" <year>` — Devex's funding/tender listing pages are publicly crawlable even though full ToRs sit behind a login; read what's visible (title, donor, deadline, summary) directly from the listing. |
| **DevelopmentAid** | `site:developmentaid.org (tender OR consultancy) monitoring evaluation Ghana OR Africa <year>` — try `https://www.developmentaid.org/tenders/search?query=monitoring+evaluation` directly first; DevelopmentAid's search-result listing (title, deadline, country, sector) is public even where the full tender pack is not. |
| **DGMarket** | `site:dgmarket.com tender monitoring evaluation Africa <year>` — try `https://www.dgmarket.com/tenders/np-search.do?keyword=monitoring+evaluation` directly; read whatever listing detail is public. |
| ImpactPool | `site:impactpool.org consultancy monitoring evaluation Ghana OR Africa <year>` |
| AfDB consultancy EOIs | `AfDB EOI consultancy services evaluation OR assessment Ghana OR "West Africa" <year>` — afdb.org document pages return HTTP 403 to direct fetch; read deadlines from search snippets or flag for manual check. |
| Global Fund IEL RFPs | Fetch `https://www.theglobalfund.org/en/iel/upcoming-requests-for-proposals/` directly — page is readable; lists evaluation RFPs/REOIs with status. |
| IUCN tenders | Fetch `https://iucn.org/procurement/currently-running-tenders` directly — full open-tender table is readable; filter for Ghana/West Africa research, survey, MEL items. |
| GHANEPS (Ghana public e-procurement) | `site:ghaneps.gov.gh consultancy` plus `GHANEPS consultancy monitoring evaluation <year>` — portal search is client-rendered, so public snippets are thin; flag promising hits for manual check on the portal. |
| Global South Opportunities | `site:globalsouthopportunities.com tender OR evaluation OR consultancy Ghana OR Africa <year>` — aggregator that reposts GIZ/EU/UN tender calls with deadlines in the page title; useful for surfacing calls whose primary pages block direct fetch. |
| GhanaTenders / TENDERS.com.gh | `site:ghanatenders.com OR site:tenders.com.gh consultancy evaluation OR survey OR research <year>` — Ghana tender aggregators carrying MLGDRD, ministry, and donor-funded notices. tenders.com.gh has intermittent SSL errors on direct fetch; read via search snippets and retry the fetch once. |
| World Bank Ghana project procurement | `site:projects.worldbank.org Ghana procurement consultant services evaluation OR survey <year>` — project-level procurement notices for the 16 active Ghana operations; catches EOIs the main worldbank.org search misses. |
| ECOWAS Commission | `ECOWAS Commission procurement OR "expression of interest" consultancy study OR evaluation <year>` — regional body, West Africa by definition, so everything it issues clears the reach gate. |
| Mastercard Foundation | `Mastercard Foundation "request for proposals" OR "call for proposals" evaluation OR research Ghana OR "West Africa" <year>` — proven donor relationship (Ghana Grows, DARE, CoRe). |
| INGO tender pages | `(Oxfam OR "Save the Children" OR "Plan International" OR CARE OR "Mercy Corps" OR Solidaridad OR SNV OR WaterAid) tender OR "request for proposals" evaluation OR baseline Ghana OR "West Africa" <year>` — INGO country offices commission a lot of DC&A Hub-shaped work and rarely appear on the big aggregators. |
| UN agency country tenders | `(UNICEF OR UNFPA OR "UN Women" OR WFP OR FAO OR IFAD OR ILO OR UNESCO) Ghana OR "West Africa" "request for proposal" OR "call for expression of interest" evaluation OR survey <year>` — agency-level notices that never reach UNGM's public listing. |
| General sweep (broaden beyond this list) | `monitoring evaluation learning consultancy tender OR RFP OR EOI <year> Ghana OR "West Africa"` — run a couple of variants (swap in "impact evaluation", "baseline survey", "data collection") to surface sources not already named above; add any good new source to this table. |

## Tier B-R — Remote and international-competition sweeps (run every scan)

Remote assignments clear the reach gate from any country, and explicitly
international tenders are the only other way into a non-West-Africa country. These
two sweeps are where the pipeline grows, so run them every time — not just when the
Ghana sources come back thin.

| Sweep | Suggested WebSearch query |
|---|---|
| Remote MEL/evaluation consultancies | `"home-based" OR remote OR "desk-based" consultancy evaluation OR "monitoring and evaluation" OR research <year> apply` |
| Remote, donor-side | `site:impactpool.org OR site:reliefweb.int "home-based" consultancy evaluation OR research <year>` — both platforms tag home-based roles explicitly. |
| Remote, aggregator-side | `site:developmentaid.org OR site:globalsouthopportunities.com remote OR "home-based" consultancy evaluation OR research <year>` |
| Remote desk reviews / literature reviews | `remote consultancy "desk review" OR "literature review" OR "evidence synthesis" OR "secondary data analysis" <year>` — pure desk work, no fieldwork, strong fit for DC&A Hub's research team. |
| Remote data analysis | `remote OR "work from anywhere" consultant "data analysis" OR "survey data" OR "quantitative analysis" development <year>` |
| International competition, Africa | `"international consultant" OR "international firm" OR "international competitive bidding" evaluation OR baseline OR survey Africa <year> tender` |
| International EOIs (MDBs) | `"expression of interest" "international" consulting services evaluation OR assessment Africa <year> -site:afdb.org` — MDB EOIs are open to firms of any member-country nationality; capture the wording that says so. |

## Tier C — Requires an account (flag only — do NOT attempt login)

Only list something here if you actually tried the Tier B search/fetch above for it
first and hit a genuine wall (forced login, CAPTCHA, no public listing at all). Do not
default a source to Tier C just because it's a known subscription platform — Devex,
DevelopmentAid, and DGMarket are handled in Tier B above precisely because their
listings are searchable without an account.
