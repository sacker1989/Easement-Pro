# Spec — Phase 5: Professional Handoff

**Status:** build brief, not yet implemented
**Owner:** a dedicated subagent — this spec is the whole brief; assume no other context beyond the
files it names
**Written:** 2026-08-15
**Consumes:** `src/lib/easements/*`, `src/lib/valuation/*`, `src/lib/compliance/*`,
`src/lib/jurisdiction/*`, `src/lib/parcel-resolution/*`
**Related:** [`phase-plan-3-4-5.md`](./phase-plan-3-4-5.md) (the scope this details),
[`spec-easement-valuation.md`](./spec-easement-valuation.md) §6.1 / §6.1a,
[`records-request-fdot-d7.md`](./records-request-fdot-d7.md) (the worked example this generalises)

---

## 1. Goal

**This product screens. A licensed appraiser or attorney values.** That handoff is the product's
honest terminal state, and it is currently missing: `attorney-review.ts` resolves whether review is
*required* and produces a one-line status string, but it produces no package. A user who is told
"take this to a professional" is handed nothing to take.

Phase 5 builds the thing they take: a **referral package** that assembles everything the product
measured, states plainly everything it did not, and — where the standard permits an actual
computation — accepts the one input a professional supplies and runs it.

## 2. Constraints this phase must not re-litigate

These were measured or researched in Phase 2. Re-deriving them wastes the phase. They are restated
here because the build agent will be tempted by each one.

1. **No permanent-easement formula, and no encumbrance factor table.** Uniform Appraisal Standards
   for Federal Land Acquisitions (2016) §4.6.5 rejects percentage-of-fee, customary going rates,
   **and** strip valuation (`encumbered area × land rate × factor`). `encumbrance-factors.ts` ships
   deliberately empty and `YELLOW_BOOK_4_6_5.stripValuationRejected` records the finding. The missing
   factor was never the blocker; the formula was.
2. **Temporary easements are the exception** (§4.6.5.1.2, market rental value for the term) and are
   already implemented in `temporary-easement.ts`. The rate must be **observed** and must never be
   derived from fee value (§4.7); `assertObservedRate` enforces this and Phase 5 must not route
   around it.
3. **Valuation error is measured**: ZIP-comparable path 19.3% median APE, p90 76.0%, p95 151.0%.
   `calibratedRange` is calibrated for that path *only* and throws for every other path.
4. **Proximity is never an easement.** Tier A permits a valuation *attempt*; `provenanceConfidence`
   maps `proximity-inference` to `flagged` regardless of tier.
5. **The product must never present its output as an appraisal.** This is enforced in §7, by test,
   not by intention.

## 3. Module layout

New directory, colocated tests per repo convention (`vitest`, `src/**/*.test.ts`, `@/` alias):

```
src/lib/handoff/
  referral-package.ts        build + integrity invariant + the ReferralPackage type
  not-determined.ts          the closed catalogue and the always-present floor
  area-derivation.ts         how the encumbered area was measured (new; see §5.3)
  appraisal-claim-scan.ts    FORBIDDEN_CLAIM_PATTERNS and the scanner
  render.ts                  plain text / markdown / JSON renderers
  rent-intake.ts             appraiser-supplied observed rent -> valueTemporaryEasement
  records-request/
    jurisdiction-rule.ts     the per-jurisdiction rule interface
    fl-fdot.ts               the ONE populated rule, from the worked example
    registry.ts              lookup; returns `unsupported` for everything else
    build-request.ts         renders a draft request from a rule + targeted parcels
  index.ts                   barrel, matching src/lib/*/index.ts convention
```

Nothing in `src/lib/valuation/` is modified. One existing file must change — see §10.2.

---

## 4. The package, top level

```ts
export interface ReferralPackage {
  readonly packageVersion: string;          // bump on any shape change
  readonly generatedAt: string;             // ISO
  readonly disclaimerVersion: string;       // CURRENT_DISCLAIMER.version, never a literal
  readonly disclaimerNeedsSignOff: boolean; // CURRENT_DISCLAIMER.needsComplianceSignOff
  readonly whatThisIs: string;              // constant; see §4.1
  readonly parcel: ParcelIdentity;                       // §5.1
  readonly evidence: EvidenceSection;                    // §5.2
  readonly encumberedArea: EncumberedAreaSection | null; // §5.3 — null is a valid, honest state
  readonly landValue: LandValueSection | null;           // §5.4 — null is the MAJORITY state
  readonly caveats: readonly Caveat[];                   // §5.5, verbatim, never paraphrased
  readonly notDetermined: NotDeterminedSection;          // §6 — REQUIRED, non-empty by type
  readonly temporary: TemporaryAddendum | null;          // §8
  readonly recordsRequests: readonly RecordsRequestDraft[]; // §9
  readonly attorneyReview: AttorneyReviewDecision | null;   // §10.1
  readonly illustrative: boolean;           // true if any figure rests on a hypothetical input
}
```

