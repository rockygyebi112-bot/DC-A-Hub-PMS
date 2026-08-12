# Bid / No-Bid Scoring Rubric

Tune the weights and thresholds here after real runs. The scanner applies the
hard filter first, then scores the remaining opportunities.

## Hard filter (pass/fail — applied before scoring)

Drop the opportunity entirely if ANY of these is true:

1. **Capability fit = 0** — it does not match any DC&A Hub service (MEL, evaluation,
   research, data collection, learning systems).
2. **Not biddable** — it is a salaried employment / staff position or internship
   (e.g. a "MEAL Officer" or "M&E Advisor" job advert) rather than a tender, RFP,
   EOI, or consultancy assignment. **Individual consultant calls (ICs) pass this
   gate** — DC&A Hub bids its named experts (see the Team section of the profile).
   Label them "Individual consultant call" in the digest and score Team fit and
   Eligibility against the specific expert's qualifications, not the firm's.
3. **Deadline already passed** — the stated submission deadline (parsed to a
   calendar date) is before today's date in the runtime context, i.e. `days_left < 0`.
   This is an automatic, unconditional drop: an expired opportunity must not appear
   in BID, CONSIDER, or NO-BID, and must not be retained "as evidence of fit" or "to
   validate the pipeline". (If no deadline is stated, keep it but score Win
   probability conservatively and set confidence no higher than Medium.)
4. **Out of reach** — DC&A Hub cannot deliver it from Accra. Keep it only if the
   country is **Ghana**, or the country is in **West Africa** (Benin, Burkina Faso,
   Cabo Verde, Côte d'Ivoire, The Gambia, Guinea, Guinea-Bissau, Liberia, Mali,
   Mauritania, Niger, Nigeria, Senegal, Sierra Leone, Togo), or the assignment is
   **remote / home-based** with no required in-country fieldwork, or the notice
   **explicitly admits firms or consultants from outside the implementing country**.
   Otherwise drop it. An in-country assignment elsewhere in Africa that is silent on
   nationality is a drop, not a CONSIDER: DC&A Hub has no presence, no field agents,
   and no local registration outside its region. "We could find a local partner" is
   not eligibility.

## Criteria (score each 0–3)

| # | Criterion | 0 | 1 | 2 | 3 | Weight |
|---|---|---|---|---|---|---|
| 1 | Capability fit | none | tangential | partial | core service | ×3 |
| 2 | Experience fit | no track record | weak | some relevant projects | strong proven record | ×2 |
| 3 | Delivery reach | other | elsewhere in Africa, but explicitly open to international firms | West Africa, or remote with limited travel | Ghana, or fully remote / desk-based | ×2 |
| 4 | Eligibility | clearly ineligible | doubtful | likely meets | clearly meets | ×2 |
| 5 | Team fit | cannot field | major gaps | minor gaps | can field fully | ×1 |
| 6 | Commercial fit | not worth it | marginal | reasonable | strong value | ×1 |
| 7 | Win probability | very low | low | moderate | high | ×1 |

Max weighted score = (3×3)+(3×2)+(3×2)+(3×2)+(3×1)+(3×1)+(3×1) = **36**.

Delivery reach = 0 cannot appear in a digest — hard-filter gate 4 already dropped it.
If you find yourself about to score a 0 there, the item should not have survived the
filter; drop it instead of scoring it.

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

A Low-confidence item cannot be labelled **BID**. If the reading is that thin, the
strongest available label is CONSIDER, with the missing information named in
"Gaps / teaming needs".
