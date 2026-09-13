/**
 * The referral package: what this product hands to a licensed appraiser or
 * attorney.
 *
 * WHY THIS IS THE TERMINAL ARTEFACT. Phase 2 research established that a
 * defensible permanent-easement value cannot be computed from data — Uniform
 * Appraisal Standards §4.6.5 rejects percentage-of-fee, customary going rates,
 * AND strip valuation. That is the answer rather than a gap to engineer
 * around, so the honest end state of the product is a well-prepared handoff.
 * `attorney-review.ts` already flags that review is needed; nothing produced
 * the package until now.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT IMPORT. Nothing from `calculator.ts`
 * or `valuation-matrix.ts`. Those remain exported from the valuation barrel
 * and are the most inviting API in the directory — `EasementValuationCalculator`
 * computes exactly `area × unit value × impact %`, which is the strip
 * valuation §4.6.5 names and rejects, off a percentage-of-fee matrix that
 * contradicts the deliberately-empty `encumbrance-factors.ts`. A source-text
 * test asserts this module never imports them, because a comment will not
 * survive a well-meaning refactor.
 */

import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import { legalReviewDisclosure } from '@/lib/compliance/legal-review-disclosure';
import type { AttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import {
  BEFORE_AND_AFTER_METHODOLOGY_NOTE,
  YELLOW_BOOK_4_6_5,
} from '@/lib/valuation/encumbrance-factors';
import { describeCalibration, type CalibratedRange } from '@/lib/valuation/calibrated-range';
import type { Reconciliation } from '@/lib/valuation/reconcile-paths';
import type { TierAssessment } from '@/lib/easements/evidence-tier';
import { provenanceConfidence, type EasementProvenance } from '@/lib/easements/easement-types';
import { buildNotDetermined, hasFloorItems, type NotDeterminedSection } from './not-determined';
import type { EncumberedAreaSection } from './area-derivation';
// Type-only, so the cycle with rent-intake.ts is erased at compile time and no
// runtime import exists. The alternative — declaring the section here — would
// put the temporary-easement vocabulary in the module that must never value
// anything itself.
import type { TemporaryEasementSection } from './rent-intake';
import { explainClaimScan, scanForAppraisalClaims } from './appraisal-claim-scan';

export const PACKAGE_VERSION = '1.0.0';

/**
 * Rendered first in every form. One string in one place, matching the
 * discipline `disclaimer-copy.ts` states for disclaimers — reused verbatim,
 * never re-paraphrased per surface.
 */
export const STANDING_HEADER =
  'This is a screening package prepared from public parcel, assessment and infrastructure records. ' +
  'It reports what those sources say and how each figure was derived. ' +
  'IT OFFERS NO OPINION OF MARKET VALUE FOR ANY PERMANENT EASEMENT, and that is a deliberate ' +
  'limit rather than an omission: the controlling federal standard measures such an easement as the ' +
  'whole tract before it minus the remainder after it, and rejects percentage-of-fee methods, ' +
  'customary going rates, and valuing the encumbered strip on its own. ' +
  `${YELLOW_BOOK_4_6_5.citation} ` +
  'That correct measure requires a highest-and-best-use analysis of this specific property, which ' +
  'comes from a licensed appraiser and not from any dataset. ' +
  // The exact wording carries a requirement. REQUIRED_DISCLAIMER_PHRASE is the
  // literal string "is not an appraisal", and the scan fails when it is absent
  // — saying nothing is not neutral, because a reader who is not told will
  // assume. The previous wording, "Nothing here is an appraisal", disclaims the
  // same thing to a human and does not contain the phrase, so no rendered
  // package would have passed its own scan. Phrased this way it satisfies the
  // affirmative while the negation lookahead on the first forbidden pattern
  // keeps it from reading as a claim.
  'This package is not an appraisal, a legal determination, or legal advice.';

export interface ParcelIdentity {
  readonly parcelId: string;
  readonly county: string;
  readonly state: string;
  readonly fipsCode: string | null;
  readonly routingTier: 'immediate' | 'standard' | 'fallback';
  readonly situsAddress: string | null;
  /** Frequently unavailable — see the owner-identity not-determined item. */
  readonly ownerName: string | null;
  readonly geometrySource: string | null;
  readonly sourceVerifiedOn: string | null;
  /**
   * Assessor land-use classification, when the county publishes one.
   *
   * Nullable and required rather than optional, because the temporary-easement
   * path compares it against the land class a rent was observed for, and an
   * unrecorded class is exactly where an agricultural rate slips onto a
   * residential lot — a 360x error. A caller must decide what to put here.
   */
  readonly landClass: string | null;
  readonly landClassSource: string | null;
}

export interface EvidenceSection {
  readonly findings: readonly TierAssessment[];
  /** From summariseTiers(), carrying the recorded-vs-inferred distinction. */
  readonly summary: string;
  readonly fromRecordedEasements: boolean;
  /** Shown ALONGSIDE the tier: tier A with proximity provenance is still flagged. */
  readonly provenanceConfidence: 'verified' | 'inferred' | 'flagged';
  /** Finding nothing means nothing was found in the layers queried. */
  readonly negativeResultCaveat: string;
}

export interface LandValueSection {
  readonly reconciliation: Reconciliation;
  /** Verbatim describeCalibration(), naming the two systematic biases. */
  readonly calibrationNote: string;
  /** True when no finite upper bound exists at this coverage. */
  readonly upperBoundUnbounded: boolean;
  /** Always states this is land value for the PARCEL, not an easement value. */
  readonly whatThisFigureIs: string;
}

export interface Caveat {
  readonly text: string;
  /** Where the text came from, so a reader can trace it. */
  readonly sourceSymbol: string;
}

export interface ReferralPackage {
  readonly packageVersion: string;
  readonly generatedAt: string;
  readonly disclaimerVersion: string;
  readonly disclaimerNeedsSignOff: boolean;
  readonly whatThisIs: string;
  readonly parcel: ParcelIdentity;
  readonly evidence: EvidenceSection;
  readonly encumberedArea: EncumberedAreaSection | null;
  /** null is the MAJORITY state, not a failure — see buildLandValueSection. */
  readonly landValue: LandValueSection | null;
  readonly caveats: readonly Caveat[];
  /**
   * The one valuation this product may perform, and only via
   * `applyObservedRent`. Null until an appraiser supplies an observed rent —
   * there is no parameter on `buildReferralPackage` that sets it, because the
   * rate cannot come from any dataset this product reads.
   */
  readonly temporary: TemporaryEasementSection | null;
  readonly notDetermined: NotDeterminedSection;
  readonly attorneyReview: AttorneyReviewDecision | null;
  /** True when any figure rests on a hypothetical input. */
  readonly illustrative: boolean;
}

export class ReferralPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferralPackageError';
  }
}