`encumberedArea: null` and `landValue: null` are not failure states. They are the expected output for
most parcels, and each one *adds an item to `notDetermined`* rather than suppressing a section.

### 4.1 The standing header

A single exported constant, rendered first in every form, stating what the package is and is not. It
must be one string in one place — the same discipline `disclaimer-copy.ts` states for disclaimers
("reused verbatim, not re-paraphrased per surface"). Required content:

- what was measured and from which sources;
- that no opinion of market value for a permanent easement is offered, and why (cite
  §4.6.5 via `YELLOW_BOOK_4_6_5.citation`);
- that the correct measure is before-and-after and requires a highest-and-best-use analysis of this
  specific property, which comes from an appraiser;
- that nothing here is an appraisal, a legal determination, or advice.

Do not write new disclaimer copy for the footer — take `CURRENT_DISCLAIMER.letterFooterText`.

---

## 5. Package contents

### 5.1 Parcel identity

| field | source | note |
|---|---|---|
| APN / AIN | `resolve-address.ts` → parcel lookup | the identifier the professional will re-query with |
| county, state, FIPS | `county-database.ts` via `DispatchResult` | |
| routing tier | `DispatchResult.routingTier` | drives §5.5's jurisdiction caveat |
| situs address | `NormalizedAddress` | |
| owner name | **often unavailable** | see below |
| geometry source + query date | `agent.source.verifiedOn`, layer URL | |

**Owner identity is a not-determined item more often than not.** The LA County parcel service carries
no owner field among its 92 — `county-database.ts` records this as consistent with California
Government Code §7928.205, which bars owner identity from public parcel REST endpoints statewide. A
package that cannot name the owner must say so in §6 rather than leaving a blank line, because an
appraiser reading a blank assumes it was omitted, not unavailable.

### 5.2 Evidence tier with geometric basis

Carry `TierAssessment` through unchanged — `tier`, `distanceFt`, `basis`, `implication`, `mayValue` —
plus the `summariseTiers(findings, fromRecordedEasements)` line. Rules:

- **Reproduce `basis` and `implication` verbatim.** They are the geometric fact and its limit; a
  reworded version is a new claim nobody reviewed.
- **Carry `fromRecordedEasements` explicitly.** `summariseTiers` already documents that understating
  recorded evidence (Orange County's Encumbrances layer, with estate code and document reference) is
  its own error, not a safe default. The package must distinguish "a power line was seen crossing the
  parcel" from "the county publishes an encumbrance against this parcel."
- **Include `provenanceConfidence(provenance)` alongside the tier.** Tier A + `proximity-inference`
  is `flagged`, and the package must show both. A professional needs to know the tier permitted a
  valuation attempt *and* that provenance never rose above inference.
- **Tier B and C findings are included, labelled as context.** Tier C's `implication` already says it
  implies no encumbrance. Omitting them would let a later reader think they were never checked.
- **State the negative-result asymmetry**, per `spec-proximity-easement-scan.md` §2: finding nothing
  means nothing was found *in the layers queried*, and the layers are incomplete.

### 5.3 Encumbered area with its derivation

There is no area-provenance type in the repo today. `ParcelEasement.areaSqFt` is a bare number, and
`EasementProvenance` describes how the *easement* became known, not how the *area* was measured.
Those are genuinely different: FDOT publishes `AREA_SF` directly (strong area provenance) for TCE
parcels whose term and compensation are entirely unknown (nil terms provenance). So Phase 5 defines:

```ts
export type AreaDerivation =
  /** A published area field in the source layer, e.g. FDOT AREA_SF / AREA_SQFT. */
  | { kind: 'published-field'; layer: string; field: string; queriedOn: string }
  /** Computed from polygon geometry. Spatial reference and units MUST be named. */
  | { kind: 'geometry-computed'; layer: string; method: string; spatialReference: string;
      queriedOn: string }
  /** Width x length taken from a recorded instrument or plat. */
  | { kind: 'dimensions-stated'; widthFt: number; lengthFt: number; documentRef: string }
  /** The user typed it. Unverified. */
  | { kind: 'user-asserted' };
```

Requirements:

- **No default width, ever.** A width is not inferable from easement type — §4.6.5's "there is no
  'generic' road easement, conservation easement, or any other type of easement" forecloses exactly
  that inference, and `YELLOW_BOOK_4_6_5.noGenericEasementByType` records it. An area with no
  derivation is `encumberedArea: null` plus a not-determined item.
- **Spatial reference is mandatory for `geometry-computed`.** LA's geometry is EPSG:2229 (NAD83
  California zone 5, US survey feet), so `Shape.STArea()` is square feet — for another service it may
  not be, and an unnamed unit is a 9× or 43,560× error waiting to happen.
