# Spec — Phase 3: Multi-State Analysis Layer

**Status:** build brief, not yet implemented
**Written:** 2026-08-15
**Scope of this document:** the Phase 3 scope proposed in
[`phase-plan-3-4-5.md`](./phase-plan-3-4-5.md), detailed to buildable.
**Binding context:** [`development-strategy-v2.md`](./development-strategy-v2.md) (Tier A/B/C
discipline), `src/lib/analysis-layer/`, `src/config/state-tiers.ts`,
`src/lib/easements/easement-types.ts`.

---

## 0. What this spec is, and the one thing it must not become

This spec specifies a **container for reviewed legal content, and a gate that keeps unreviewed
content out of user-facing output**. It does not supply the content.

The tempting deliverable — a 50-state table of prescriptive periods, necessity standards and
recording-act types — is the deliverable this spec exists to prevent. `development-strategy-v2.md`
is explicit that the state matrix is "a hypothesis pending real counsel review per state," and that
"no state beyond CA should be enabled for Track 1 until that review is done." Easement doctrine is
state law, the differences are real rather than cosmetic, and a researcher's reading of a statute is
not a legal determination.

The repo already has the correct precedent and it should be copied literally.
`src/lib/valuation/encumbrance-factors.ts` ships a complete table in which almost every row is
`basis: { kind: 'unsourced' }`, and `lookupEncumbranceFactor` has **no `defaultFactor` parameter** —
an unsourced type reaches the user as an explicit gap rather than as a number. Commit `dfdb239`
("Add easement taxonomy and encumbrance factors; ship the table empty") and commit `daaad19`
("Replace invented rework cost with sourced regional construction data") are the standing norm.

**Phase 3 ships the state registry the same way: structurally complete, substantively empty, with a
resolver that has no default rule set.**

### 0.1 A live demonstration of why this gate is not ceremony

While writing this spec, Cal. Civ. Code §1214 was fetched from the official source (§5.3 below).
Its operative text is:

> "...void as against any subsequent purchaser or mortgagee of the same property... **in good faith
> and for a valuable consideration**, whose conveyance is **first duly recorded**..."

The summarisation step that read that page returned the classification **"race statute"**, reasoning
that "the protection depends solely on being the first to record." That conclusion is contradicted
by the words it had just quoted — a good-faith-and-value requirement is exactly what distinguishes
race-notice from race.

The error is instructive because it was not caused by missing the source. The source was fetched,
correct, and quoted verbatim in the same output as the wrong conclusion. **Reading a statute and
classifying its regime are different acts, and only the first is automatable.** This is why §3.1
requires the citation and the classification to be stored as separate fields with separate
provenance, and why the classification field may only be set by a recorded counsel review.

---

## 1. Goal and non-goals

**Goal.** Replace the single hardcoded California rule set with a state registry whose entries carry
(a) their own confidence rules, (b) the primary sources those rules rest on, and (c) a counsel review
record — such that a state with no review produces **no substantive conclusion**, and says so.

**Non-goals**, restated from the settled constraints so they are not re-litigated:

1. A defensible permanent-easement value ends at an appraiser. Uniform Appraisal Standards §4.6.5
   rejects percentage-of-fee, going rates and strip valuation. Phase 3 adds no valuation path.
2. Proximity is never an easement. The A/B/C evidence tier in `src/lib/easements/evidence-tier.ts`
   is the honest output; probability scores are not computable. Phase 3 does not upgrade a proximity
   finding on the strength of a state rule set.
3. Provenance drives confidence. `provenanceConfidence()` maps `proximity-inference` to `flagged`,
   never `inferred`. A reviewed state rule set does not change that mapping, and Phase 3 must not
   introduce a second path that does.

---

## 2. What Phase 3 inherits, and the six things that complicate it

An inventory of the code being generalised, and the specific frictions found in it. Each has a
required resolution.

### 2.1 Two different types are both called `EasementType`

| file | meaning | values |
|---|---|---|
| `src/lib/analysis-layer/ca-rule-set.ts` | **legal character** | `appurtenant`, `in-gross`, `prescriptive`, `unknown` |
| `src/lib/easements/easement-types.ts` | **physical taxonomy** | `utility-overhead`, `sewer`, `pipeline`, … (12) |

Both are re-exported from their barrels (`analysis-layer/index.ts`, `easements/index.ts`). A
multi-state rule set needs both axes at once — a *pipeline* easement (physical) that is *in gross*
(legal character) is an ordinary combination — so the collision stops being cosmetic.

**Required:** rename the analysis-layer type to `EasementLegalCharacter`; leave
`easements/easement-types.ts` untouched. This is a breaking rename across `ca-rule-set.ts`,
`analyze-easement.ts`, `index.ts` and their tests. Do it as the first commit of the phase, alone, so
it is reviewable.

### 2.2 Four A/B/C-shaped vocabularies already exist, and two of them are literally `A | B | C`

