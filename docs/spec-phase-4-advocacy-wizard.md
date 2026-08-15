# Spec — Phase 4: State-Driven Advocacy Wizard Gating

**Status:** build brief, not yet implemented
**Owner:** Licensing & State Compliance Agent (legal content) + engineering (mechanism)
**Written:** 2026-08-15
**Scopes:** `docs/phase-plan-3-4-5.md` § "Phase 4 — Nationwide Advocacy Wizard"
**Consumes:** `src/config/state-tiers.ts`, `src/lib/gating/*`, `src/lib/advocacy-wizard/*`,
`src/lib/compliance/*`, `src/lib/checkout/*`, `src/lib/letters/maintenance-request.ts`
**Depends on:** Phase 3 (nationwide Analysis Layer) — see §3

---

## 1. What this phase is

Track 1 (paid Maintenance Request Letter) is available in California and nowhere else. The
reason it is available in California is a legal one — the Legal Document Assistant statute,
Cal. Bus. & Prof. Code §6400 et seq. — but the reason it is available *in the code* is a
scatter of `state !== 'CA'` comparisons that know nothing about that statute.

Phase 4 closes that gap. After Phase 4, whether Track 1 is offered is a function of one
thing: **is there a currently-valid, in-scope UPL review record for this state, from counsel
licensed in that state.** Nothing else — not a state code comparison, not a feature flag, not
a disclaimer checkbox — can make Track 1 reachable.

### 1.1 The constraint this spec is organised around

Unauthorized practice of law is a state licensing question and in many states a criminal one.
It turns on whether a non-attorney performed a reserved activity for compensation. It does not
turn on whether the user was warned. Per `development-strategy-v2.md` §4:

> Stronger disclaimer language does **not** expand where Track 1 can legally operate.

Two consequences bind every design decision below:

1. **Disclaimer text is not an input to the availability gate.** `CURRENT_DISCLAIMER` appears
   in this spec exactly once as a gating input, and it is in the *restrictive* direction: a
   disclaimer version that counsel did not review is grounds to *withdraw* authorization
   (§7.3), never to grant it.
2. **This spec contains no UPL classifications.** No state is classified here, and no
   engineer or model may classify one. Phase 4 ships the record structure, the gate, and the
   fixtures. It ships **zero new state entries** in `src/config/state-tiers.ts`. The strategy
   doc is explicit that the Tier A/B/C examples are "a starting hypothesis from general
   research, not a legal determination"; treating them as data would violate the repo's norm
   against unsourced assertions in the one place where that norm matters most.

### 1.2 Track definitions, unchanged

| Track | What it does | Exposure | Payment |
|---|---|---|---|
| **1 — Maintenance Request Letter** | Asserts a position (that a maintenance obligation exists) on the user's behalf, for a fee | The regulated one | Paid; the only checkout path in the product |
| **2 — Request for Clarification** | Asks the servient/dominant party a question; asserts nothing | Materially lower | Free, nationwide |
| **3 — Risk disclosure report** | Describes what the data shows about the parcel | Lower still | Free, nationwide |

Phase 4 changes the gate on Track 1 only. It does not add, move, or tighten any gate on
Track 2 or Track 3 — see §12.

---

## 2. Where California is assumed today

Inventory taken 2026-08-15, so the implementer knows what has to move and what does not.

| Location | What it does | Phase 4 disposition |
|---|---|---|
| `src/lib/gating/state-tier-config.ts` | Schema + `resolveStateCompliance` + `unclassifiedState` fallback | **Already matrix-driven.** Extended, not replaced (§5.1, §6) |
| `src/lib/gating/advocacy-wizard-access.ts` | `evaluateAdvocacyWizardAccess(entry)` → available / not | **Already matrix-driven.** Becomes the single mint point (§5.3) |
| `src/config/state-tiers.ts` | One entry: CA, Tier A, `lastReviewedDate: null` | Entry gains a review record; **no new states** (§6, §11) |
| `src/lib/letters/maintenance-request.ts:60` | `if (state !== 'CA') throw UnsupportedStateForTrackOneError` | **Removed.** Replaced by an authorization argument (§5.4). This is the awkward one: it is a *second, independent* gate that duplicates the matrix and would silently disagree with it the moment a second Tier A state existed |
| `src/lib/analysis-layer/analyze-easement.ts:35` | `if (state !== 'CA') throw UnsupportedStateRuleSetError` | **Kept**, but promoted from an exception into a first-class second gate (§5.2). This is Phase 3's seam |
| `src/lib/advocacy-wizard/build-advocacy-wizard-state.ts` | Doc comment: "Assumes analysis-layer has a rule set for any state this wizard makes available" | **Assumption deleted.** The two gates become independent and ANDed (§5.2) |
| `src/lib/checkout/build-checkout-session.ts` | Takes `requiredFlow: 'licensed-pathway' \| 'mandatory-review'` as a bare string | **Signature change.** Takes an authorization token instead (§9.1). Today any caller can pass the literal `'licensed-pathway'` and reach Stripe with no state involved at all |
| `src/app/{advocacy,checkout,analyze,inquiry,report}/page.tsx` | `const state = param(searchParams.state) \|\| 'CA'` | **Removed default.** State must come from the resolved parcel, not a query param (§9.3) |
| `src/lib/compliance/audit-record.ts` | Records `stateTier` and `complianceBasis: string \| null` | Extended to carry the review record identity and expiry (§10) |
| `src/lib/parcel-resolution/county-resolver.ts`, `resolve-address.ts` | CA/LA-County ZIP heuristics | **Untouched.** Data coverage, not legal gating |
| `src/lib/analysis-layer/ca-rule-set.ts`, `src/lib/jurisdiction/county-database.ts`, `risk-disclosure/*` | CA substantive law, CA county data | **Untouched.** Correctly CA-specific |

