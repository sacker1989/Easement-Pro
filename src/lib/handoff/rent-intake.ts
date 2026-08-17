/**
 * Appraiser-supplied observed rent, into `valueTemporaryEasement`.
 *
 * WHY THIS IS THE ONLY VALUATION PATH IN THE HANDOFF LAYER. §4.6.5 forecloses
 * the permanent-easement calculation entirely, and §4.6.5.1.2 gives exactly one
 * concretely implementable measure: market rental value for the term. That
 * measure needs an observed ground rent, and no open dataset publishes one for
 * residential land — the only observed rent this project located is
 * agricultural (`NASS_AGRICULTURAL_RENT`). So the rate comes from a person, and
 * this module is the door it comes through.
 *
 * WHAT THE TYPE SYSTEM ADDS OVER `temporary-easement.ts`. That module documents
 * the 360x agricultural-vs-suburban trap in prose but cannot enforce it: a
 * `MarketRentRate` carries a number, a source string and a date, none of which
 * says WHAT LAND CLASS the rent was observed for. Florida pasture runs
 * ~$0.00069/sq ft/yr against an illustrative suburban $0.25/sq ft/yr, and over
 * 1,204 sq ft for two years the pasture rate yields $1.66. The land class is
 * not a detail, it is the whole magnitude, so `HandoffRentRate` requires it and
 * this module refuses a mismatch that nobody has acknowledged.
 *
 * ERRORS PROPAGATE. `TemporaryEasementError` is never caught and downgraded to
 * a warning here. The throw is the feature — a fee-derived rate reaching a
 * rendered package would be the §4.7 method the standard forbids, wearing the
 * costume of a measurement.
 */

import {
  assertObservedRate,
  valueTemporaryEasement,
  NASS_AGRICULTURAL_RENT,
  TemporaryEasementError,
  type MarketRentRate,
  type TemporaryEasementValuation,
} from '@/lib/valuation/temporary-easement';
import { YELLOW_BOOK_4_6_5 } from '@/lib/valuation/encumbrance-factors';
import type { ExpressDurationBasis } from '@/lib/analysis-layer/duration-basis';
import { hasFloorItems, type NotDeterminedSection } from './not-determined';
import type { EncumberedAreaSection } from './area-derivation';
import { ReferralPackageError, type ReferralPackage } from './referral-package';

/**
 * A rate with the land class it was observed for.
 *
 * Added here rather than by editing `MarketRentRate`, so `temporary-easement.ts`
 * stays untouched and usable on its own.
 */
export interface HandoffRentRate extends MarketRentRate {
  /** The land class this rent was observed for, e.g. "residential" or "pasture". */
  readonly landClass: string;
  /** Where that classification came from — a lease set, a market study, an appraiser. */
  readonly landClassSource: string;
}

export interface RentTerms {
  /** From the instrument. There is no default and no "assume 12 months". */
  readonly termYears: number;
  readonly retainedUseShare?: number;
  readonly discountRate?: number;
  /**
   * How the duration was established. Only `term-limited` proceeds.
   *
   * Required rather than inferred from `termYears`: supplying a term is a
   * claim about the instrument, and reading that claim back as evidence for
   * itself would let a perpetual easement be valued as a temporary one purely
   * because someone typed a number.
   */
  readonly durationBasis: ExpressDurationBasis | 'unknown';
  /**
   * Required when the rate's land class does not exactly match the parcel's,
   * INCLUDING when the parcel's class is unknown. Free text, not a boolean:
   * the reader needs the reason, and a boolean records only that someone
   * clicked past it.
   */
  readonly landClassMismatchAcknowledgement?: string;
}

export type LandClassMatch = 'exact' | 'acknowledged-mismatch' | 'acknowledged-parcel-class-unknown';

export interface TemporaryEasementSection {
  readonly valuation: TemporaryEasementValuation;
  readonly rate: HandoffRentRate;
  readonly parcelLandClass: string | null;
  readonly landClassMatch: LandClassMatch;
  /** Rendered prominently when the classes did not match. Null on an exact match. */
  readonly mismatchNotice: string | null;
  /** What this figure does not cover. Stated with the figure, not in a footnote. */
  readonly scopeNote: string;
}