| type | file | values | means |
|---|---|---|---|
| `ConfidenceTier` | `analysis-layer/confidence-tiering.ts` | `clear` / `likely-with-caveat` / `flagged-ambiguous` | strength of a legal determination |
| `EvidenceTier` | `easements/evidence-tier.ts` | `A` / `B` / `C` | geometric relationship of infrastructure to the parcel |
| `StateTier` | `gating/state-tier-config.ts` | `A` / `B` / `C` / `UNCLASSIFIED` | UPL regime for Track 1 |
| `provenanceConfidence` return | `easements/easement-types.ts` | `verified` / `inferred` / `flagged` | where knowledge came from |

`EvidenceTier` and `StateTier` share the letters and mean unrelated things. Phase 3 introduces a
fifth axis — rule-set review status — and must not reuse letters.

**Required:** review status is a named discriminated union (§3.3), never letters. In prose and in
identifiers, always qualify: *evidence tier*, *UPL tier*, *confidence tier*. Never bare "tier".

### 2.3 `analyzeEasement` throws for a non-CA state; Phase 3 requires it to return `flagged`

Current behaviour:

```ts
if (state !== 'CA') throw new UnsupportedStateRuleSetError(...)
```

Throwing is not degrading. A thrown error forces every caller into a `try/catch` and produces no
user-facing tiered result, whereas the Phase 3 requirement is a `flagged-ambiguous` result the UI can
render through the existing three-state display.

**Required:** the missing/unreviewed-rule-set path returns a `flagged-ambiguous` `TieredResult`.
`UnsupportedStateRuleSetError` is **retained and narrowed** to genuine programmer error — a state
code that is not two ASCII letters. The existing test `throws for a state with no implemented rule
set` is replaced by an assertion that `TX` returns `flagged-ambiguous`. This is a deliberate
behaviour change and belongs in its own commit with the change stated in the message.

### 2.4 The only Tier A state in the compliance matrix has never been reviewed

`src/config/state-tiers.ts` sets CA to `tier: 'A'`, `track1RequiredFlow: 'licensed-pathway'`,
`lastReviewedDate: null`. `isTrack1Available()` branches on `track1RequiredFlow` alone, so
`lastReviewedDate` is **read by nothing**. The entry's own note says it "must be set once counsel
sign-off is actually recorded" — but nothing enforces that.

Phase 3 must not reproduce that shape. Two consequences:

- The review record is not an advisory field; it is the discriminant of the union the resolver
  returns (§4.1). An entry cannot be substantive without one, because the substantive branch does not
  exist without one.
- **Applied honestly, California's own rule set is `unreviewed` on day one of Phase 3**, and
  `analyzeEasement({ state: 'CA' })` degrades to `flagged-ambiguous` until a real review record is
  filed. That is the correct reading of the strategy doc, and this spec does not soften it. The CA
  entry is the reference implementation of the *structure*; it is not a state that has cleared the
  gate.

Whether `state-tiers.ts` should be gated the same way is a **Phase 4** question and is out of scope
(§8), but Phase 3 records the finding rather than stepping around it.

### 2.5 Rule ORDER is legal content, and the engine cannot supply a default

`classifyByRules` is first-match-wins. In `CA_DURATION_RULE_SET` the order does real work:
`ca-conflicting-duration-clauses` precedes both express-language rules, and `ca-express-term-limited`
precedes `ca-express-perpetual`. Reordering those two changes the output for a document containing
both. A state whose law resolves that conflict differently needs a different order, not a different
rule.

**Required:** the ordered array *is* reviewed content. The review record states whether it covered
the ordering, and a snapshot test pins the ordered id list per state (§7.6) so an order change cannot
land silently.

### 2.6 The fact and outcome vocabularies live inside the CA file

`EasementDurationFacts`, `DurationBasis` and `DurationDetermination` are declared in
`ca-rule-set.ts`. `DurationBasis` includes `perpetual-appurtenant-default` and `life-of-grantee`,
which are California doctrinal outcomes, not neutral vocabulary.

**Required:** hoist the state-neutral parts into a new `duration-facts.ts`, and let each state extend
the basis union with its own string-literal members rather than forcing every state through
California's list. A state must be able to say "this doctrine is not recognised here" without
inheriting a basis value that presumes it is.

---

## 3. The interface

New files, all under `src/lib/analysis-layer/`. **Schema files carry no legal content**, matching the
existing split where `confidence-tiering.ts` holds the engine and `ca-rule-set.ts` holds the rules.

```
state-rule-set.ts      schema + resolver. No legal content, no state data.
review-record.ts       counsel review record, staleness, digest. No legal content.
duration-facts.ts      state-neutral fact/outcome vocabulary hoisted from ca-rule-set.ts
state-registry.ts      the registry. One entry: CA. Every legal fact unreviewed.
rule-sets/ca.ts        CA reference implementation (moved from ca-rule-set.ts)
analyze-easement.ts    modified: resolves via the registry, degrades instead of throwing
```

### 3.1 A legal fact is a citation plus a classification, stored separately

The core type. It exists because of §0.1: the source and the conclusion drawn from it have different
provenance and must not share a field.