- **Express the area as a share of the parcel too**, when parcel area is known. A professional sizing
  a before-and-after job needs the ratio, not just the strip.
- **Do not multiply this by anything.** See §7.

### 5.4 Land value with its measured error band

Source: `reconcilePaths(pathA, pathB, coverage)` → `Reconciliation`, whose bounds already run through
`calibratedRange`. Carry `pointEstimate`, `low`, `high`, `confidence`, `explanation`, plus
`describeCalibration(range)` verbatim.

Hard rules, each of which corresponds to an existing guard the package must **propagate rather than
catch**:

1. **Only the ZIP-comparable path can carry a band.** `calibratedRange` throws `CalibrationError` for
   `market-indexed` and `unknown`. The builder must not catch it and substitute a range; it must
   check the path first and, where no band exists, set `landValue: null` and add a not-determined
   item quoting the reason. The live two-parcel check that motivated the guard produced 90% ranges of
   $482k–$3.53M and $631k–$4.63M — arithmetically correct and meaningless.
2. **A ZIP failing `mayEmitEstimate(fitness)` emits no figure.** Not a wider band — no figure.
3. **Discordant reconciliation leads with no number.** `reconcilePaths` already returns
   `pointEstimate: null` there; the renderer must not fill it from `low`/`high`.
4. **`highUnbounded` renders as an explicit unbounded top**, never as a large number and never
   silently truncated. At 95% coverage the measured error is 151% and no finite upper bound exists.
   `isRangeInformative` returning false is a signal to prefer `flagged` over rendering the interval.
5. **Reproduce the two limits `describeCalibration` names** — accuracy degrades with ZIP price level,
   and error is systematically signed by position within the ZIP (cheapest fifth overstated ~62%,
   dearest fifth understated ~29%). These are the sentences an appraiser will actually use to decide
   how much weight to give the figure.
6. **Label what the figure is: land value for the parcel.** It is not an easement value, and it is
   not the value of the encumbered strip.

### 5.5 Caveats — gathered, not written

The package writes **no new caveat prose**. It collects existing strings verbatim and cites where each
came from:

| caveat | source |
|---|---|
| letter footer disclaimer | `CURRENT_DISCLAIMER.letterFooterText` |
| before-and-after methodology | `BEFORE_AND_AFTER_METHODOLOGY_NOTE` |
| calibration limits | `describeCalibration(range)` |
| jurisdiction data confidence | `mapJurisdictionToConfidence(dispatch).caveat` |
| assessed-value staleness | `ORANGE_COUNTY_STALENESS_CAVEAT`, where the parcel is in a county with no Prop 13 base year |
| tier implication | `TierAssessment.implication` |
| standard cited | `YELLOW_BOOK_4_6_5.citation` |
| rate limits (temporary path) | `NASS_AGRICULTURAL_RENT.invalidFor`, `TCE_SOURCE_NOTES.stillMissing` |

A `Caveat` is `{ text: string; sourceSymbol: string }`. Tests assert exact-string containment against
the imported constants, so a future edit to the source constant either flows through or fails the
suite — it cannot silently diverge.

---

## 6. What was NOT determined — REQUIRED

This is the section a professional most needs and the one most likely to be dropped: it is the only
part of the package that contains no numbers, so it is the part a hurried renderer, a summary view, or
a copy-paste truncates first. Phase 5 makes dropping it impossible rather than discouraged.

### 6.1 Shape

```ts
export interface NotDeterminedItem {
  readonly key: NotDeterminedKey;   // closed union, see §6.2
  readonly what: string;            // the question left open, in the user's terms
  readonly why: string;             // why this product cannot answer it, with the citation
  readonly whoResolves: 'licensed appraiser' | 'attorney' | 'records custodian' | 'title company'
                      | 'surveyor' | 'the property owner';
  readonly whatWouldResolveIt: string; // the concrete next artefact
}

/** Non-empty by construction: an empty array does not typecheck. */
export type NotDeterminedSection = readonly [NotDeterminedItem, ...NotDeterminedItem[]];
```

### 6.2 The closed catalogue

`NotDeterminedKey` is a closed union so the catalogue is enumerable and testable. Four items are the
**always-present floor** and appear in every package regardless of input:

| key | what | why |
|---|---|---|
| `permanent-easement-value` | The market value of any permanent easement on this parcel | §4.6.5: the measure is before-and-after; percentage-of-fee, going rates and strip valuation are all rejected. No formula this product can run produces it. |
| `encumbrance-factor` | The share of fee value the easement takes | It is an **output** of a before-and-after appraisal, not an input looked up by type. `lookupEncumbranceFactor` returns `unsourced` for every type. |
| `remainder-damage` | Severance / damage to the remainder | Included automatically in a proper before-and-after; not separately computable here. |
| `highest-and-best-use` | The property's highest and best use, before and after | Requires an on-the-ground analysis of this specific property. |

Conditional items, added when the corresponding input is absent or the corresponding guard fires:

| key | added when |
|---|---|
| `easement-existence` | provenance is anything other than `recorded-document` / `plat-map` — geometry does not establish that an easement exists |
| `easement-terms` | no recorded instrument was read: width, exclusivity, reserved rights, maintenance obligations |
| `authorisation-of-occupation` | tier A — whether the operator holds an easement at all, or is occupying without one, in which case the owner may be **owed** compensation rather than burdened (`TierAssessment.implication` says this; the package must not lose it) |
| `owner-identity` | the parcel source withholds it (§5.1) |
| `encumbered-area` | no `AreaDerivation` available (§5.3) |
| `land-value` | no band emittable — non-ZIP-comparable path, unfit ZIP, or discordant paths (§5.4) |
| `temporary-term` | a temporary easement whose term is unknown; DOT ROW layers publish none (`TCE_SOURCE_NOTES.stillMissing`) |
| `compensation-paid` | comparable compensation is not published; FDOT's `APPRAISAL` field holds a **date**, not an amount |
| `observed-market-rent` | no observed rent exists for this land class; open data supplies agriculture only (`NASS_AGRICULTURAL_RENT`) |
| `legal-conclusions` | the state has no counsel-reviewed rule set (Tier C / `UNCLASSIFIED`) — a Phase 3/4 gate, surfaced here rather than guessed |

### 6.3 How omission is made impossible

Five mechanisms, deliberately overlapping, because one is a convention and five are a constraint:

1. **Type.** `notDetermined` is required and non-empty by type. `notDetermined: []` fails to compile
   (asserted with `@ts-expect-error` in the suite).
2. **No caller input.** `buildReferralPackage` computes the section. There is no parameter to supply,
   override, filter, or suppress it, and no `sections` selector on any renderer. Composition, not
   configuration — the same reason `lookupEncumbranceFactor` has no `defaultFactor` parameter.
3. **Invariant at render, not only at build.** `assertPackageIntegrity(pkg)` runs inside *every*
   renderer and inside `parseReferralPackage`, throwing `ReferralPackageError` when the floor items
   are missing or the appraisal-claim scan trips. Duplicated on purpose: a package may arrive
   deserialized from a store rather than freshly built, and build-time validation does not survive
   `JSON.parse`.
4. **Ordering.** In every rendered form the section appears **immediately after parcel identity and
   before any dollar figure**. A truncated copy keeps the limits; a reader who stops early has read
   the caveats rather than only the numbers. This is asserted by index comparison in the test suite,
   not left to the template.
5. **Not a sidecar.** It is a field of the same object, serialised in the same JSON. There is no
   "summary package" variant and no separate caveats document that can drift or be forwarded alone.

---

## 7. Never an appraisal

### 7.1 The scanner

`appraisal-claim-scan.ts` exports `FORBIDDEN_CLAIM_PATTERNS` and runs them over every free-text field
of every rendered form. This follows the `DERIVED_FROM_FEE` precedent in `temporary-easement.ts`: a
regex cannot stop a determined caller, but it catches the honest mistake, which is the realistic
failure mode.

**The subtlety that will be got wrong: do not ban the word "appraisal."** The package legitimately
and repeatedly contains it — "Uniform Appraisal Standards for Federal Land Acquisitions", "this is
not an appraisal", "requires an appraiser", "the accepted before and after appraisal method". A word
ban fires on the standard's own name and would push the build agent to strip the citations, which is
the opposite of the goal. Target **claim shapes**:

- an assertion that this document *is* one: `/(this|the)\s+(report|package|estimate|analysis)[^.]{0,60}\b(is|constitutes|serves as|qualifies as)\b[^.]{0,30}\ban appraisal\b/i`
- terms of art that assert appraised authority: `/\bappraised value\b/i`, `/\bcertified appraisal\b/i`, `/\bUSPAP[- ]compliant\b/i`, `/\bopinion of (market )?value\b/i`
- an asserted easement value: `/\b(fair )?market value of the easement\s+(is|=)/i`, `/\beasement is worth\b/i`
- compensation stated as owed: `/\byou are (owed|entitled to)\b/i`

Plus a **required affirmative**: the rendered output must contain the standing not-an-appraisal
sentence from §4.1. Absence fails the invariant just as a forbidden match does.

