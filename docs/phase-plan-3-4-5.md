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
| Analysis Layer | registry + review gate; CA and FL entries | **2 states, both unreviewed** — observation rules run, every doctrinal question is refused |
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

---

## Phase 3 progress — Florida added 2026-10-04

Florida is the second registry entry. It is **unreviewed**, so `analyzeEasement({ state: 'FL' })`
runs the document-observation rules and refuses every doctrinal question — the same posture
California is in.

**What adding a second state actually proved.** The interface was written against one state, which
is not an abstraction, it is a rename. Florida disagrees with California on every field, and the
schema absorbed all of it without changing:

| field | California | Florida |
|---|---|---|
| prescriptive period | CCP §321 — 5 years, tax + enclosure elements in §325 | Fla. Stat. §95.18 — 7 years, tax + return-filing + enclosure elements |
| implied from prior use | codified, Civ. Code §1104 | **no source found** |
| easement by necessity | **no source found** | codified, Fla. Stat. §704.01(1), "reasonably necessary" on the statute's face |
| recording act | §1214 carries "first duly recorded" — race-notice marker in a notice sentence | §695.01(1) has no such clause; reads as notice |
| marketable title | §880.020 states policy only; period and easement treatment unfetched | §712.02 — 30 years; §712.03(5) **excepts easements**, conditioned on "so long as the same are used" |

Two findings worth carrying forward:

1. **The prior-use / necessity split earned its keep.** The two states are exact mirror images —
   each has a statute for the doctrine the other lacks. A merged field would have looked complete in
   both and been half-answered in each, from opposite halves.
2. **Florida's MRTA reading fails toward caution**, which is the opposite of California's. The CA
   entry's provisional reading wipes old easements (what the burdened homeowner wants) and is
   flagged twice for it. Florida's keeps them alive. The FL entry therefore needs *less* scrutiny
   than CA's on this field, not more.

**What Florida deliberately does not ship:** any doctrinal duration rule. California has three
presumptions; no primary source has been fetched for a Florida counterpart to any of them. Copying
them across with `fl-` ids would have cost nothing while `review` is null and become live fiction
the day counsel signed off on three rules they had never seen.

**Not done.** `src/config/state-tiers.ts` still has one entry. A Florida *analysis* entry is not a
Florida *Track 1* authorisation — UPL is a separate question from easement doctrine, and free mode
closes Cal. Bus. & Prof. Code §6400's compensation element without touching §6125 or any other
state's equivalent. Phase 4 is where that is decided, and it still needs counsel.