```ts
export interface PrimarySourceCitation {
  /** Formal citation, e.g. "Cal. Civ. Code §1104". */
  readonly label: string;
  /** Fetchable URL for the official text. Must resolve without authentication. */
  readonly url: string;
  /** ISO date the URL was fetched and read. */
  readonly fetchedOn: string;
  /** The operative words, verbatim. Not a paraphrase. */
  readonly quotedText: string;
}

export type StateLegalFact<T> =
  | {
      readonly status: 'unreviewed';
      /** May be present — a fetched source is useful evidence FOR the reviewer. */
      readonly citation: PrimarySourceCitation | null;
      /**
       * A researcher's provisional reading, for the reviewer's convenience ONLY.
       * NOTHING in the engine may read this field. It is not a value; it is a
       * note attached to a question. §7.4 is the test that enforces this.
       */
      readonly researcherReading: T | null;
      readonly note: string;
    }
  | {
      readonly status: 'counsel-confirmed';
      readonly citation: PrimarySourceCitation;
      readonly value: T;
      /** Which review record confirmed this specific field. */
      readonly confirmedByReviewId: string;
    };
```

`researcherReading` sits only on the branch the engine cannot reach, and `value` only on the branch
it can. This is the same trick as `lookupEncumbranceFactor`: the unsourced figure exists nowhere a
caller can pick it up by accident.

### 3.2 What every state entry MUST carry

```ts
export interface StateEasementRuleSet {
  /** Two-letter USPS code, uppercase. */
  readonly state: string;
  /** Bumped when this interface gains or changes a field. Re-gates prior reviews (§4.4). */
  readonly schemaVersion: number;
  readonly review: ReviewRecord | null;

  /** Statutory period for a prescriptive easement, in years. */
  readonly prescriptivePeriodYears: StateLegalFact<number>;

  /** Implied easement from prior use ("quasi-easement"). */
  readonly impliedFromPriorUse: StateLegalFact<{
    readonly recognised: boolean;
    readonly necessityStandard: 'strict' | 'reasonable';
  }>;

  /** Easement by necessity — a distinct doctrine. Do NOT merge with the above. */
  readonly easementByNecessity: StateLegalFact<{
    readonly recognised: boolean;
    readonly necessityStandard: 'strict' | 'reasonable';
  }>;

  /** Recording-act regime. See §0.1 — this field is why the type is shaped this way. */
  readonly recordingAct: StateLegalFact<'race' | 'notice' | 'race-notice'>;

  /** Marketable-title / ancient-interest cutoff, where it bears on easement survival. */
  readonly marketableTitle: StateLegalFact<{
    readonly actExists: boolean;
    readonly rootOfTitleYears: number | null;
    /** Whether easements are excepted from extinguishment. Usually decisive, usually nuanced. */
    readonly easementsExcepted: boolean;
  }>;

  /** Ordered. The ORDER is reviewed content — see §2.5. */
  readonly durationRules: ReadonlyArray<
    ConfidenceRule<EasementDurationFacts, DurationDetermination>
  >;
  readonly durationFallback: FlaggedFallback<DurationDetermination>;
}
```

Rules for entries:

- **Every rule id is prefixed with the lowercase state code** (`ca-express-perpetual`), and ids are
  unique across the whole registry, because the audit trail records a bare rule id.
- **Every `counsel-confirmed` fact carries a citation whose `quotedText` is verbatim.** A paraphrase
  is a summary, and §0.1 is what summaries do.
- **A citation URL must be an official primary source** — a state legislature or code-publisher
  domain. Not a law-firm article, not a treatise summary, not a secondary aggregator. Where only a
  secondary source exists, the fact stays `unreviewed` and the note says so.
- **A doctrine that is not recognised is stated as `recognised: false`, never omitted.** Absence of a
  field and a finding of non-recognition are different claims — the same distinction
  `unclassifiedState()` already draws between UNCLASSIFIED and Tier C.

### 3.3 What a state entry MUST NOT assert without review

An entry with no `ReviewRecord` covering a field must not:

- carry `status: 'counsel-confirmed'` on that field, under any circumstance;
- contribute a rule that can return `clear` or `likely-with-caveat`;
- assert that a doctrine is or is not recognised in that state;
- assert a recording-act classification (the §0.1 failure mode);
- assert that an interest has expired, survived, been extinguished, or runs with the land;
- assert a prescriptive period, **even where a statute stating a number of years has been fetched** —
  fetching CCP §321 establishes that a five-year adverse-possession period appears in that section;
  it does not establish that this section supplies the period for a prescriptive *easement*, which is
  exactly the chain a reviewer confirms and a fetch cannot;
- present a rule ordering as settled priority.

An unreviewed entry MAY carry: fetched citations, `researcherReading` values, notes, and a
`durationFallback`. That is the entire permitted payload.

### 3.4 CA as the reference implementation

`rule-sets/ca.ts` is the existing `CA_DURATION_RULE_SET`, moved, with `EasementType` renamed to
`EasementLegalCharacter`, plus the four legal-fact fields populated in the `unreviewed` shape using
the citations verified in §5.3. Its rules are unchanged — the existing `ca-rule-set.test.ts` cases
must still pass against the moved array (§7.7).

