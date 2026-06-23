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