The pattern: the *access* layer already reads the matrix. The problem is that (a) the matrix
carries no evidence that a review happened, (b) three downstream modules re-decide the same
question with their own CA comparisons, and (c) nothing re-checks after the first decision.

---

## 3. Dependency on Phase 3, and what can be built now

`phase-plan-3-4-5.md` states the sequencing constraint and this spec does not re-litigate it:

> Phase 3 gates Phase 4 — the wizard cannot be state-aware before state rule sets exist.

That is true of the *substantive* half and false of the *regulatory* half, and Phase 4 is
buildable now because the two are separable.

**Buildable and testable before Phase 3 lands:**

- The review record shape, and making Tier A/B unrepresentable without one (§6).
- The staleness evaluator and its clock injection (§7).
- The authorization token and every call site that consumes it (§5).
- Degradation routing and messaging requirements (§8).
- Checkout binding, the mid-session lapse guard, and the post-payment guard (§9).
- Audit record extension (§10).
- The entire test suite in §11, against **fixture matrices**, not the production matrix.

**Not buildable, and must not be faked:**

- Any second state's substantive rule set. That is Phase 3.
- Any second state's UPL classification. That is counsel's, not this repo's.

**The seam that makes this work:** Track 1 requires two independent gates to both pass —
a valid UPL authorization *and* an implemented state rule set. Phase 4 builds the first and
formalises the second as a registry that returns `true` only for CA. Phase 3 fills the
registry. Because gate 2 is closed for all 50 other jurisdictions on the day Phase 4 merges,
**Phase 4 can merge before Phase 3 with zero user-visible behaviour change**, which is the
point: it can be reviewed and tested on its own.

---

## 4. What "state" means here

The gating state is the **state of the subject parcel**, resolved through
`normalizeAddress` / `resolveAddress`, never a free-form query parameter and never the user's
self-declared residence. Phase 4 requires the state that reaches the gate to be carried with
provenance:

```ts
interface GatingState {
  code: string;                                  // normalized two-letter USPS
  source: 'resolved-parcel' | 'user-entered-address';
}
```

`user-entered-address` is acceptable for Track 2 and Track 3. Track 1 requires
`source === 'resolved-parcel'`; a user-entered state alone is a `no-verified-state` denial
reason (§5.5). Rationale: Track 1 is the fee-charged, position-asserting artifact, and the
jurisdiction it is generated for is the fact the whole legal analysis rests on. It should not
be settable by editing a URL — which today it is (`src/app/checkout/page.tsx:24`).

---

## 5. How availability is derived from the matrix

### 5.1 Two gates, ANDed, evaluated in one place

```
                        parcel state (resolved, §4)
                                   │
                 ┌─────────────────┴──────────────────┐
                 ▼                                    ▼
    GATE 1 — REGULATORY                   GATE 2 — SUBSTANTIVE
    state-tier matrix + UPL review        state rule set implemented?
    record + staleness + scope            (analysis-layer registry)
    + relationship (§5.3)                 Phase 3 owns this
                 │                                    │
                 └─────────────────┬──────────────────┘
                                   ▼
                         both pass?  ──no──►  degrade to Track 2 / Track 3 (§8)
                                   │
                                  yes
                                   ▼
                    mint Track1Authorization (§5.3)
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        wizard fields         checkout (§9)        letter build (§5.4)
        (per-field gate,      re-validates         requires the token,
         unchanged)           at the boundary      has no state logic
```

Neither gate may be inferred from the other. A state can be legally cleared with no rule set
(Track 1 stays off — we cannot analyse it) or have a rule set with no legal clearance (Track 1
stays off — we may not sell it). Both denials degrade identically from the user's point of
view, and distinctly in the audit record.

### 5.2 Gate 2: the rule-set registry

New: `src/lib/analysis-layer/rule-set-registry.ts`

```ts
export function hasRuleSetFor(stateCode: string): boolean;   // true for 'CA' only, in Phase 4
export function ruleSetVersionFor(stateCode: string): string | null;
```

`analyzeEasement` keeps throwing `UnsupportedStateRuleSetError` for an unregistered state —
that is correct defensive behaviour and should stay. But the wizard must no longer *rely* on
the throw: `buildAdvocacyWizardState` calls `hasRuleSetFor` **before** `analyzeEasement`, so a
missing rule set produces a clean degradation (§8) rather than an exception surfacing in the
UI as `error` — which is what `src/app/advocacy/page.tsx` would render today.

`ruleSetVersionFor` feeds the scope fingerprint (§7.3): if a state's substantive rule set is
revised after counsel reviewed the letters it produces, that is scope drift.

### 5.3 Gate 1 and the authorization token

The core structural move: **make Track 1 unreachable without a value that only the gate can
construct.** Not a boolean, not a string — a branded type with a module-private constructor.

New: `src/lib/gating/track1-authorization.ts`

```ts
declare const track1Brand: unique symbol;

/** Constructible only by mintTrack1Authorization. Not exported as a literal shape. */
export interface Track1Authorization {
  readonly [track1Brand]: true;
  state: string;
  tier: 'A' | 'B';
  requiredFlow: 'licensed-pathway' | 'mandatory-review';
  reviewRecordId: string;
  reviewDate: string;        // ISO date, from the review record
  expiresAt: string;         // ISO date-time, §7.1
  scopeFingerprint: string;  // §7.3
  ruleSetVersion: string;
  evaluatedAt: string;       // ISO date-time; the `now` this decision was made against
  notValidAfter: string;     // min(expiresAt, evaluatedAt + TOKEN_TTL_MINUTES), §9.2
}

export type Track1Denial = { authorized: false; reason: Track1DenialReason; state: string };
export type Track1Decision = { authorized: true; authorization: Track1Authorization } | Track1Denial;

export function evaluateTrack1(input: {
  gatingState: GatingState;
  matrix: StateComplianceMatrix;
  now?: Date;                                    // repo convention, cf. buildSendAuditRecord
  artifactVersions?: ArtifactVersions;           // defaults to the live versions
}): Track1Decision;
```

