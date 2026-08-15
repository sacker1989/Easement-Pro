# Phase plan — 3, 4, 5

**Status: proposed scope, not yet agreed.** Phases 3–5 were never scoped. The entire prior
definition is one clause in `development-strategy-v2.md:138` — *"Phase 3/4 (nationwide Analysis
Layer and Advocacy Wizard)"* — plus a passing mention in `src/lib/valuation/README.md`. Phase 5
appears nowhere. This document proposes boundaries so the work can be specced.

---

## Where the product actually is

| | built | measured limit |
|---|---|---|
| **Phase 1** — LA County MVP | done | — |
| **Phase 2** — nationwide data | county matrix at 12 counties (3 immediate, 8 standard, 1 fallback); vendor harness with a 25-parcel stratified test set | **strand 3 open**: every county except LA gets generic recorder fallback, including tier-A Orange and San Diego |
| Analysis Layer | `ca-rule-set.ts` only | 1 state |
| State compliance matrix | 1 entry (CA, Tier A) | 1 state |
| Advocacy Wizard | built, gated | CA-only by construction |

## Constraints later phases must not re-litigate

This session measured these. They are settled and re-deriving them wastes a phase.

1. **A defensible permanent-easement value ends at an appraiser.** Uniform Appraisal Standards
   §4.6.5 rejects percentage-of-fee, going rates, **and** strip valuation. No formula this product
   can run produces market value for a permanent easement.
2. **Temporary easements are the exception** and are implemented (`temporary-easement.ts`), but need
   an observed ground rent for the right land class — which open data supplies only for agriculture.
3. **Proximity is never an easement.** The A/B/C evidence tier is the honest output; probability
   scores are not computable without recorded-easement ground truth.
4. **The data splits by agency.** Assessors publish values, preservation offices publish easements,
   DOTs publish TCEs. No jurisdiction found publishes all of it.
5. **Valuation error is measured**: ZIP-comparable path 19.3% median APE, p90 76%. `calibratedRange`
   is calibrated for that path only and throws for others.

---

## Phase 3 — Nationwide Analysis Layer

**Goal.** Extend easement analysis beyond `ca-rule-set.ts` to a defensible multi-state rule set.

**Why it is not just "add 49 more files."** The CA rule set encodes California substantive law.
Easement doctrine is state law and genuinely differs — prescriptive periods, whether a quasi-easement
requires strict or reasonable necessity, recording-act priority (race / notice / race-notice), and
whether implied easements survive at all in the form CA recognises.

**Proposed scope**
- A state rule-set interface with CA as the reference implementation.
- Per-state: prescriptive period, implied-easement doctrines recognised, recording act type,
  and marketable-title / ancient-mortgage cutoffs where they bear on easement survival.
- A **hard gate**: no state emits substantive conclusions until its rule set is reviewed by counsel
  for that state, mirroring the existing Tier A/B/C discipline. An unreviewed state returns
  `flagged`, not a guess.
- Sequence states by where Phase 2 already has county data, not by population.

**Explicitly out of scope.** Legal classification without counsel review. The existing doc is
emphatic that the tier matrix is "a hypothesis pending real counsel review per state."

## Phase 4 — Nationwide Advocacy Wizard

**Goal.** Extend Track 1 / Track 2 gating beyond California.

**The binding constraint is regulatory, not technical.** Unauthorized practice of law is a
state-by-state licensing question, and in many states criminal. California's Legal Document Assistant
statute has no equivalent in most states. Per the strategy doc: *"Stronger disclaimer language does
not expand where Track 1 can legally operate."*

**Proposed scope**
- Drive wizard availability from the state-tier matrix rather than a CA hardcode.
- Tier B/C states: Track 2 (free clarification request) and Track 3 (risk disclosure) only.
- Per-state UPL findings recorded with reviewer and review date, and an expiry that re-gates a state
  when its review goes stale.
- Route everything actionable through the existing `attorney-review.ts` hook.

**Explicitly out of scope.** Enabling Track 1 anywhere on the strength of disclaimer text.

## Phase 5 — Professional handoff (proposed; previously undefined)

**Goal.** Close the loop the valuation research opened: the product screens, an appraiser or attorney
values.

**Rationale.** Phase 2 established that a defensible permanent-easement value cannot be computed from
data. That is not a gap to engineer around — it is the answer. The product's honest terminal state is
a well-prepared handoff, which is currently missing: `attorney-review.ts` flags that review is needed
but produces no package.

**Proposed scope**
- A referral package: parcel identity, evidence tier and geometric basis, encumbered area with its
  derivation, land value with its measured error band, and every caveat already written.
- Explicit statement of what was **not** determined and why — the section a professional most needs.
- Temporary-easement path: accept an appraiser-supplied observed rent and run
  `valueTemporaryEasement`, which already refuses fee-derived rates.
- Records-request generation, generalising `docs/records-request-fdot-d7.md` — which found that
  targeting depends on statutory exemption state (§119.0711), so this is per-jurisdiction logic.

**Explicitly out of scope.** Anything that presents the product's output as an appraisal.

---

## Sequencing

Phase 3 gates Phase 4 — the wizard cannot be state-aware before state rule sets exist. Phase 5 is
independent of both and is the shortest path to user value, since it needs no new legal research and
consumes work already built and measured.

**Recommendation: Phase 5 first**, then 3, then 4.