### 7.2 The rejected method must not reappear

`src/lib/valuation/index.ts` still exports `EasementValuationCalculator`, `resolveImpactPercentage`
and `IMPACT_TIERS` — the IRWA percentage-of-fee matrix, documented as live architecture in
`src/lib/valuation/README.md`, and superseded by `spec-easement-valuation.md` §6.1. It is the most
inviting API in the directory and it computes precisely `area × unit value × impact %`, the shape
§4.6.5 rejects as strip valuation.

Therefore:

- The handoff module **must not import** `calculator.ts` or `valuation-matrix.ts`. A source-text test
  asserts this (read the module files, assert no matching import), because a comment will not survive
  a well-meaning refactor.
- The package must contain **no product of encumbered area and a land rate**, under any field name.
- The not-determined reason text for `permanent-easement-value` must cite the rejection explicitly, so
  the package explains why the obvious number is absent rather than looking incomplete.

---

## 8. The temporary-easement path

The one place where the package converts into a real figure, and only with an input a professional
supplies.

### 8.1 The ask

Where a temporary easement is present, the package emits an `AppraiserRentRequest` — a pre-filled ask,
not a blank form:

- encumbered area with its `AreaDerivation`;
- term, or a pointer to the `temporary-term` not-determined item;
- land class and land use code of the subject parcel, with source;
- jurisdiction and market;
- **the constraint, stated up front**: the rate must be an observed market ground rent for this land
  class; a rate derived from fee value will be rejected by the tool, quoting §4.7's "improper to
  develop an opinion of the market rental value ... based on the value of the underlying fee" and the
  fact that federal courts reject it *even where comparable leases are unavailable*.

Stating the constraint in the ask matters: an appraiser who returns a capitalised land value has done
work that `assertObservedRate` will throw on, and finding that out after the fact wastes their time.

### 8.2 The intake

```ts
export interface HandoffRentRate extends MarketRentRate {
  readonly landClass: string;       // what land class the rent was observed for
  readonly landClassSource: string; // where that classification came from
}

applyObservedRent(pkg, rate: HandoffRentRate, terms: {
  termYears: number; retainedUseShare?: number; discountRate?: number;
}): ReferralPackage
```

`landClass` is added by the handoff layer rather than by editing `MarketRentRate`, keeping
`temporary-easement.ts` untouched. It exists because that module documents the 360× agricultural-vs-
suburban trap in prose but cannot enforce it in the type system: Florida pasture runs ~$0.00069/sq
ft/yr against an illustrative suburban $0.25/sq ft/yr, and applied to a 1,204 sq ft easement over two
years the pasture rate yields **$1.66**. The land class is not a detail; it is the whole magnitude.

Rules:

1. **Perpetual easements reject a rent outright.** Throw. §4.6.5.1.2 is a temporary-acquisition
   measure and running it on a perpetual easement would manufacture the number §6 says does not
   exist.
2. **Term is required and must come from the instrument.** No default, no "assume 12 months". Absent
   term ⇒ no valuation and the `temporary-term` item stands.
3. **Delegate to `valueTemporaryEasement` unchanged**, and **let its errors propagate**. Do not catch
   `TemporaryEasementError` and downgrade to a warning — the throw is the feature.
4. **Land-class mismatch is a hard flag.** Where `rate.landClass` does not match the parcel's land
   use, refuse and explain with `NASS_AGRICULTURAL_RENT.invalidFor`. Matching is not fully
   automatable, so the check is: exact-match passes silently; anything else requires an explicit
   acknowledgement field on the call and renders a prominent mismatch notice.
5. **`hypothetical: true` sets `pkg.illustrative`**, and every renderer shows it as a header banner,
   not a footnote. `valueTemporaryEasement` already prefixes its note with the illustrative warning;
   the package must not bury that where a reader meets the dollar figure first.
6. **Applying a valuation removes nothing from §6.** The permanent-easement item, the factor item and
   the remainder-damage item all stand — a valued TCE says nothing about a perpetual encumbrance on
   the same parcel, and the module's own note already says it "does not address any permanent easement
   or damage to the remainder."
7. **Retained use defaults to 0** and the module's rationale carries into the package: that is the
   assumption that does not understate the owner's claim, and it should be reduced only from the
   easement's actual terms.

---

## 9. Records-request generation

### 9.1 What the worked example actually proved

`docs/records-request-fdot-d7.md` is not a template. Its central finding is that **targeting depended
on statutory exemption state**: Sec. 119.0711, F.S. exempts "appraisals, other reports relating to
value, offers, and counteroffers" until a valid option contract is executed or a written offer to sell
is conditionally accepted. Asking about an in-progress acquisition gets refused. A scan of 1,558 FDOT
services was needed to find the layers where that exemption had already lapsed, and an earlier draft
aimed at Pasco `Segment_2a_ROW_Status` was superseded precisely because `ACQUIRED` and `ACQ_DATE` were
empty there.