CA is the reference for the *shape*: the worked example a second state is written against. It is not
a reviewed state (§2.4), and the file header must say so as plainly as the current one does.

### 3.5 Review record and staleness

```ts
export interface ReviewRecord {
  /** Stable id, referenced by StateLegalFact.confirmedByReviewId and by audit records. */
  readonly id: string;
  readonly state: string;
  /** Reviewing counsel, and their licensure in THIS state. */
  readonly reviewedBy: string;
  readonly barNumber: string;
  readonly barJurisdiction: string;
  readonly reviewedOn: string;   // ISO date
  readonly expiresOn: string;    // ISO date, explicit — not derived at read time
  /** Which fields this review actually covers. A partial review is normal and must be expressible. */
  readonly coversFields: readonly string[];
  /** Whether the review covered the ORDER of durationRules, not just their content (§2.5). */
  readonly coversRuleOrder: boolean;
  /** schemaVersion at review time. */
  readonly reviewedSchemaVersion: number;
  /** Digest over every citation reviewed; recomputed at load (§4.4). */
  readonly citationsDigest: string;
  readonly notes?: string;
}

/**
 * Maximum review age. THIS IS A STATED CONVENTION, NOT A MEASUREMENT — the
 * same posture as BOUNDARY_STRIP_FT in evidence-tier.ts. 24 months is chosen
 * because it is short enough that a legislative session cannot pass unnoticed
 * and long enough to be affordable. Argue with it here; do not bury it.
 */
export const REVIEW_MAX_AGE_MONTHS = 24;
```

`expiresOn` is stored rather than computed so a reviewer can set a shorter expiry on a state they
consider unstable. The constant is the ceiling applied when an entry omits one.

---

## 4. The counsel-review gate

### 4.1 Resolution returns a union with no default branch

```ts
export type RuleSetResolution =
  | {
      readonly status: 'available';
      readonly ruleSet: StateEasementRuleSet;
      readonly review: ReviewRecord;
    }
  | {
      readonly status: 'unavailable';
      readonly state: string;
      readonly reason:
        | 'no-rule-set'          // state absent from the registry
        | 'never-reviewed'       // entry exists, review is null
        | 'review-expired'       // expiresOn past, or older than REVIEW_MAX_AGE_MONTHS
        | 'schema-superseded'    // reviewedSchemaVersion < current schemaVersion
        | 'citations-changed';   // citationsDigest mismatch
      readonly explanation: string;
    };

export function resolveStateRuleSet(stateCode: string): RuleSetResolution;
```

Note the signature: **one parameter.** No `defaultRuleSet`, no `fallbackState`, no `allowUnreviewed`
flag. This mirrors `lookupEncumbranceFactor(type)` exactly, and §7.3 asserts the arity so the
parameter cannot be added later without a failing test.

The five `unavailable` reasons stay distinct even though they gate identically, for the same reason
`unclassifiedState()` distinguishes UNCLASSIFIED from Tier C: "we have not reviewed this" and "this
review has gone stale" are different statements about the world, and the audit trail needs both.

### 4.2 How an unreviewed state degrades

`analyzeEasement` becomes:

```ts
export interface EasementAnalysisResult {
  readonly state: string;
  readonly ruleSet: RuleSetResolution;
  readonly duration: TieredResult<DurationDetermination>;
}
```

- `status: 'available'` → run `classifyByRules(facts, ruleSet.durationRules, ruleSet.durationFallback)`
  exactly as today.
- `status: 'unavailable'` → return, **without evaluating any rule**:

```ts
{
  tier: 'flagged-ambiguous',
  ruleId: 'state-rule-set-unavailable',
  flagReason:
    `Easement duration is governed by ${state} law, and this product has no counsel-reviewed ` +
    `rule set for ${state} (${reason}). No determination is offered. This is an absence of ` +
    `review, not a finding that the easement itself is ambiguous.`,
}
```

Three properties of that output are load-bearing and are tested in §7:

1. **The rules are not evaluated at all** — not evaluated and discarded, not reached. A rule set that
   cannot be trusted to produce a conclusion cannot be trusted to produce a *flag reason* either, and
   evaluating it invites a later refactor to start using the result.
2. **The result object has no `value` key.** The `flagged-ambiguous` member of `TieredResult` already
   lacks one; the test asserts `'value' in result === false` rather than `result.value === undefined`,
   so a widened type cannot slip a value through.
3. **The flag reason distinguishes absence-of-review from substantive ambiguity.** A user whose
   document is genuinely contradictory and a user in an unreviewed state otherwise see the same
   confidence tier, so the copy is part of the contract. The distinct `ruleId` is what the UI and the
   audit trail branch on.

### 4.3 How a review is recorded

Reviewing counsel returns, and this repo stores, a `ReviewRecord` in the state's rule-set file
alongside the entry it covers — not in a database, not in an environment variable. The review is
source: it is diffable, and it is reviewable in a pull request. Recording a review is therefore a
commit, and the commit message states who reviewed, when, and which fields.

A review is applied in one commit that:

1. adds the `ReviewRecord`, with `coversFields` naming exactly the fields reviewed;
2. flips **only those fields** from `unreviewed` to `counsel-confirmed`, each with its citation and
   `confirmedByReviewId`;
3. computes and stores `citationsDigest` over the reviewed citations;
4. sets `reviewedSchemaVersion` to the current `schemaVersion`.

A **partial review is a first-class outcome.** Counsel may confirm the prescriptive period and
decline to opine on marketable title. `coversFields` expresses that, and a field outside
`coversFields` stays `unreviewed` even though the state has a review record. A state can therefore be
`available` for its duration rules while individual doctrinal fields remain unusable — so consumers
must check the field, not just the state.

### 4.4 How review staleness re-gates a state

Five independent triggers, all evaluated in `resolveStateRuleSet`, all producing `unavailable`:

| trigger | mechanism | reason emitted |
|---|---|---|
| Time | `expiresOn` in the past, or `reviewedOn` older than `REVIEW_MAX_AGE_MONTHS` | `review-expired` |
| Schema growth | `reviewedSchemaVersion < schemaVersion` — the review did not cover fields that did not exist yet | `schema-superseded` |
| Source drift | recomputed `citationsDigest` ≠ stored digest | `citations-changed` |
| Manual | a maintainer deletes the record on a known law change | `never-reviewed` |
| Absence | state not in the registry | `no-rule-set` |

The **citations digest** is the mechanism with teeth. Digest the sorted tuples of
`(label, url, quotedText)` for every `counsel-confirmed` field. Re-fetching a statute after an
amendment changes `quotedText`, which changes the digest, which re-gates the state automatically — a
reviewed state cannot silently outlive the text it was reviewed against. Use `node:crypto`
`createHash('sha256')`; Node has it, and this repo has no Python.

Re-fetching is a maintenance job, not part of `resolveStateRuleSet` — the resolver stays synchronous
and pure, and must never make a network call in a request path. Specify a script,
`scripts/check-citations.ts`, run manually or on a schedule, that fetches every citation URL with
global `fetch`, compares `quotedText` against the live page, and fails loudly. It does **not**
auto-update the stored text: an amended statute needs a lawyer, not a `git commit -am`.

### 4.5 The analysis registry and the UPL matrix are separate gates and must not be merged

`src/config/state-tiers.ts` answers *"may this product prepare a document for a fee in this state?"*
— a licensing question. The Phase 3 registry answers *"does this product know this state's easement
law well enough to state a conclusion?"* — a substantive-law question. They are reviewed by different
counsel, expire independently, and neither implies the other.

All four combinations occur and all must be representable:

| UPL tier | rule set | product behaviour |
|---|---|---|
| A (Track 1 available) | reviewed | full Track 1 with substantive analysis |
| A | unreviewed | Track 1 available; duration field `flagged`, so `gateWizardField` blocks it per-field |
| C / UNCLASSIFIED | reviewed | no Track 1; Track 2/3 carry a substantive analysis. **This is the Texas case (§6)** |
| C / UNCLASSIFIED | unreviewed | Track 2/3 with flagged analysis — today's nationwide default |

Row 2 is the one the current code assumes away. `build-advocacy-wizard-state.ts` states in its own
header: *"Assumes analysis-layer has a rule set for any state this wizard makes available."* Once
CA's rule set is `unreviewed` (§2.4), that assumption is false for California itself on day one. The
existing `gateWizardField` already blocks a `flagged-ambiguous` field, so the wizard degrades
correctly — but the comment is now wrong, and the behaviour must be covered by a test (§7.8).

**Do not add rule-set fields to `StateComplianceEntry`.** Two matrices, two review lifecycles.

### 4.6 Audit trail

`src/lib/compliance/audit-record.ts` already records the compliance basis at generation time. Extend
it with the analysis-layer counterpart: the resolved `status`, the `reason` when unavailable, the
`ReviewRecord.id` and `reviewedOn` when available, and the `ruleId` that fired. If a state's review
later expires or its statute is amended, it must remain answerable what was true when a specific
letter went out — the same requirement the strategy doc already states for UPL tiers.

---

## 5. Sourcing discipline

### 5.1 The bar

Any legal specific appearing anywhere in Phase 3 — code, comment, doc or test fixture — must carry a
**fetchable primary source**: an official state legislature or code-publisher URL, the date it was
fetched, and the operative words verbatim. Same bar as `encumbrance-factors.ts`, which cites IRWA
2001, TTI 0-7053-R1 and UASFLA §4.6.5 with retrieval dates and direct quotes.

And one bar higher, because these are legal specifics: **a fetched citation is evidence for a
reviewer, never a substitute for one.** Every citation below is marked accordingly.

### 5.2 What a citation does not establish

Restating §0.1 and §3.3 as a rule the implementer can apply. Fetching a statute establishes that
*those words appear in that section on that date*. It does not establish which section governs a
given doctrine, how courts have construed it, whether a later section excepts it, or how it interacts
with another state's rule. Each of those is a counsel question.

