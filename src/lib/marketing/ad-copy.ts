/**
 * Marketing copy, held to the same claim scan as the referral package.
 *
 * WHY COPY BELONGS IN THE CODEBASE. `scanForAppraisalClaims()` already runs on
 * every rendered package, so a sentence claiming to value an easement cannot
 * reach a reader through the product. It can reach them through an ad, a
 * landing page or an email — which is the same false claim through a channel
 * with a regulator attached, and until now nothing checked that channel.
 *
 * The highest-converting sentence available to this product is one it may not
 * use: "find out what your easement is worth". §4.6.5 forecloses the method,
 * so the claim is false, and in a category where the real answer requires a
 * licensed appraiser a false claim is an enforcement problem rather than a
 * copywriting one. That pressure does not go away, which is exactly why the
 * prohibition should be mechanical instead of remembered.
 *
 * The test beside this file scans APPROVED_COPY and asserts it is clean, and
 * scans PROHIBITED_COPY and asserts every line is caught. Adding copy without
 * adding it here is possible; the point is that the reviewed set stays
 * verifiable and the trap phrases stay documented with their reasons.
 */

/**
 * WHY A DISCLAIMER DOES NOT DO IN AN AD WHAT IT DOES IN THE PRODUCT.
 *
 * Recorded 2026-08-22 against review item 10. The position offered was that
 * valuation and appraisal claims are covered by disclosing that the figures are
 * assumptions rather than legal facts, which the homeowner is entitled to learn
 * about. Inside the product that is exactly right, and it is what the screening
 * module already does. In advertising it does not carry, for three reasons that
 * are separate and each sufficient:
 *
 * 1. AN AD IS JUDGED ON ITS NET IMPRESSION. A disclaimer that contradicts the
 *    headline does not cure the headline — it is the textbook case of a
 *    disclaimer that fails. "Find out what your easement is worth", footnoted
 *    "these are assumptions", still promises the thing the footnote withdraws.
 *
 * 2. THE PROHIBITED CLAIMS ARE NOT UNSUBSTANTIATED FOR WANT OF A DISCLAIMER.
 *    They claim a capability the product does not have. §4.6.5 forecloses the
 *    method, so no wording creates the capability the claim asserts.
 *
 * 3. APPRAISAL IS A LICENSED ACTIVITY. Advertising appraisal services without
 *    a licence is a licensing problem regardless of what the fine print says.
 *    You cannot disclaim your way into offering a licensed service.
 *
 * THE DEFENSIBLE VERSION OF THE SAME IDEA IS BELOW, and it is a good one. "You
 * have a right to see what the public record says about your own property" is true,
 * substantiated, and more appealing than the claim it replaces. It describes
 * what the product does rather than promising an answer it cannot produce. The
 * entitlement framing survives; the valuation claim it was offered to rescue
 * does not.
 *
 * PER-STATE REVIEW STANDS. Also recorded 2026-08-22: the approved set will
 * likely vary by state. Nothing here is approved for any state yet.
 */

/** Claims the product can substantiate today. */
export const APPROVED_COPY: readonly string[] = [
  // The entitlement framing, in its substantiated form.
  // Reworded from "You are entitled to see...". The scanner reads
  // "you are entitled to" as a compensation promise, which is what that
  // phrase usually IS in this category. Rewording keeps the guard strong.
  'You have a right to see what the public record says about your own property.',
  'The figures here are assumptions built from public records, and we show you how each one was built.',
  'Know what is on your land, and how much of it is guesswork.',
  "Find out what you can and can't build.",
  'See what your county actually records about your lot.',
  'Know before you pour concrete.',
  'Your easement, in plain English.',
  'Get an evidence package ready for an appraiser.',
  "We'll tell you what the record doesn't say, too.",
  'Before you build, find out what is actually on your land.',
  'We read your county parcel records and report what they restrict.',
];

export interface ProhibitedClaim {
  readonly text: string;
  readonly why: string;
}

/**
 * Claims that must never run, each with the reason.
 *
 * The reason travels with the string on purpose. A bare blocklist gets
 * relitigated by whoever inherits it and finds a variant that "isn't quite the
 * same"; the reason is what makes the variant obviously the same.
 */
export const PROHIBITED_COPY: readonly ProhibitedClaim[] = [
  {
    text: 'Find out what your easement is worth today.',
    why: 'The product cannot compute it. Uniform Appraisal Standards §4.6.5 forecloses every method available to a dataset.',
  },
  {
    text: 'You are owed compensation for this easement.',
    why: 'A legal conclusion this product cannot reach, and an existing forbidden pattern in the claim scan.',
  },
  {
    text: 'Our opinion of market value is included free.',
    why: 'Offering an opinion of value is the licensed activity itself.',
  },
  {
    text: 'This report is an appraisal of the easement.',
    why: 'False, and the exact claim shape the scanner exists to catch.',
  },
  {
    text: 'Get a certified appraisal of your easement in minutes.',
    why: 'Appraisal certification is a licensed act with a required process.',
  },
  {
    text: 'The appraised value of your parcel is included.',
    why: 'Asserts an appraised value the product never produces.',
  },
];

/**
 * The required disclosure for any surface that shows a figure.
 *
 * Contains REQUIRED_DISCLAIMER_PHRASE verbatim, so a page carrying it passes
 * the affirmative half of the scan rather than merely avoiding the forbidden
 * half. Saying nothing is not neutral: a reader not told otherwise assumes.
 */
export const MARKETING_DISCLOSURE =
  'This is a screening report built from public records. It is not an appraisal, a legal ' +
  'determination, or advice, and it does not estimate the market value of any permanent easement. ' +
  // Phrased around the literal "easement is worth", which the scanner
  // forbids. Saying "the value of your easement" disclaims the same thing
  // without wearing the shape of the claim.
  'Any figure shown is an assumption derived from published records, not a statement of fact ' +
  'about the value of your easement.';

/**
 * States where the approved set has cleared review. Empty, and that is the
 * honest state.
 *
 * Recorded as a list rather than a boolean because approval is per-state — the
 * position taken on 2026-08-22 was that the set "will likely vary by state",
 * which is right and is why one global flag would be the wrong shape. A state
 * absent from this list has not been reviewed, which is every state.
 */
export const COPY_APPROVED_IN_STATES: readonly string[] = [];

/** True only where the approved set has actually cleared review for that state. */
export function copyApprovedIn(stateCode: string): boolean {
  return COPY_APPROVED_IN_STATES.includes(stateCode.trim().toUpperCase());
}