Generalising the *letter* while dropping the *exemption analysis* would produce requests that get
denied. So the unit of generalisation is a per-jurisdiction rule, not a body of text.

### 9.2 The rule interface

```ts
export interface RecordsRequestJurisdictionRule {
  readonly key: string;                 // e.g. 'FL/FDOT-D7'
  readonly statute: { cite: string; name: string; retrievedOn: string };
  readonly custodian: { name: string; email?: string; phone?: string; address?: string;
                        portalUrl?: string; verifiedOn: string };
  /** Whether records of value are exempt, and the condition under which the exemption lapses. */
  readonly valueRecordExemption: {
    readonly cite: string;
    readonly covers: string;
    readonly lapsesWhen: string;
    /** Whether a non-value term (e.g. duration) is severable from the exemption, and on what basis. */
    readonly severabilityArgument: string | null;
  } | null;
  /** Which published parcels are askable NOW, and which are askable in the alternative. */
  readonly targeting: {
    readonly describeGroupA: string;   // unambiguous
    readonly describeGroupB: string;   // strong evidence, not the agency's own flag
    readonly fieldSemantics: readonly { field: string; value: string; meaning: string }[];
  };
  readonly withholdingAsks: readonly string[]; // partial production, statutory basis, re-request id
  readonly feeAdvanceRule: string;
  readonly responseDeadlineRule: string | null;
}
```

`fieldSemantics` exists to encode the trap the worked example found: in those layers `ACQUIRED` is
usually the literal string `"N/A"`, which is **not an acquisition status** — it maps to *unknown*, not
to *no*. Only parcels 705A and 705B read `COMPLETE`. Treating `"N/A"` as a negative would discard
twelve ROW-certified parcels; treating it as a positive would target in-progress acquisitions and get
the request denied.

### 9.3 The registry ships one populated rule

`fl-fdot.ts` only, transcribed from the worked example. Every other jurisdiction returns:

```ts
{ status: 'unsupported', jurisdiction, explanation: /* what research is required */ }
```

This mirrors the norms already established in the repo — `encumbrance-factors.ts` shipping empty,
`unclassifiedState()` gating as absence-of-review rather than as a determination. **Do not apply the
Florida statute to another state.** Public records law, the existence of a value-records exemption,
its lapse condition, fee rules and deadlines are all state law and genuinely differ. A generated
request citing the wrong statute is worse than none: it tells the custodian the requester does not
know their own law, and it invites a denial that is harder to appeal.

### 9.4 Generated output

Every request is `status: 'draft-not-sent'`, carries the NOT SENT banner verbatim in the same terms
the worked doc uses, and preserves the structure that made the draft defensible:

- Group A / Group B split, so a partial denial does not sink the whole request;
- **Item 1 (term) requested independently of Item 2 (compensation)**, with the severability argument
  from the rule — the duration of an easement is a term of the instrument rather than a report of
  value. Where `severabilityArgument` is null for a jurisdiction, the split is not asserted;
- the three withholding asks: partial production, statutory basis for any withholding, and the
  identifier to cite to re-request once the exemption lapses;
- a fee cap placeholder and a preference for a spreadsheet of term and amount over copies of
  instruments, which is cheaper to fulfil and therefore likelier to be answered;
- a narrow ask overall: everything else — parcel identity, owner, encumbered area, ROW certification
  date — is already published.

**The product never sends anything.** No email, no portal submission. It renders a draft for the user
to review and send, exactly as the worked doc frames it.

---

## 10. Compliance routing

### 10.1 Existing hooks

- **Disclaimer.** `disclaimerVersion` and `disclaimerNeedsSignOff` come from `CURRENT_DISCLAIMER`,
  never from literals. `needsComplianceSignOff` is still `true`: all copy is placeholder, and the
  referral package is the most legally exposed surface the product has produced. The package must
  render an explicit "this language has not been reviewed by counsel" line while that flag is true.
- **Attorney review.** Where the package is produced inside a Track 1 flow, run
  `resolveAttorneyReviewDecision` and include `buildAttorneyReviewStatusLine`. Note the constraint in
  §10.2 below.
- **Audit.** Every rendered package and every generated records request produces a `SendAuditRecord`
  via `buildSendAuditRecord`, linking it to the state tier, compliance basis and disclaimer version
  active at generation time.

### 10.2 The one existing file Phase 5 must change