`evaluateAdvocacyWizardAccess` is refactored to delegate to `evaluateTrack1` and to carry the
authorization on its `available: true` arm, so there is exactly one place in the codebase where
a `Track1Authorization` comes into existence. The brand is declared but never exported, so no
other module — including a test — can forge one by object literal. The type-level assertion
for this is a required test (§11.4).

### 5.4 Downstream consumers stop deciding

Every module that currently re-derives eligibility loses that ability:

| Module | Before | After |
|---|---|---|
| `buildMaintenanceRequestLetter` | `state: string` + `if (state !== 'CA') throw` | `authorization: Track1Authorization`; state read from the token; **no state comparison anywhere in the file** |
| `buildCheckoutSession` | `requiredFlow: 'licensed-pathway' \| 'mandatory-review'` | `authorization: Track1Authorization`; `requiredFlow` read from the token (§9.1) |
| `buildAdvocacyWizardState` | `state: string` | unchanged input, but returns the authorization on the available arm and never calls `analyzeEasement` for an unauthorized or ruleset-less state |
| `resolveAttorneyReviewDecision` | `requiredFlow` string | unchanged — it is a pure branch on a value the token now supplies |
| `buildSendAuditRecord` | `stateCompliance` entry | `authorization` for Track 1 sends; entry alone remains valid for Track 2 (§10) |

`UnsupportedStateForTrackOneError` is deleted. Its job is now done by the type system: you
cannot call the letter builder without a token, and you cannot obtain a token for an
unauthorized state.

### 5.5 Denial reasons

```ts
type Track1DenialReason =
  | 'no-verified-state'            // §4: state not resolved from a parcel
  | 'unclassified'                 // no review record exists for this state
  | 'tier-c'                       // reviewed; counsel found Track 1 unavailable
  | 'review-expired'               // §7.1
  | 'review-scope-drift'           // §7.3
  | 'review-manual-hold'           // §7.4
  | 'no-licensing-relationship'    // Tier A with no recorded licensed-pathway relationship
  | 'no-mandatory-review-partner'  // Tier B with no recorded review partner
  | 'no-state-rule-set';           // gate 2
```

These are **audit-facing**, not user-facing. §8.2 governs what the user is told, and it is
deliberately coarser.

---

## 6. The per-state UPL review record

New: `src/lib/gating/upl-review-record.ts` (schema only, no data — same split as
`state-tier-config.ts` vs `state-tiers.ts`).

```ts
export interface UplReviewRecord {
  /** Stable id, e.g. "upl-CA-2026-08". Immutable; a re-review creates a NEW record. */
  id: string;
  state: string;

  reviewer: {
    name: string;
    firm: string | null;
    /** Bar admission IN THE STATE BEING CLASSIFIED. Must equal `state`. */
    barAdmissionState: string;
    barNumber: string;
    /** Engagement letter / matter reference the written opinion lives under. */
    engagementReference: string;
  };

  /** ISO date the written opinion is dated. Not the date it was typed into this repo. */
  reviewDate: string;

  /** Counsel's classification. UNCLASSIFIED is never a review outcome — it is the absence of one. */
  tier: 'A' | 'B' | 'C';

  /**
   * Citations the classification rests on. Transcribed from the written opinion.
   * Never researched by an engineer or generated by a model. Empty array is invalid.
   */
  statutoryBasis: Array<{
    citation: string;                 // e.g. "Cal. Bus. & Prof. Code §6400 et seq."
    shortName: string;                // e.g. "Legal Document Assistant statute"
    effect: 'authorizes' | 'restricts' | 'conditions';
    note: string;                     // counsel's characterisation, quoted or close-paraphrased
  }>;

  /** Exactly what counsel reviewed and approved. A review of v1 does not approve v2. */
  scopeApproved: {
    letterTemplates: Array<{ id: 'maintenance-request'; version: string }>;
    disclaimerVersion: string;
    wizardFieldSetVersion: string;      // which assertions the letter may make
    ruleSetVersion: string;             // the substantive rule set feeding those assertions
    requiredFlow: 'licensed-pathway' | 'mandatory-review' | 'unavailable';
    /** Counsel reviewed a fee-charged, AI-generated product specifically. */
    feeCharged: true;
    aiGenerated: true;
    fingerprint: string;                // §7.3, derived from the fields above
  };

  /** Conditions counsel attached. Non-empty here does NOT loosen anything; it is a record. */
  conditions: string[];

  /**
   * Counsel's separate finding on Track 2 at its current scope, per the strategy doc's
   * per-state task list. RECORDED ONLY — Phase 4 does not gate Track 2 on it (§12).
   */
  track2Assessment: { clearAtCurrentScope: boolean; note: string } | null;

  /** Months of validity counsel set, or the product default (§7.2) if counsel set none. */
  validityMonths: number;
  validityMonthsSource: 'counsel' | 'product-default';

  /** Set by an operator on a re-review trigger; forces denial regardless of dates (§7.4). */
  manualHold: { placedAt: string; placedBy: string; reason: string } | null;

  /** Id of the record this supersedes, if any. Records are append-only. */
  supersedes: string | null;
}
```

### 6.1 The four required elements, mapped