### 5.3 CA citations — fetched and verified 2026-08-15, ALL PENDING COUNSEL CONFIRMATION

These populate the `citation` field of CA's four `unreviewed` legal facts. All four URLs were fetched
from `leginfo.legislature.ca.gov`, the official California legislative source, on 2026-08-15, and
returned the quoted text.

| field | citation | verbatim operative text | why this is NOT yet a determination |
|---|---|---|---|
| `prescriptivePeriodYears` | Cal. Code Civ. Proc. §321 — `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=321` | "the property has been held and possessed adversely to such legal title, **for five years** before the commencement of the action" | Establishes a five-year adverse-possession period in §321. Does **not** establish that §321 — rather than §318, §319 or §325 — supplies the period for a prescriptive *easement*, nor what elements must run for it. Counsel must confirm the operative section and the elements. |
| `impliedFromPriorUse` | Cal. Civ. Code §1104 — `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1104` | "A transfer of real property passes all easements attached thereto, and creates in favor thereof an easement to use other real property… in the same manner and to the same extent as such property was **obviously and permanently used**… at the time when the transfer was agreed upon or completed" | The statute states a standard of *obvious and permanent use* and is silent on the word "necessity". Whether CA's necessity standard for this doctrine is strict or reasonable is **not on the face of the statute** and must not be inferred from it. Counsel must supply the standard. |
| `recordingAct` | Cal. Civ. Code §1214 — `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1214` | "void as against any subsequent purchaser or mortgagee… **in good faith and for a valuable consideration**, whose conveyance is **first duly recorded**" | Both a good-faith-and-value element and a first-to-record element appear. This is precisely the field that was got wrong on first reading (§0.1). Leave `unreviewed`; do **not** write `'race-notice'` into the value field on the strength of this spec. |
| `marketableTitle` | Cal. Civ. Code §880.020 — `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=880.020` | "Real property is a basic resource of the people of the state and should be made freely alienable and marketable to the extent practicable" | Confirms California has a Marketable Record Title Act and states its policy. Says nothing about the root-of-title period or — decisively for this product — whether easements are excepted from extinguishment. Those live in other sections of the article that were **not fetched**, and no value may be written for them here. |

`easementByNecessity` has **no citation** and ships `citation: null, researcherReading: null`. That is
the correct state for a doctrine no source has been fetched for, and the registry must be able to
express it.

---

## 6. Sequencing — which states to add first

The rule from the phase plan: **sequence by where Phase 2 already has data, not by population.**
Stated as a negative because the failure mode is specific — ranking by population puts NY, IL and PA
at the top, and Phase 2 has one recorder-index route in IL, none in NY, and a single county in PA
that happens to be excellent. Population predicts nothing about whether a rule set can be exercised
against a real parcel.

Phase 2's actual substrate, from `src/lib/jurisdiction/county-database.ts` (12 routes: 3 immediate, 8
standard, 1 fallback) plus the findings in
[`open-data-source-assessment.md`](./open-data-source-assessment.md) and the Berks and FDOT work:

| state | county routes | valued parcels | recorded easements | verdict |
|---|---|---|---|---|
| CA | 7 (LA, Orange, San Diego immediate; Riverside, San Bernardino, SF standard; Santa Clara fallback) | 3 live assessor providers | Orange only — 517 polygons, institutional | reference |
| FL | 0 | Clay Co. (Green Cove Springs) `MktLandVal`; just value assessed annually | Clay Co. utility/drainage, 125 polygons; 27 orgs found publishing both; FDOT ROW sweep of 1,558 services | **first** |
| PA | 0 | Berks — 156,928 parcels with `VALULNDMKT` | Berks — 215 typed with `DOE_BOOK`/`DOE_PAGE`/`HOLD_ORG`, plus 1,692 ag conservation | **second** |
| TX | 2 (Dallas, Harris) | none wired | none found | **third** |
| KS / WA | 0 | none — Lawrence and Douglas Co. publish zero value fields | Lawrence 14,397 with `WIDTH`; Lynden typed with `FEET` | fixtures only |
| IL / NV / GA | 1 each (Cook, Clark, Fulton) | none | none | defer |

**Recommended order: CA (reference) → FL → PA → TX.**

**FL first.** It has the only jurisdictions found that publish recorded easements *and* valued parcels
in the same ArcGIS org — the constraint `open-data-source-assessment.md` calls "the single most
important constraint on the product's coverage." Florida assesses at just value annually, so a rule
set can be exercised end to end with none of the Proposition 13 vintage machinery built for
California. Phase 2 also already produced Florida-specific statutory work: the FDOT D7 records
request turns on the public-records exemption at Fla. Stat. §119.0711, so the jurisdiction-specific
records path is partly mapped. Florida has **zero entries in the county database** — that gap is a
Phase 2 strand-3 item, and Phase 3 surfacing it is a feature of this ordering, not an objection to it.

**PA second.** Berks County is the only jurisdiction in this repo where every input the
temporary-easement method needs is observed in one place: typed general easements with book, page and
holding organisation; 156,928 valued parcels; and a NASS county cash rent for the matching land
class. It is the best available integration test for a non-CA rule set, and the only place the
analysis layer and the one working valuation path can be exercised on the same parcel.