`SendAuditRecord.letterType` is a closed union of `'request-for-clarification' | 'maintenance-request'`
and cannot describe a referral package or a records request. Widen it in
`src/lib/compliance/audit-record.ts` to add `'referral-package'` and `'records-request'`. Do this
there, in the one audit shape, rather than forking a parallel record in the handoff module — the
audit trail's value is that it is single.

### 10.3 What Phase 5 must NOT change

`resolveAttorneyReviewDecision` takes `'licensed-pathway' | 'mandatory-review'` and has no branch for
Tier C / `UNCLASSIFIED`, where no Track 1 attorney flow exists at all. Extending that union is Phase
4's job and depends on per-state UPL findings this phase has not done. Until then a package built in
an unreviewed state records `attorneyReview: null` **plus** the `legal-conclusions` not-determined
item. A null with an explanation is honest; an invented flow is not.

---

## 11. Output format

One package object, three renderers, no divergent content:

| form | purpose | notes |
|---|---|---|
| plain text | canonical; email body, paste into anything | precedent: `letters/letter.ts` — one shape, one renderer, versioned once |
| markdown | print / attach for the appraiser | same section order |
| JSON | the `ReferralPackage` itself | `parseReferralPackage` re-runs `assertPackageIntegrity` |

Section order, identical in all three:

1. Header — what this is and is not (§4.1)
2. Parcel identity
3. **What was NOT determined** (§6 — before the numbers, by rule)
4. Evidence tier and geometric basis
5. Encumbered area and its derivation
6. Land value and its measured error band
7. Temporary-easement addendum, if any
8. Records-request drafts, if any, each marked NOT SENT
9. Caveats and methodology, verbatim
10. Provenance and audit block — sources queried, dates, disclaimer version, package version

No PDF, no typesetting, no e-signature in this phase.

---

## 12. Test requirements

Repo convention: colocated `*.test.ts`, `vitest`, `describe`/`it`/`expect`, `@/` alias, and — per
`evidence-tier.test.ts` and `encumbrance-factors.test.ts` — tests that assert what is **deliberately
absent**, with a comment saying why. Fixtures live in the test files.

**12.1 The not-determined section cannot be omitted**
- a package built from the most minimal valid input still contains all four floor items;
- `@ts-expect-error` on `notDetermined: []` — the empty case does not typecheck;
- `assertPackageIntegrity` throws on a hand-built package whose section was emptied;
- all three renderers contain the heading and every floor item's `what` text;
- JSON round-trip: `parseReferralPackage(JSON.stringify(pkg))` succeeds, and a hand-edited JSON with
  the section stripped throws rather than parsing;
- **ordering**: in plain text and markdown, the index of the section heading is less than the index of
  the first `$` in the document. This encodes §6.3's ordering rule as a test rather than a comment.

**12.2 The package never claims to be an appraisal**
- the standing not-an-appraisal sentence is present in every rendered form;
- `FORBIDDEN_CLAIM_PATTERNS` matches nothing across a fixture set spanning: minimal package, full
  package with a land-value band, package with a temporary valuation, package with records requests;
- **positive control** — a doctored package with "this report is an appraisal of the easement" injected
  into a free-text field IS caught. Without this the scanner could be dead and every other test would
  still pass;
- **false-positive control** — `BEFORE_AND_AFTER_METHODOLOGY_NOTE`, `YELLOW_BOOK_4_6_5.citation` and
  the phrase "Uniform Appraisal Standards for Federal Land Acquisitions" do NOT trip the scanner.

**12.3 The rejected method does not reappear**
- source-text assertion: no handoff file imports `./calculator`, `./valuation-matrix`,
  `EasementValuationCalculator`, `resolveImpactPercentage` or `IMPACT_TIERS`;
- for every member of `EASEMENT_TYPES`, `lookupEncumbranceFactor` returns `unsourced` and the built
  package keeps the `encumbrance-factor` item;
- no numeric field of the package equals `encumberedArea × landValuePerSqFt` for a fixture chosen so
  that product is distinctive.

**12.4 Land value band**
- a `market-indexed` path yields `landValue: null` plus the `land-value` item, and `CalibrationError`
  is never swallowed into a substituted range;
- an unfit ZIP (`mayEmitEstimate` false) yields no figure;
- discordant reconciliation yields no lead figure;
- at coverage 95 the rendered output states the top is unbounded and contains no upper number;
- `describeCalibration`'s two limitation sentences appear verbatim.

**12.5 Temporary easement**
- a fee-derived rent source propagates `TemporaryEasementError` out of `applyObservedRent`;
- a perpetual easement plus a rent throws;
- missing term ⇒ no valuation, `temporary-term` item stands;
- `hypothetical: true` ⇒ `pkg.illustrative` true and the banner appears in all three renderers;
- land-class mismatch (NASS agricultural rent, residential parcel) is refused or hard-flagged; the
  test cites the 360× figure from `NASS_AGRICULTURAL_RENT`;