| Required by the phase plan | Field |
|---|---|
| **Reviewer identity** | `reviewer` — and specifically `barAdmissionState`, which the schema requires to equal the state being classified. "Counsel" in general is not what the strategy doc asks for; it asks for "sign-off from actual counsel in that state" |
| **Review date** | `reviewDate`, the date of the written opinion — plus `id` and `supersedes`, so the history is reconstructable |
| **Statutory basis** | `statutoryBasis[]`, structured and non-empty, with an `effect` so a Tier C denial can cite what restricts and a Tier A grant can cite what authorizes |
| **Scope of what was approved** | `scopeApproved`, versioned per artifact. This is the field that makes §7.3 possible |

### 6.2 Making an unreviewed Tier A unrepresentable

`StateComplianceEntry` becomes a discriminated union so the type system, not a runtime check,
rules out a Tier A or B entry with no review record:

```ts
export type StateComplianceEntry =
  | { state: string; tier: 'A'; track1RequiredFlow: 'licensed-pathway';
      review: UplReviewRecord; licensedPathway: LicensedPathwayRelationship | null;
      track2Available: true }
  | { state: string; tier: 'B'; track1RequiredFlow: 'mandatory-review';
      review: UplReviewRecord; mandatoryReviewPartner: MandatoryReviewPartner | null;
      track2Available: true }
  | { state: string; tier: 'C'; track1RequiredFlow: 'unavailable';
      review: UplReviewRecord; track2Available: true }
  | { state: string; tier: 'UNCLASSIFIED'; track1RequiredFlow: 'unavailable';
      review: null; track2Available: true };
```

Notes:

- **Tier C carries a review record too.** "This state restricts non-attorney document
  preparation" is itself a legal assertion and needs a citation. Only `UNCLASSIFIED` asserts
  nothing, which is what `unclassifiedState()` already says correctly today and must keep
  saying: it "gates the same as Tier C … but this is an absence-of-review default, not a legal
  determination."
- `lastReviewedDate` and `basis` are **deleted** from the entry. They are now
  `review.reviewDate` and `review.statutoryBasis` — one source of truth, and no way to set a
  review date without also naming the reviewer.
