/**
 * Counsel review of the unauthorized-practice question, per state — and what
 * an opinion actually PERMITS, which is the part a date cannot carry.
 *
 * WHAT THIS REPLACES. `StateComplianceEntry.lastReviewedDate` was a nullable
 * ISO string that no code read. The gap registry calls that out in terms: "a
 * compliance control that is never consulted is not a control." It also could
 * not express the thing that matters most — a review is not a boolean, it is
 * an opinion with a SCOPE. "Counsel reviewed California" does not say whether
 * they approved reporting records, or open-ended research, or advice, and
 * those are three different products with three different answers under Cal.
 * Bus. & Prof. Code §6125.
 *
 * THE SCOPE FIELDS ARE THE POINT. `UplScope` is deliberately granular because
 * the product's existing posture — report what public records say, refuse to
 * interpret rights — is its answer to §6125, and widening that posture is
 * precisely what needs an attorney's name against it. A product that performs
 * open-ended research and gives advice is making a materially different claim
 * about not practising law than one that reads documents and reports what they
 * say.
 *
 * WHY A DIRECTION IS NOT A REVIEW, AND BOTH ARE RECORDED. The product owner
 * may well know what counsel said before any paperwork exists. That knowledge
 * is worth capturing — it tells whoever picks this up what is expected. It is
 * not worth capturing in the field the gate reads, because a gate satisfied by
 * its own author's expectation is not a gate. So `ProductOwnerDirection` sits
 * beside `UplReviewRecord` and the engine cannot read it, exactly as
 * `researcherReading` sits beside a counsel-confirmed legal fact in
 * legal-fact.ts and the engine cannot read that either. Same problem, same
 * shape, deliberately.
 */

export interface UplScope {
  /**
   * Report what public records say — parcel data, recorded instruments, what a
   * document's own words are. The product's baseline, and the narrowest claim.
   */
  readonly reportsPublicRecords: boolean;
  /**
   * Research a question the user poses, beyond retrieving a named record.
   * Broader: the product chooses what to look for.
   */
  readonly openEndedResearch: boolean;
  /**
   * Tell the user what they should DO, rather than what the records say.
   * The field most likely to be the §6125 question itself.
   */
  readonly advice: boolean;
  /**
   * Generate correspondence that asserts a position on the user's behalf —
   * Track 1. Distinct from advice: a letter is an act, not a statement.
   */
  readonly positionAssertingLetters: boolean;
}

/** Nothing permitted. The scope a state has before anyone has looked. */
export const NO_SCOPE: UplScope = {
  reportsPublicRecords: false,
  openEndedResearch: false,
  advice: false,
  positionAssertingLetters: false,
};

export interface UplReviewRecord {
  readonly id: string;
  readonly state: string;
  /** The attorney. A firm name is not a reviewer. */
  readonly reviewedBy: string;
  readonly barNumber: string;
  /** Must match `state` — an opinion from another state's bar does not transfer. */
  readonly barJurisdiction: string;
  readonly reviewedOn: string;
  readonly expiresOn: string;
  /** What the opinion permits. The gate reads this, not the date. */
  readonly scope: UplScope;
  /** Statutes the opinion actually addressed, by citation. */
  readonly coversBases: readonly string[];
  readonly notes?: string;
}

/**
 * What the product owner says is expected, before an opinion exists on paper.
 *
 * READ BY NOTHING. It exists so the expectation is visible to whoever
 * eventually commissions the opinion, and so the gap registry can say what the
 * product is waiting for rather than merely that it is waiting.
 */
export interface ProductOwnerDirection {
  readonly on: string;
  /** The scope the owner expects counsel to approve. NOT an authorisation. */
  readonly expectedScope: UplScope;
  readonly statedAs: string;
  /** Exactly what is still missing before this can become a review. */
  readonly missing: readonly string[];
}

/**
 * Maximum review age.
 *
 * A STATED CONVENTION, matching REVIEW_MAX_AGE_MONTHS in the analysis layer
 * and set to the same 24 months for the same reason: short enough that a
 * legislative session cannot pass unnoticed, long enough to be affordable.
 * Kept as a separate constant rather than imported because the two gates could
 * reasonably diverge — easement doctrine and UPL licensing move at different
 * speeds — and sharing the constant would hide that choice.
 */
export const UPL_REVIEW_MAX_AGE_MONTHS = 24;

export type UplAuthorisation =
  | { readonly status: 'authorised'; readonly review: UplReviewRecord; readonly scope: UplScope }
  | {
      readonly status: 'refused';
      readonly reason:
        | 'never-reviewed'
        | 'review-expired'
        | 'bar-jurisdiction-mismatch'
        | 'scope-excludes';
      readonly explanation: string;
      /** What the product may still do. Never empty-by-default. */
      readonly scope: UplScope;
    };

function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) -
    (to.getUTCDate() < from.getUTCDate() ? 1 : 0)
  );
}

/**
 * Resolve a state's UPL authorisation.
 *
 * TAKES NO OVERRIDE PARAMETER, for the reason `resolveStateRuleSet` takes
 * none: a gate with a bypass is a gate that gets bypassed, first in a fixture,
 * then in a demo, then in production. Operating without a review is expressed
 * by an accepted compliance gap, which is a dated decision by a named person
 * — not by an argument to this function.
 */
export function resolveUplAuthorisation(
  state: string,
  review: UplReviewRecord | null,
  today: string,
): UplAuthorisation {
  const normalized = state.trim().toUpperCase();

  if (review === null) {
    return {
      status: 'refused',
      reason: 'never-reviewed',
      explanation:
        `No attorney licensed in ${normalized} has given an opinion on whether this product's ` +
        'output is the practice of law there. Free operation removes any compensation-based ' +
        'regime from the question and does not answer it — the unauthorized-practice statutes ' +
        'have no compensation element.',
      scope: NO_SCOPE,
    };
  }

  if (review.barJurisdiction.trim().toUpperCase() !== normalized) {
    return {
      status: 'refused',
      reason: 'bar-jurisdiction-mismatch',
      explanation:
        `The review on file for ${normalized} was given by an attorney admitted in ` +
        `${review.barJurisdiction}. Unauthorized practice is a question of the forum state's own ` +
        'licensing rules, and an opinion from elsewhere does not transfer.',
      scope: NO_SCOPE,
    };
  }

  if (review.expiresOn < today || monthsBetween(review.reviewedOn, today) > UPL_REVIEW_MAX_AGE_MONTHS) {
    return {
      status: 'refused',
      reason: 'review-expired',
      explanation:
        `The ${normalized} UPL review was given on ${review.reviewedOn} and is no longer current ` +
        `(expiry ${review.expiresOn}; ceiling ${UPL_REVIEW_MAX_AGE_MONTHS} months). Licensing ` +
        'rules and bar opinions change, and a lapsed opinion is not a narrower one — it is none.',
      scope: NO_SCOPE,
    };
  }

  return { status: 'authorised', review, scope: review.scope };
}

/** Whether an authorisation permits one specific activity. */
export function permits(auth: UplAuthorisation, activity: keyof UplScope): boolean {
  return auth.scope[activity];
}