- after a successful valuation, all four floor items are still present.

**12.6 Records requests**
- an unsupported jurisdiction returns `unsupported` with an explanation, and its output contains no
  occurrence of `119.0711` or `Chapter 119` — the Florida statute never leaks into another state;
- the FL rule reproduces the Group A / Group B split and maps `ACQUIRED = "N/A"` to *unknown*, not to
  *no*;
- every generated request is `status: 'draft-not-sent'` and renders the NOT SENT banner;
- Item 1 (term) is present when Item 2 (compensation) is withheld or omitted — the severability split
  survives rendering;
- a rule with `severabilityArgument: null` does not assert the split.

**12.7 Compliance routing**
- `disclaimerVersion === CURRENT_DISCLAIMER.version`, and the rendered footer contains
  `CURRENT_DISCLAIMER.letterFooterText` exactly — no paraphrase;
- while `needsComplianceSignOff` is true, the not-reviewed-by-counsel line renders;
- an audit record is produced per rendered package and per records request, with the widened
  `letterType`;
- a Tier C / `UNCLASSIFIED` state yields `attorneyReview: null` plus the `legal-conclusions` item, and
  never a fabricated `AttorneyReviewDecision`.

---

## 13. Explicitly out of scope

- **Any permanent-easement dollar figure**, formula, encumbrance factor, factor table, default
  easement width, or percentage-of-fee anything.
- Populating `encumbrance-factors.ts`.
- Performing, simulating or approximating a before-and-after appraisal, a highest-and-best-use
  analysis, or a severance study.
- Back-testing the market-indexed path. That is what would be needed to widen `calibratedRange` beyond
  the ZIP-comparable path, and it is a research task, not a handoff task.
- Ordering or paying for an appraisal; matching users to specific appraisers or attorneys; any
  directory, marketplace, referral fee or fee split. Referral compensation is a licensing question in
  both professions and is not a UI problem.
- **Sending anything.** No email, no portal submission, no fax, no scheduled delivery. Drafts only,
  for the user to send.
- PDF generation, print typesetting, e-signature.
- Records-request rules for any jurisdiction beyond FL/FDOT. Each additional one needs its own
  statutory research into exemption scope and lapse conditions.
- Legal conclusions in states with no counsel-reviewed rule set (Phase 3), and extending the attorney
  review flow union to cover Tier C (Phase 4).
- A persistence layer for packages. The shape is designed to serialise cleanly so a store can be added
  later without reshaping it, matching how `SendAuditRecord` is framed.
- Title search, deed OCR, or interpretation of recorded-document text.
- Probability scores for easement existence. Not computable without recorded-easement ground truth —
  see `evidence-tier.ts`.

---

## 14. Friction in the existing code

Things that will make this harder than the scope suggests. Read before estimating.

1. **The rejected method is still the friendliest API in the valuation module.**
   `EasementValuationCalculator` and `resolveImpactPercentage` are exported from
   `src/lib/valuation/index.ts` and documented as live in that module's README, whose impact-tier
   table is a percentage-of-fee schedule. Anyone building a handoff by "reusing valuation" lands
   straight on strip valuation. Hence §7.2's import guard.
2. **The honest default package has no land value.** `calibratedRange` throws for anything but the
   ZIP-comparable path, and Orange County cannot index at all for want of a Prop 13 base year. So
   `landValue: null` is the majority path, not an edge case, and §6 is the bulk of a typical package
   rather than an appendix. Design the renderers for that shape first.
3. **Area provenance does not exist yet.** `ParcelEasement.areaSqFt` is a bare number and
   `EasementProvenance` describes the easement, not the measurement. §5.3 adds the missing type, and
   the FDOT case shows why they must be separate: strong area provenance, nil terms provenance.
4. **The audit record cannot describe this artefact** — closed `letterType` union, §10.2.
5. **The attorney-review flow has no Tier C representation**, and forces `'added'` for
   mandatory-review, §10.3.
6. **All disclaimer copy is placeholder** (`needsComplianceSignOff: true`) and this is the most
   exposed surface yet built.
7. **Owner identity is frequently unobtainable** from the primary parcel source (Gov Code §7928.205).
   A referral package about a parcel that cannot name its owner needs to say so.
8. **The land-class trap is prose, not a type.** `MarketRentRate` has no land-class field, so the
   documented 360× error is unenforceable without §8.2's wrapper.
9. **Environment.** Node has global `fetch`; Python is not installed. Anything that parses a PDF —
   NASS county rent publications, records-request responses — must be Node-side or manual. Note the
   documented extraction trap: `pdftotext -layout` offsets NASS county labels by three rows, worth a
   4.9× error on the Berks figure.