const NEGATIVE_RESULT_CAVEAT =
  'A negative result is weak evidence. Finding no infrastructure means none was found IN THE ' +
  'LAYERS QUERIED, and those layers are incomplete — sewer, water and telecom coverage is ' +
  'inconsistent between jurisdictions and telecom routes are largely unpublished.';

const WHAT_THE_FIGURE_IS =
  'This is an estimate of LAND VALUE FOR THE PARCEL. It is not the value of any easement, and it ' +
  'is not the value of the encumbered strip. Multiplying it by an encumbered area would be the ' +
  'strip valuation the controlling standard rejects.';

/**
 * Builds the land-value section, or returns null.
 *
 * NULL IS THE EXPECTED PATH FOR MOST PARCELS, and the guards below are
 * propagated rather than caught. `calibratedRange` throws for any path but
 * ZIP-comparable; catching that and substituting a range is precisely the
 * mistake the guard exists to prevent. A live two-parcel check produced 90%
 * ranges of $482k-$3.53M and $631k-$4.63M — arithmetically correct, and
 * meaningless.
 */
export function buildLandValueSection(
  reconciliation: Reconciliation,
  range: CalibratedRange | null,
): LandValueSection | null {
  // Discordant paths lead with no number. reconcilePaths already sets
  // pointEstimate null there; do not fill it from low/high.
  if (reconciliation.status === 'unavailable') return null;
  if (reconciliation.pointEstimate === null) return null;
  if (range === null) return null;

  return {
    reconciliation,
    calibrationNote: describeCalibration(range),
    upperBoundUnbounded: range.highUnbounded,
    whatThisFigureIs: WHAT_THE_FIGURE_IS,
  };
}

export interface ReferralPackageInput {
  readonly parcel: ParcelIdentity;
  readonly findings: readonly TierAssessment[];
  readonly evidenceSummary: string;
  readonly fromRecordedEasements: boolean;
  readonly provenance: EasementProvenance;
  readonly encumberedArea: EncumberedAreaSection | null;
  readonly landValue: LandValueSection | null;
  /** Extra caveats gathered from jurisdiction/county context, verbatim. */
  readonly extraCaveats?: readonly Caveat[];
  readonly attorneyReview?: AttorneyReviewDecision | null;
  readonly illustrative?: boolean;
  /** Facts that suppress a conditional not-determined item. */
  readonly known?: {
    readonly easementIsRecorded?: boolean;
    readonly instrumentTermsRead?: boolean;
    readonly ownerKnown?: boolean;
    readonly isTemporary?: boolean;
    readonly termKnown?: boolean;
    readonly observedRentAvailable?: boolean;
    readonly stateRuleSetReviewed?: boolean;
  };
  readonly generatedAt?: string;
}

/**
 * Builds the package.
 *
 * THERE IS NO PARAMETER FOR `notDetermined`. It is computed here from the
 * inputs, and there is no way for a caller to supply, override, filter or
 * suppress it — composition rather than configuration, the same reason
 * `lookupEncumbranceFactor` has no `defaultFactor`. That is the second of the
 * five mechanisms keeping the section in the package.
 */
