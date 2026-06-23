# Opportunity Source Registry

Edit this file to add/remove sources. The scanner reads every source listed under
Tier A and Tier B, and lists Tier C as "check manually". Keep entries concise.

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

## Tier B — Public web search (use WebSearch, then WebFetch the listing)

Run a WebSearch for each, then fetch and read the most relevant 1-3 result pages.

| Source | Suggested WebSearch query |
|---|---|
| ReliefWeb (search fallback) | `site:reliefweb.int (tender OR procurement OR RFP OR EOI OR consultancy) monitoring evaluation Africa` |
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
