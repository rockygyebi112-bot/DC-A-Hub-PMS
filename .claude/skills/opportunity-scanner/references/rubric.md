# Bid / No-Bid Scoring Rubric

Tune the weights and thresholds here after real runs. The scanner applies the
hard filter first, then scores the remaining opportunities.

## Hard filter (pass/fail — applied before scoring)

Drop the opportunity entirely if ANY of these is true:

1. **Capability fit = 0** — it does not match any DC&A Hub service (MEL, evaluation,
   research, data collection, learning systems).
2. **Not firm-biddable** — it is an individual employment / staff position (e.g. a
   "MEAL Officer", "M&E Advisor" job advert) rather than a tender, RFP, EOI, or
   consultancy assignment a firm can bid. Keep only firm-biddable calls.
3. **Deadline already passed** — the stated submission deadline (parsed to a
   calendar date) is before today's date in the runtime context, i.e. `days_left < 0`.
   This is an automatic, unconditional drop: an expired opportunity must not appear
   in BID, CONSIDER, or NO-BID, and must not be retained "as evidence of fit" or "to
   validate the pipeline". (If no deadline is stated, keep it but score Win
   probability conservatively and set confidence no higher than Medium.)

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