**TX third, and it is the instructive case.** Texas has the most non-CA county coverage in Phase 2
(Dallas and Harris) and is listed as a **Tier C hypothesis** in the UPL matrix. Those facts do not
conflict, because §4.5 separates the gates: a reviewed Texas rule set makes Track 2 and Track 3
substantively better in the state with the second-most recorder coverage, while Track 1 stays
unavailable. Adding TX is the concrete demonstration that the analysis registry is not a Track 1
allowlist.

**KS and WA are test fixtures, not coverage.** Lawrence KS and Lynden WA publish plat-derived
easements with widths and no assessed values at all, and neither state has a county route. They are
where geometry-side rule-set behaviour can be exercised. They should not become reviewed states.

**IL, NV and GA wait.** One recorder-index route each, no parcel API, no easement layer. A reviewed
rule set there would have nothing to run against until Phase 2 strand 3 closes.

Note also: the phase plan states the county matrix is at 13 counties (4 immediate); the code has 12
routes (3 immediate). Reconcile before relying on either count.

---

## 7. Test requirements

Vitest, colocated `*.test.ts`, matching existing convention. The central requirement, per the phase
plan: **assertions that unreviewed states produce NO substantive conclusion.**

### 7.1 Exhaustive: no unreviewed state produces a substantive tier, for any facts

The headline test. Build the full cartesian product of `EasementDurationFacts` — 4 legal characters ×
2 × 2 × 2 booleans = 32 fact combinations — and cross it with every USPS state code plus DC that is
not in the registry. For each pair assert:

- `result.duration.tier === 'flagged-ambiguous'`;
- `result.duration.tier !== 'clear'` and `!== 'likely-with-caveat'`, stated separately so a failure
  message names which one leaked;
- `result.ruleSet.status === 'unavailable'`.

Exhaustive rather than sampled, because the property is universal, the space is ~1,600 cases, and a
sampled version would pass while a single fact combination leaked.

### 7.2 The flagged result carries no value, and no rule fired

- `'value' in result.duration === false` — key absence, not `undefined`, so a widened type cannot slip
  a value through.
- `result.duration.ruleId === 'state-rule-set-unavailable'`, and it matches no id in any registered
  rule set — proving no state rule was evaluated.
- Instrument the CA rule set with a spy in one test and assert `evaluate` was **never called** when
  the state resolves `unavailable` (§4.2 property 1).
- `flagReason` contains the state code and the language distinguishing absence of review from
  ambiguity; assert it does **not** match `/ambiguous|conflicting|illegible/i`, which are the
  substantive flag reasons.

### 7.3 The resolver has no default

- `resolveStateRuleSet.length === 1` — an added `defaultRuleSet` or `allowUnreviewed` parameter fails
  immediately. Mirrors the no-`defaultFactor` design of `lookupEncumbranceFactor`.
- No exported symbol in `analysis-layer` matches `/default.*rule.?set|fallback.*state/i`.

### 7.4 `researcherReading` never escapes the registry

- Source-level: read every file under `src/lib/analysis-layer/` and assert `researcherReading` appears
  only in `state-rule-set.ts` (the type) and `rule-sets/*.ts` (the data). Any occurrence in
  `analyze-easement.ts` or the resolver fails the test.
- Type-level: a `@ts-expect-error` case confirming the field is unreachable on the
  `counsel-confirmed` branch.

### 7.5 Each staleness trigger re-gates, with its own reason

One test per trigger, each against a fixture rule set that is otherwise fully reviewed:
`review-expired` (expiry yesterday); `review-expired` (`reviewedOn` older than
`REVIEW_MAX_AGE_MONTHS` with no explicit expiry); `schema-superseded` (`reviewedSchemaVersion`
behind); `citations-changed` (mutated `quotedText`); `never-reviewed` (record removed). Each asserts
`status === 'unavailable'`, the correct `reason`, and — critically — the **same**
`flagged-ambiguous` duration output as an unregistered state. Gating must not vary by reason.

Plus: a review covering only some fields leaves the uncovered fields `unreviewed` (§4.3), and a field
outside `coversFields` cannot be `counsel-confirmed` — assert this as a registry invariant so a
hand-edited entry fails CI.

### 7.6 Registry structural invariants

Iterate every registered state and assert:

- rule ids are unique across the whole registry, and each is prefixed with its lowercase state code;
- every `counsel-confirmed` fact has a citation with an `https:` URL, an ISO `fetchedOn`, and
  non-empty `quotedText`;
- no `counsel-confirmed` fact exists without a `ReviewRecord` whose `coversFields` names it;
- `durationFallback.tier === 'flagged-ambiguous'` for every state — no state may fall back to a
  conclusion;
- **snapshot the ordered rule-id list per state**, because ordering is legal content (§2.5) and a
  reorder must break a test rather than quietly change an output.

### 7.7 CA regression, and the honest CA consequence