const SCOPE_NOTE =
  'This figure covers the TEMPORARY easement for its stated term only. It says nothing about any ' +
  'permanent easement on the same parcel, about damage to the remainder, or about the value of the ' +
  'fee. Those remain undetermined and are listed as such above.';

function normaliseClass(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Decides whether the rate's land class may be applied to this parcel.
 *
 * Matching is not fully automatable — assessor land-use vocabularies differ by
 * county and there is no crosswalk — so this does not attempt fuzzy matching.
 * Exact match passes silently; everything else, including an unknown parcel
 * class, requires an explicit acknowledgement and renders a notice. Treating
 * "unknown" as a pass would be the whole trap: an unclassified parcel is
 * exactly where an agricultural rate slips onto a residential lot.
 */
function checkLandClass(
  rate: HandoffRentRate,
  parcelLandClass: string | null,
  acknowledgement: string | undefined,
): { match: LandClassMatch; notice: string | null } {
  if (parcelLandClass !== null && normaliseClass(parcelLandClass) === normaliseClass(rate.landClass)) {
    return { match: 'exact', notice: null };
  }

  const unknown = parcelLandClass === null;
  const describe = unknown
    ? "the parcel's land class is not recorded in this package"
    : `the parcel is classified "${parcelLandClass}" and the rate was observed for ` +
      `"${rate.landClass}"`;

  if (acknowledgement === undefined || acknowledgement.trim().length < 10) {
    throw new TemporaryEasementError(
      `Refusing to apply this rent: ${describe}. ${NASS_AGRICULTURAL_RENT.invalidFor} ` +
        'Supply landClassMismatchAcknowledgement with the reason this rate applies anyway, and it ' +
        'will be rendered alongside the figure.',
    );
  }

  return {
    match: unknown ? 'acknowledged-parcel-class-unknown' : 'acknowledged-mismatch',
    notice:
      `LAND CLASS MISMATCH — ${describe}. Acknowledged: "${acknowledgement.trim()}" ` +
      `${NASS_AGRICULTURAL_RENT.invalidFor} Weigh this figure accordingly.`,
  };
}

/** Keys this call answers, and the only ones it may remove. */
const ANSWERED_KEYS = ['temporary-term', 'observed-market-rent'] as const;

/**
 * Applies an observed rent to a package.
 *
 * The returned package keeps every floor item. A valued temporary easement
 * says nothing about a perpetual encumbrance on the same parcel, so the
 * permanent-easement, encumbrance-factor, remainder-damage and
 * highest-and-best-use items all stand — `valueTemporaryEasement`'s own note
 * already says it "does not address any permanent easement or damage to the
 * remainder", and dropping the items would contradict the note it prints.
 */
export function applyObservedRent(
  pkg: ReferralPackage,
  rate: HandoffRentRate,
  terms: RentTerms,
): ReferralPackage {
  // §4.6.5.1.2 is a TEMPORARY-acquisition measure. Running it on a perpetual
  // easement would manufacture precisely the number §6 says does not exist,
  // and it would look like a measurement because the arithmetic is real.
  if (terms.durationBasis === 'perpetual-express') {
    throw new TemporaryEasementError(
      'Refusing to apply a market rent to a perpetual easement. ' +
        `${YELLOW_BOOK_4_6_5.temporaryEasementMeasure} ` +
        'A perpetual easement is measured by the whole tract before minus the remainder after, ' +
        'which requires a licensed appraiser. There is no term to rent.',
    );
  }
  if (terms.durationBasis === 'unknown') {
    throw new TemporaryEasementError(
      'Refusing to apply a market rent where the easement duration was not established. Valuing ' +
        'it as temporary assumes the answer to the question that decides which measure applies.',
    );
  }

  if (pkg.encumberedArea === null) {
    throw new TemporaryEasementError(
      'Refusing to value a temporary easement with no established encumbered area. Area is half ' +
        'the formula, and this package states no area because none was derived from an instrument ' +
        'or a measurement. Applying a default width here would invent the figure.',
    );
  }

  // Belt and braces: valueTemporaryEasement calls this too. Running it first
  // means a fee-derived rate is rejected before anything else is computed.
  assertObservedRate(rate);

  const { match, notice } = checkLandClass(rate, pkg.parcel.landClass, terms.landClassMismatchAcknowledgement);

  // Errors from here propagate untouched. See the module comment.
  const valuation = valueTemporaryEasement({
    areaSqFt: pkg.encumberedArea.areaSqFt,
    termYears: terms.termYears,
    rate,
    retainedUseShare: terms.retainedUseShare,
    discountRate: terms.discountRate,
  });

  const kept = pkg.notDetermined.filter(
    (item) => !(ANSWERED_KEYS as readonly string[]).includes(item.key),
  );
  if (!hasFloorItems(kept) || kept.length === 0) {
    throw new ReferralPackageError(
      'Applying a rent would have removed a floor item from the not-determined section. That is a ' +
        'bug in ANSWERED_KEYS, not a condition a caller can cause.',
    );
  }

  return {
    ...pkg,
    // A hypothetical rate makes the whole package illustrative. The banner is a
    // header in every renderer rather than a footnote, because a reader meets
    // the dollar figure first.
    illustrative: pkg.illustrative || rate.hypothetical === true,
    notDetermined: kept as unknown as NotDeterminedSection,
    temporary: {
      valuation,
      rate,
      parcelLandClass: pkg.parcel.landClass,
      landClassMatch: match,
      mismatchNotice: notice,
      scopeNote: SCOPE_NOTE,
    },
  };
}

/** The pre-filled ask sent to an appraiser, not a blank form. */
export interface AppraiserRentRequest {
  readonly parcelId: string;
  readonly market: string;
  readonly encumberedArea: EncumberedAreaSection | null;
  readonly areaNote: string;
  readonly parcelLandClass: string | null;
  readonly parcelLandClassSource: string | null;
  readonly termNote: string;
  /** Stated up front, so a capitalised land value is not returned. */
  readonly constraint: string;
  readonly whatIsNeeded: readonly string[];
}

/**
 * The constraint, stated before the ask rather than after it.
 *
 * An appraiser who returns a capitalised land value has done work that
 * `assertObservedRate` will throw on. Finding that out afterwards wastes their
 * time, and the wasted time is what makes the next request go unanswered.
 */
export const RENT_REQUEST_CONSTRAINT =
  'The rate must be an OBSERVED MARKET GROUND RENT for this land class — comparable ground leases, ' +
  'a market rent study, or your own observation of the local market. A rate derived from fee value ' +
  'will be rejected automatically. The Uniform Appraisal Standards for Federal Land Acquisitions ' +
  '§4.7 holds it "improper to develop an opinion of the market rental value ... based on the value ' +
  'of the underlying fee", and federal courts reject that method EVEN WHERE COMPARABLE LEASES ARE ' +
  `UNAVAILABLE. ${YELLOW_BOOK_4_6_5.citation}`;

export function buildAppraiserRentRequest(pkg: ReferralPackage): AppraiserRentRequest {
  const termItem = pkg.notDetermined.find((i) => i.key === 'temporary-term');
  return {
    parcelId: pkg.parcel.parcelId,
    market: `${pkg.parcel.county}, ${pkg.parcel.state}`,
    encumberedArea: pkg.encumberedArea,
    areaNote:
      pkg.encumberedArea === null
        ? 'No encumbered area has been established. It is needed before a rent can be applied, and ' +
          'this package does not assume a width.'
        : pkg.encumberedArea.derivationNote,
    parcelLandClass: pkg.parcel.landClass,
    parcelLandClassSource: pkg.parcel.landClassSource,
    termNote:
      termItem === undefined
        ? 'Term is established for this easement.'
        : `Term is not established. ${termItem.whatWouldResolveIt}`,
    constraint: RENT_REQUEST_CONSTRAINT,
    whatIsNeeded: [
      'An observed ground rent in dollars per square foot per year.',
      'The land class it was observed for, and where that classification came from.',
      'The date observed, and the comparables or study behind it.',
      'The term of the easement, if the instrument is available to you and not to us.',
    ],
  };
}