export function buildReferralPackage(input: ReferralPackageInput): ReferralPackage {
  const caveats: Caveat[] = [
    { text: CURRENT_DISCLAIMER.letterFooterText, sourceSymbol: 'CURRENT_DISCLAIMER.letterFooterText' },
    {
      text: CURRENT_DISCLAIMER.notLegalCounselText,
      sourceSymbol: 'CURRENT_DISCLAIMER.notLegalCounselText',
    },
    // Only when the state's rules are actually unreviewed. Derived from the
    // same gate analyzeEasement reads, so the caveat cannot outlive the fact.
    ...(legalReviewDisclosure(input.parcel.state).text === null
      ? []
      : [
          {
            text: CURRENT_DISCLAIMER.unreviewedLawText,
            sourceSymbol: 'legalReviewDisclosure(state)',
          },
        ]),
    { text: BEFORE_AND_AFTER_METHODOLOGY_NOTE, sourceSymbol: 'BEFORE_AND_AFTER_METHODOLOGY_NOTE' },
    { text: YELLOW_BOOK_4_6_5.citation, sourceSymbol: 'YELLOW_BOOK_4_6_5.citation' },
  ];
  for (const f of input.findings) {
    caveats.push({ text: f.implication, sourceSymbol: 'TierAssessment.implication' });
  }
  if (input.landValue) {
    caveats.push({ text: input.landValue.calibrationNote, sourceSymbol: 'describeCalibration()' });
  }
  caveats.push(...(input.extraCaveats ?? []));

  const notDetermined = buildNotDetermined({
    easementIsRecorded: input.known?.easementIsRecorded,
    instrumentTermsRead: input.known?.instrumentTermsRead,
    infrastructureOnParcel: input.findings.some((f) => f.tier === 'A'),
    ownerKnown: input.known?.ownerKnown ?? input.parcel.ownerName !== null,
    areaKnown: input.encumberedArea !== null,
    landValueEmitted: input.landValue !== null,
    isTemporary: input.known?.isTemporary,
    termKnown: input.known?.termKnown,
    observedRentAvailable: input.known?.observedRentAvailable,
    stateRuleSetReviewed: input.known?.stateRuleSetReviewed,
  });

  return {
    packageVersion: PACKAGE_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    disclaimerVersion: CURRENT_DISCLAIMER.version,
    disclaimerNeedsSignOff: CURRENT_DISCLAIMER.needsComplianceSignOff,
    whatThisIs: STANDING_HEADER,
    parcel: input.parcel,
    evidence: {
      findings: input.findings,
      summary: input.evidenceSummary,
      fromRecordedEasements: input.fromRecordedEasements,
      provenanceConfidence: provenanceConfidence(input.provenance),
      negativeResultCaveat: NEGATIVE_RESULT_CAVEAT,
    },
    encumberedArea: input.encumberedArea,
    landValue: input.landValue,
    caveats,
    notDetermined,
    // Always null at build. Only applyObservedRent can set it, and only from a
    // rate a person supplied.
    temporary: null,
    attorneyReview: input.attorneyReview ?? null,
    illustrative: input.illustrative ?? false,
  };
}

/**
 * The render-time invariant.
 *
 * Runs inside EVERY renderer and inside the JSON parser, not only at build.
 * That duplication is deliberate: a package may arrive deserialized from a
 * store rather than freshly built, and build-time validation does not survive
 * `JSON.parse`. This is the third of the five mechanisms.
 */
export function assertPackageIntegrity(pkg: ReferralPackage, renderedText?: string): void {
  if (!Array.isArray(pkg.notDetermined) || pkg.notDetermined.length === 0) {
    throw new ReferralPackageError(
      'Referral package has no "what was not determined" section. That section is required in ' +
        'every package: it is the only part carrying no numbers, so it is what a truncated copy ' +
        'loses first, and it is the part a professional most needs.',
    );
  }
  if (!hasFloorItems(pkg.notDetermined)) {
    throw new ReferralPackageError(
      'Referral package is missing one or more floor items from the not-determined section. The ' +
        'four floor items are unconditional — no formula available to this product produces the ' +
        'market value of a permanent easement, whatever the inputs.',
    );
  }
  if (pkg.whatThisIs !== STANDING_HEADER) {
    throw new ReferralPackageError(
      'Referral package header has been altered. It must be the STANDING_HEADER verbatim — one ' +
        'string in one place, not re-paraphrased per surface.',
    );
  }
  if (renderedText !== undefined) {
    const scan = scanForAppraisalClaims(renderedText);
    if (!scan.ok) {
      throw new ReferralPackageError(`Rendered package failed the claim scan. ${explainClaimScan(scan)}`);
    }
  }
}

/**
 * Parses a stored package, applying the same invariant as a renderer.
 *
 * Deserialisation is the realistic route by which a package with a stripped
 * section reaches a reader, so it is checked at exactly the same bar.
 */
export function parseReferralPackage(json: string): ReferralPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ReferralPackageError('Referral package JSON could not be parsed');
  }
  const pkg = parsed as ReferralPackage;
  assertPackageIntegrity(pkg);
  return pkg;
}