- Every existing case in `ca-rule-set.test.ts` passes unchanged against the moved rule array (renames
  aside), asserted by calling `classifyByRules` directly with the CA rules — proving the refactor
  moved code without changing behaviour.
- `analyzeEasement({ state: 'CA', … })` returns `flagged-ambiguous` while CA has no review record.
  This test reads as a regression to anyone who has not read §2.4, so its name must say otherwise —
  e.g. `'CA degrades to flagged until a counsel review record exists — this is the gate working, not
  a bug'`.
- A fixture review record exercises the `available` path, so the substantive branch is covered without
  any real state being marked reviewed in the shipped registry.

### 7.8 Cross-layer non-conflation

- A state that is UPL Tier A with an unreviewed rule set: `buildAdvocacyWizardState` returns
  `access.available === true` and a duration field blocked by `gateWizardField`. Covers §4.5 row 2 and
  the now-false comment in `build-advocacy-wizard-state.ts`.
- A state that is UPL UNCLASSIFIED with a reviewed rule set: Track 1 unavailable, analysis
  substantive. Covers row 3 — the Texas case.
- Assert no module imports `STATE_COMPLIANCE_MATRIX` into the analysis layer, or the reverse.

### 7.9 Provenance and evidence tiers are unaffected

Regression guards on the settled constraints: a reviewed rule set does not change
`provenanceConfidence('proximity-inference') === 'flagged'`, does not raise an `EvidenceTier`, and
adds no numeric probability anywhere in the result. Assert the analysis result object contains no key
matching `/probability|likelihood|percent|score/i`.

---

## 8. Explicitly out of scope

- **A 50-state table of prescriptive periods, necessity standards or recording-act types.** The
  deliverable is the registry and the gate; content arrives one reviewed state at a time. This is the
  point of the phase, not a limitation of it.
- **Any legal classification without counsel review**, including classifications a fetched statute
  appears to support (§0.1).
- **Setting CA's four legal facts to `counsel-confirmed`.** The sources in §5.3 are evidence for a
  reviewer. Nothing in this spec authorises promoting them.
- **Probability scores, likelihood percentages, or any numeric confidence.** Settled constraint 2.
- **Any permanent-easement dollar value.** Settled constraint 1; UASFLA §4.6.5 forecloses it.
- **Upgrading a proximity finding.** Settled constraint 3; `provenanceConfidence` is unchanged.
- **Track 1 expansion, UPL classification of any state, and gating `state-tiers.ts` on
  `lastReviewedDate`.** Phase 4. §2.4 records the finding; fixing it is not Phase 3's mandate.
- **Automated extraction of legal content** — statute scraping, LLM-generated rule sets, or any
  pipeline that writes a `counsel-confirmed` value without a human review commit. §4.4's citation
  checker detects drift and deliberately refuses to fix it.
- **Case law, local ordinances, HOA instruments, tribal land and federal land.** Statutory fields only.
- **Applying the recording act to a specific chain of title.** That is title examination.
- **Non-easement encumbrances** — CC&Rs, liens, mineral and water rights.
- **UI work.** The existing three-state display already renders `flagged-ambiguous`; Phase 3 adds no
  screen.
- **Closing Phase 2 strand 3** (generic recorder fallback outside LA). §6 exposes the gap for FL and
  PA; filling it is Phase 2 work.
- **Adding FL/PA/TX county routes.** Sequencing names them; the integrations are separate work.

---

## 9. Deliverables

| # | deliverable | acceptance |
|---|---|---|
| 1 | Rename `EasementType` → `EasementLegalCharacter` in `analysis-layer` | own commit; typecheck clean; `easements/easement-types.ts` untouched |
| 2 | `duration-facts.ts` — state-neutral fact/outcome vocabulary hoisted out of `ca-rule-set.ts` | CA rules import it; no CA doctrine left in the shared module |
| 3 | `state-rule-set.ts` — `PrimarySourceCitation`, `StateLegalFact`, `StateEasementRuleSet`, `RuleSetResolution`, `resolveStateRuleSet` | zero legal content in the file; `resolveStateRuleSet.length === 1` |
| 4 | `review-record.ts` — `ReviewRecord`, `REVIEW_MAX_AGE_MONTHS`, staleness and digest logic | all five triggers covered by §7.5 |
| 5 | `state-registry.ts` — one entry, CA, every legal fact `unreviewed` | §7.6 invariants pass |
| 6 | `rule-sets/ca.ts` — rules moved verbatim + §5.3 citations in `unreviewed` shape | §7.7 regression passes |
| 7 | `analyze-easement.ts` — degrade instead of throw; `UnsupportedStateRuleSetError` narrowed to malformed state codes | own commit stating the behaviour change; §7.1 and §7.2 pass |
| 8 | `audit-record.ts` extension — resolution status, reason, review id, rule id | §4.6 |
| 9 | `scripts/check-citations.ts` — refetch and compare, fail loudly, never auto-write | Node global `fetch`; no Python in this repo |
| 10 | Test suites per §7 | full suite green; the existing 430 tests still pass |

Every commit follows the repo norm: state what was measured or sourced, cite it, and say what remains
unknown.