- `licensedPathway` / `mandatoryReviewPartner` are the business-relationship records the
  strategy doc assigns to the Licensing Agent ("company or a specific certified individual must
  hold or partner under the license, a disclaimer alone does not satisfy this"). Phase 4
  defines their shape and the gate that requires them; **populating them is out of scope**
  (§12). Consequence: in Phase 4, a Tier B state degrades to Track 2/3 because no partner
  record exists — which is exactly what `phase-plan-3-4-5.md` prescribes ("Tier B/C states:
  Track 2 … and Track 3 … only") while keeping the mandatory-review branch structurally
  present as `development-strategy-v2.md` requires. The two documents are reconciled by
  the relationship record, not by deleting the Tier B branch.

---

## 7. Staleness

### 7.1 The rule

A review record authorizes Track 1 only while **all** of these hold, evaluated at decision
time against a single `now`:

1. `now < expiresAt`, where `expiresAt = reviewDate + validityMonths`
2. `manualHold === null`
3. `computeScopeFingerprint(currentArtifactVersions) === review.scopeApproved.fingerprint`

Expiry is **inclusive-fail**: at exactly `expiresAt`, the state is denied. Boundary tests are
required (§11.2).

### 7.2 Where the number comes from

`validityMonths` is set by counsel per state where counsel sets one. Where counsel sets none,
a product default applies:

```ts
export const DEFAULT_REVIEW_VALIDITY_MONTHS = 12;
export const MAX_REVIEW_VALIDITY_MONTHS = 24;   // hard ceiling; a longer counsel value is rejected
```

Two things must be said plainly:

- **12 months is a product policy decision, not a legal one.** No statute sets it and this
  spec does not claim one does. It is chosen to be short enough that an informal Tier B
  tolerance tightening (the strategy doc's stated worry: "can tighten without warning") is
  caught within a year. The owner of this constant is the Licensing & State Compliance Agent,
  and it is recorded in code as such.
- **Counsel may shorten it and may not extend it past the ceiling.** A record with
  `validityMonths > MAX_REVIEW_VALIDITY_MONTHS` fails schema validation at module load, not at
  request time. Rationale: the failure mode of a too-long validity is a stale state serving a
  regulated product, and that must not be a data-entry away.

### 7.3 Scope drift is a second, non-temporal staleness

The mechanism most likely to bite in practice is not the calendar — it is shipping a changed
artifact under an old approval. `computeScopeFingerprint` is a pure function over the versions
counsel actually reviewed:

```ts
export function computeScopeFingerprint(v: ArtifactVersions): string;
// deterministic, sorted, HUMAN-READABLE — e.g.
// "disclaimer=placeholder-v1;flow=licensed-pathway;letter.maintenance-request=v1;
//  ruleset=ca-v1;wizardFields=v1;feeCharged=true;aiGenerated=true"
```

Readable rather than hashed, deliberately: this string lands in the audit record (§10) and
counsel must be able to read it a year later and say what was approved.

Inputs, and why each is in:

| Input | Why a change invalidates the review |
|---|---|
| `letter.maintenance-request` version | Counsel approved specific assertions in a specific letter |
| `disclaimer` version | Counsel reviewed the artifact as delivered, disclaimer included. **This is the only place disclaimer copy touches the gate, and only to close it.** Changing disclaimer text can never open a state — but changing it does invalidate the approval of what was reviewed |
| `wizardFieldSetVersion` | Adding a new asserted field expands what the product claims on the user's behalf |
| `ruleSetVersion` | The substantive basis for those claims changed |
| `requiredFlow` | Moving a state between licensed-pathway and mandatory-review is a different product |
| `feeCharged`, `aiGenerated` | The strategy doc's stated gap is that boundaries are "untested against a fee-charged, AI-generated product specifically". If either stops being true, the review does not transfer |

**Bumping `CURRENT_DISCLAIMER.version` therefore takes every Tier A/B state dark until each
review record is re-fingerprinted by counsel.** That is intended and must be documented at the
top of `disclaimer-copy.ts` so nobody bumps the version casually.

### 7.4 Re-review triggers and the manual hold

The strategy doc assigns the Licensing Agent "re-review triggers: any state law change, any
state moving tiers, and periodic re-review." Periodic is §7.1(1). Event-driven is the manual
hold: an operator sets `manualHold` on a record, and that state is denied from the next
decision onward regardless of dates. A hold is cleared only by a *new* review record
superseding the held one — never by deleting the hold field, which the append-only rule in
§6 already prevents.

### 7.5 Mechanism: evaluated, not swept

Staleness is computed **inside `evaluateTrack1`, on every decision**, from `reviewDate +
validityMonths` and the injected `now`. There is deliberately **no** background job, cron,
scheduled task, or `isExpired` boolean persisted anywhere.

The rejected alternative is worth stating because it is the obvious one: a nightly job that
flips `active: false` on expired records. It is rejected because its failure mode is silent
and fails *open* — if the job does not run, an expired state keeps serving a paid, regulated
product and nothing surfaces. A pure function evaluated in the request path cannot fail open;
if it does not run, no authorization is minted and Track 1 is simply unavailable.

Consequences the implementer must honour:

- **One `now` per request.** Capture `now` once at route entry and thread the same `Date`
  through gating, letter build, checkout and audit. Two `new Date()` calls straddling an
  expiry boundary in one request is the exact bug this is meant to preclude.
- **A warning window is operator-facing only.** `staleWithinDays(entry, now, 60)` may drive an
  operations report so re-reviews can be commissioned in time. It must not appear in any
  user-facing surface and must not alter the decision. Gating flips at `expiresAt`, not before.
- **Clock injection everywhere**, following the existing `now?: Date` convention in
  `buildSendAuditRecord`. Tests set the clock; nothing mocks `Date` globally.

---

## 8. Degradation

### 8.1 What degrades to what

Any denial in §5.5 produces the same product state: **Track 1 is not offered; Track 2 and
Track 3 are offered and are unchanged.** There is no partial Track 1, no preview, no
"generate it and we'll hold it until your state opens."

| Situation | Track 1 | Track 2 | Track 3 |
|---|---|---|---|
| Tier A, valid review, relationship recorded, rule set present | Offered, `licensed-pathway` | Offered | Offered |
| Tier B, valid review, partner recorded, rule set present | Offered, `mandatory-review` | Offered | Offered |
| Tier B, no partner recorded (Phase 4 reality) | **Not offered** | Offered | Offered |
| Tier C | **Not offered** | Offered | Offered |
| Unclassified | **Not offered** | Offered | Offered |
| Any tier, review expired / scope drift / manual hold | **Not offered** | Offered | Offered |
| Any tier, no state rule set | **Not offered** | Offered | Offered |
| State not resolved from a parcel | **Not offered** | Offered | Offered |

The wizard route must render the degraded state as a first-class screen, not an error. Today
`src/app/advocacy/page.tsx` catches `UnsupportedStateRuleSetError` into a generic `error`
string; after Phase 4 that path is unreachable for gating reasons because gate 2 is checked
first (§5.2).

### 8.2 What the user is told

Copy is owned by the Compliance Agent and placed by the UX Agent. Phase 4 specifies
**requirements on the message**, and tests assert the requirements, not the prose.

The message MUST:

- Name the state.
- Say the platform has not completed the legal review needed to generate this correspondence
  in that state — an honest capability boundary, per `development-strategy-v2.md` §3
  ("in plain language, not just a disabled button … should read as an honest capability
  boundary, not an error or a paywall").
- Offer Track 2 (Request for Clarification) and Track 3 (risk disclosure) by name, and a
  general "find an attorney in your state" route.

The message MUST NOT:

- State or imply that the state prohibits non-attorney document preparation, **unless** the
  entry is Tier C, in which case it may say counsel found Track 1 unavailable there and may
  cite `review.statutoryBasis`. For `unclassified`, saying or implying prohibition would be an
  unsourced legal assertion about that state — the existing `unclassifiedState()` note already
  draws this distinction and the copy must preserve it.
- Show a price, a discount, a "coming soon", an "unlock", or an email-capture-to-continue.
  Anything that reads as a paywall is a copy bug (tests in §11.6).
- Offer any waiver, extra consent, or acknowledgement that would let the user proceed. There
  is no user action that opens Track 1, which is the whole point of §1.1.

**Expired and never-reviewed produce the same user-facing message.** The user's situation is
identical — we are not currently able to do this here — and distinguishing them invites
"check back next week" framing about a legal review with no committed date. The *audit
record* distinguishes them precisely (§10); the UI does not.

Reviewer identity, bar number, engagement reference, and expiry dates are internal. None
appear in user-facing copy.

---

## 9. Checkout and pricing

Track 1 is the paid track, so this is where a gating failure costs money and creates the
exposure. Three checkpoints, not one.

### 9.1 Checkpoint 1 — session creation binds to the token

```ts
export interface BuildCheckoutSessionInput {
  authorization: Track1Authorization;   // replaces requiredFlow: string
  attorneyReviewChoice?: AttorneyReviewChoice;
  disclaimerAccepted: boolean;
  successUrl: string;
  cancelUrl: string;
  now?: Date;
}
```

`requiredFlow` is read from `authorization`, never passed. Today the parameter is a bare
string union, which means `buildCheckoutSession({ requiredFlow: 'licensed-pathway', … })` is a
complete, type-checking call to Stripe with no state, no matrix, and no review anywhere in it.
That is the single largest hole Phase 4 closes.

### 9.2 Checkpoint 2 — re-validate at the boundary, do not trust the token

A token proves a decision was made; it does not prove the decision still holds.
`buildCheckoutSession` MUST, before touching `PaymentProvider`:

1. Re-run `evaluateTrack1` with a fresh `now` and the live matrix.
2. Require the new decision to be `authorized: true`.
3. Require `reviewRecordId`, `scopeFingerprint`, and `state` to match the presented token —
   a state that was re-reviewed into a *different* record mid-session is a lapse, not a pass.
4. Require `now < authorization.notValidAfter`, where
   `notValidAfter = min(expiresAt, evaluatedAt + TOKEN_TTL_MINUTES)`.

`TOKEN_TTL_MINUTES` bounds how long a wizard session may sit open before its authorization
must be re-earned. Set it short (30 minutes is the suggested starting value; it is a product
constant, and it is not a legal claim). Without it, a Stripe Checkout Session created near an
expiry could be completed hours later.

On any failure: throw `Track1AuthorizationLapsedError`, **create no Stripe session**, and route
the user to the §8.2 degraded screen with an added plain statement that they have not been
charged. The test asserting the payment provider was never called is required (§11.5).

### 9.3 Checkpoint 3 — re-validate at fulfilment, after payment

Payment succeeding does not authorize delivery. Before
`buildMaintenanceRequestLetter` runs on the success path (or in the Stripe webhook handler,
whichever the implementer wires):

```ts
export function assertTrack1StillAuthorizedForFulfilment(
  authorization: Track1Authorization,
  matrix: StateComplianceMatrix,
  now: Date,
): void;   // throws Track1AuthorizationLapsedError
```

If it throws after payment has been captured, the product must **not** deliver the Track 1
letter. Instead:

- Write an audit record with `fulfilmentOutcome: 'blocked-authorization-lapsed'` and
  `requiresRefund: true`.
- Surface the §8.2 message plus a clear statement that a refund is being issued.
- Offer the free Track 2 letter for the same parcel.

The refund itself is an operational action against a flagged record; Phase 4 specifies the
flag and the block, not an automated refund call (§12). What Phase 4 must not do is deliver
the letter because the money already moved.

### 9.4 Pricing module

`src/lib/checkout/pricing.ts` is unchanged in content. `TRACK_ONE_PRICING.needsBusinessPricingDecision`
stays `true` — Phase 4 makes no pricing decision. Two structural requirements:

- `buildCheckoutLineItems` stays pure and token-free; it is not a gate and must not pretend to
  be one.
- The import-boundary rule from `docs/tech-stack-and-structure.md` — "`checkout/` is only
  referenced from the `advocacy/` route tree" — becomes an asserted test rather than a
  convention (§11.7).

### 9.5 State provenance at checkout

`src/app/checkout/page.tsx:24` currently reads `param(searchParams.state) || 'CA'`. After
Phase 4 the checkout route must not accept a state parameter at all; it takes the resolved
parcel identity and derives the state from it (§4). A checkout request that cannot produce
`source: 'resolved-parcel'` is denied with `no-verified-state`.

---

## 10. Audit trail

`SendAuditRecord` is extended so the strategy doc's requirement — "if a state's tier changes
later, you need to know what was true when a specific letter went out" — is satisfiable for
the *review*, not just the tier:

```ts
export interface SendAuditRecord {
  letterType: 'request-for-clarification' | 'maintenance-request';
  state: string;
  stateSource: 'resolved-parcel' | 'user-entered-address';
  stateTier: StateTier;

  // Track 1 only; null for Track 2
  reviewRecordId: string | null;
  reviewerBarNumber: string | null;
  reviewerBarAdmissionState: string | null;
  reviewDate: string | null;
  reviewExpiresAt: string | null;
  statutoryBasis: string[] | null;      // citations, flattened
  scopeFingerprint: string | null;      // §7.3, human-readable
  requiredFlow: Track1RequiredFlow | null;
  authorizationEvaluatedAt: string | null;

  disclaimerVersion: string;
  attorneyReviewDecision: AttorneyReviewDecision | null;
  generatedAt: string;

  // §9.3
  fulfilmentOutcome: 'delivered' | 'blocked-authorization-lapsed';
  requiresRefund: boolean;
}
```

Denied attempts are recorded too, with the precise §5.5 reason — expired, scope drift and
never-reviewed must be distinguishable here even though they are not in the UI (§8.2).
Overloading: `buildSendAuditRecord` accepts an `authorization` for Track 1 and a bare
`StateComplianceEntry` for Track 2, since Track 2 has no authorization and must not be made to
manufacture one.

Persistence is still out of scope — this stays the in-memory typed shape the current module
describes, designed to serialize directly when a store exists.

---

## 11. Test requirements

Repo convention: colocated `*.test.ts`, `vitest`, `describe`/`it`, fixture matrices declared
inline in the test file (as in `src/lib/gating/state-tier-config.test.ts`), no global date
mocking — inject `now`. `npm test` runs the suite.

### 11.1 Fixtures

One fixture module of matrices, used by every test below, using real USPS codes but **never**
the production matrix:

`tierAValid`, `tierAExpired`, `tierAScopeDrift`, `tierAManualHold`, `tierANoRelationship`,
`tierBValidWithPartner`, `tierBValidNoPartner`, `tierC`, `unclassified`,
`tierAValidNoRuleSet`.

### 11.2 Staleness boundary — required

- At `expiresAt - 1ms`: authorized.
- At exactly `expiresAt`: **denied**, reason `review-expired`. Inclusive-fail is asserted, not
  assumed.
- At `expiresAt + 1ms`: denied.
- `validityMonths` arithmetic across a month with fewer days (review on the 31st) has an
  explicit expected value, so the date maths is pinned rather than incidental.
- A record with `validityMonths > MAX_REVIEW_VALIDITY_MONTHS` fails validation.
- `staleWithinDays` returning true does **not** change the decision.

### 11.3 The load-bearing assertion — no path to Track 1 for an unreviewed or stale state

This is the test the phase exists for. It must be exhaustive, not representative.

- **50-state sweep.** Iterate `US_STATE_CODES` (51 entries incl. DC) against the **production**
  matrix. For every state with no valid review record, assert `evaluateTrack1` returns
  `authorized: false`. Asserting on the real matrix, not a fixture, is the point.
- **Production matrix shape.** Assert the production matrix contains no `tier: 'A'` or
  `tier: 'B'` entry lacking a `review`, and that its entry count matches an explicitly written
  expected list — so adding a state is a deliberate, test-updating act.
- **Every entry point, one test each**, for `tierAExpired`, `tierAScopeDrift`,
  `tierAManualHold`, `tierANoRelationship`, `tierC`, `unclassified`, `tierAValidNoRuleSet`:
  - `buildAdvocacyWizardState` → `access.available === false`, `fields === null`
  - `buildMaintenanceRequestLetter` → not callable (no token obtainable)
  - `buildCheckoutSession` → not callable, and payment provider never invoked
  - `assertTrack1StillAuthorizedForFulfilment` → throws
- **Disclaimer cannot open a gate.** Take a denied fixture, replace the disclaimer copy with
  maximal warning text, re-evaluate: still denied, same reason. This encodes §1.1 as an
  executable assertion.
- **`analyzeEasement` is never reached** for a denied state — assert with a spy that no
  substantive analysis runs for a state the product may not serve.

### 11.4 Forgery

- Type-level: `@ts-expect-error` on an attempt to construct a `Track1Authorization` object
  literal outside `track1-authorization.ts`.
- Runtime: a hand-rolled object cast through `as unknown as Track1Authorization` and passed to
  `buildCheckoutSession` is rejected by the checkpoint-2 re-validation (§9.2), proving the
  re-check is real and the brand is not the only defence.

### 11.5 Mid-session lapse — required by the phase brief

- Mint against `tierAValid` at `t0`. Advance `now` past `expiresAt`. Call
  `buildCheckoutSession` → throws `Track1AuthorizationLapsedError`, and the fake
  `PaymentProvider`'s call count is **0**.
- Same, but the lapse is a scope drift (disclaimer version bumped between mint and checkout)
  rather than a clock advance.
- Same, but the state's review record is superseded by a Tier C record between mint and
  checkout → denied on `reviewRecordId` mismatch.
- `notValidAfter` TTL: valid review, but `now > evaluatedAt + TOKEN_TTL_MINUTES` → denied.
- Post-payment lapse: `assertTrack1StillAuthorizedForFulfilment` throws, no letter is built,
  and the audit record carries `fulfilmentOutcome: 'blocked-authorization-lapsed'` and
  `requiresRefund: true`.

### 11.6 Degradation copy

- Message contains the state code, "Request for Clarification", and the risk-disclosure
  reference — extending the assertions already in `advocacy-wizard-access.test.ts`.
- Unclassified message does **not** contain prohibition language (`prohibit`, `illegal`,
  `barred`, `not permitted in your state`).
- Tier C message may cite `statutoryBasis`; unclassified message contains no citation.
- No message contains a currency symbol, a digit-plus-`.99`, `upgrade`, `unlock`, or
  `waitlist`.
- Expired and unclassified produce **identical** user-facing strings for the same state, while
  their audit reasons differ.
- No message contains a reviewer name, bar number, or expiry date.

### 11.7 Structural guards

- **No stray CA comparisons.** Walk `src/` with `node:fs` and assert no file outside
  `src/config/state-tiers.ts`, `src/lib/analysis-layer/ca-rule-set.ts`,
  `src/lib/parcel-resolution/`, `src/lib/jurisdiction/`, and `src/lib/risk-disclosure/`
  contains a `'CA'` equality comparison. (Node only — Python is not available in this
  environment.)
- **Checkout import boundary.** Assert no file under `src/app/report/`, `src/app/inquiry/`, or
  `src/lib/risk-disclosure/` imports from `@/lib/checkout`.
- **No route reads a state query param for Track 1.** Assert `src/app/advocacy/page.tsx` and
  `src/app/checkout/page.tsx` contain no `searchParams.state`.

### 11.8 Track 2 and Track 3 are untouched

For `tierC` and `unclassified`: `buildRequestForClarificationLetter` builds successfully and
`buildRiskDisclosureReport` runs. A regression here would mean a Phase 4 gate leaked onto a
free track.

---

## 12. Out of scope

Explicitly excluded from Phase 4. Several of these are the failure modes this spec exists to
prevent, not merely deferred work.

1. **Enabling Track 1 anywhere on the strength of disclaimer text.** No amount, placement, or
   forcefulness of disclaimer language may make a state available. Disclaimer version is a
   gating input only in the restrictive direction (§7.3). A pull request that adds a state on
   this basis is rejected on sight.
2. **Producing a UPL classification for any state.** No 50-state matrix, no researched tiers,
   no model-generated statutory analysis. Phase 4 ships zero new entries in
   `src/config/state-tiers.ts`. The Tier A/B/C examples in `development-strategy-v2.md` are a
   hypothesis and must not be transcribed into the config as data.
3. **Obtaining the legal reviews.** Commissioning counsel, receiving written opinions, and
   transcribing them into review records is the Licensing & State Compliance Agent's
   operational work, not this build.
4. **Establishing the licensing relationships** (Tier A) or the mandatory-review partner
   relationships (Tier B). Phase 4 defines the record shape and the gate that requires them;
   it does not create the business relationship, which is what actually satisfies the
   requirement.
5. **Any change to Track 2 or Track 3 availability.** `track2Assessment` is recorded and not
   acted on. Turning Track 2 off in a state would be its own decision with its own spec.
6. **Multi-state substantive rule sets.** Phase 3.
7. **Any pricing decision.** `needsBusinessPricingDecision` stays `true`.
8. **Automated refunds.** §9.3 specifies the block and the `requiresRefund` flag; wiring a
   refund API call is separate.
9. **A persistence layer.** Audit records stay in-memory typed shapes.
10. **Rewriting disclaimer copy.** Compliance Agent owns wording; Phase 4 owns only the fact
    that its version participates in the scope fingerprint.
11. **Any probability score, likelihood percentage, or proximity-derived easement inference.**
    Settled: proximity is never an easement, and evidence tiers are ordinal, not probabilistic.
12. **Any framing of product output as legal advice or as an appraisal.** Unchanged and
    non-negotiable across all tracks.
13. **A background expiry sweep, cron, or scheduled task** for staleness. Rejected with reasons
    in §7.5; adding one later would reintroduce the fail-open mode.
14. **A "notify me when my state is available" capture** on the degraded path. It may be
    reasonable later, but it needs copy review against the paywall-framing rule in §8.2 and is
    not part of this build.
15. **Territories and non-US jurisdictions.** `US_STATE_CODES` is 50 states plus DC by design.

---

## 13. Deliverables

- `src/lib/gating/upl-review-record.ts` — schema, validation, `computeScopeFingerprint`,
  validity constants. No data.
- `src/lib/gating/track1-authorization.ts` — branded token, `evaluateTrack1`, denial reasons,
  `Track1AuthorizationLapsedError`, `assertTrack1StillAuthorizedForFulfilment`.
- `src/lib/gating/state-tier-config.ts` — entry becomes the discriminated union in §6.2;
  `lastReviewedDate` and `basis` removed.
- `src/lib/gating/advocacy-wizard-access.ts` — delegates to `evaluateTrack1`; carries the
  authorization; message requirements per §8.2.
- `src/lib/analysis-layer/rule-set-registry.ts` — gate 2; `CA` only.
- `src/lib/advocacy-wizard/build-advocacy-wizard-state.ts` — two-gate ordering, `now`
  threading, rule-set check before `analyzeEasement`, stale assumption comment deleted.
- `src/lib/letters/maintenance-request.ts` — takes an authorization; all state logic and
  `UnsupportedStateForTrackOneError` removed.
- `src/lib/checkout/build-checkout-session.ts` — token-bound, re-validating (§9.1–9.2).
- `src/lib/compliance/audit-record.ts` — extended record (§10).
- `src/config/state-tiers.ts` — CA entry migrated to carry a review record. **No new states.**
- `src/app/{advocacy,checkout}/page.tsx` — state from resolved parcel, no `|| 'CA'` default,
  degraded state rendered as a screen rather than an error string.
- Tests, colocated, per §11 — including the 50-state sweep, the expiry boundary, the
  disclaimer-cannot-open-a-gate assertion, the mid-session and post-payment lapse tests, and
  the structural guards.
- A note at the top of `src/lib/compliance/disclaimer-copy.ts` stating that bumping `version`
  takes every Tier A/B state dark until re-fingerprinted (§7.3).

---

## 14. The consequence that must be decided before merge

`src/config/state-tiers.ts` today carries `lastReviewedDate: null` for California, with a
comment saying exactly what that means: "do not treat this entry as reviewed until then."

Under §6.2 and §7.1, California therefore has **no valid review record**, and the honest
outcome of implementing this spec is that **Track 1 goes dark in California too** until a real
review record exists — reviewer, bar number, opinion date, citations, and approved scope.

This is not a bug in the spec. It is the spec working. The alternatives were considered:

- **Grandfather CA past the gate.** Rejected. A hardcoded exemption is the CA hardcode this
  phase exists to remove, reintroduced one layer up and harder to see.
- **Add a `provisionalReview` escape hatch.** Rejected. Any bypass that exists will be used,
  and a bypass on this particular gate is the one that carries criminal exposure in some
  states.

The two acceptable paths, to be chosen by the product owner before merge:

1. Record California's real review — this is a scheduling problem, not an engineering one —
   and Track 1 continues uninterrupted.
2. Accept Track 1 dark until that review lands, with the product running Track 2 and Track 3
   nationwide, which is the configuration the strategy doc already describes as the safe
   default.

There is no third option, and the test suite in §11 will fail on any attempt to construct one.
Note that development and testing are unaffected either way: §11 runs entirely against fixture
matrices.

---

## 15. Sequencing

1. `upl-review-record.ts` + `computeScopeFingerprint` + validity constants, with tests. No
   consumers yet.
2. `state-tier-config.ts` union migration; CA entry migrated; existing gating tests updated.
3. `track1-authorization.ts` and the refactor of `evaluateAdvocacyWizardAccess`. Staleness
   boundary tests land here.
4. `rule-set-registry.ts` and the two-gate ordering in `buildAdvocacyWizardState`.
5. Token propagation: `maintenance-request.ts`, then `build-checkout-session.ts`, then the
   fulfilment guard. The mid-session and post-payment lapse tests land with each.
6. Audit record extension.
7. Route changes and degraded-screen rendering; copy requirement tests.
8. Structural guard tests (§11.7) last, once the CA comparisons are actually gone.

Steps 1–6 are independent of Phase 3. Step 4 is the seam Phase 3 plugs into: when a state's
rule set ships, `hasRuleSetFor` returns true for it and nothing else in this phase changes.
