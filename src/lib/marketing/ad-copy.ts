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

/** Claims the product can substantiate today. */
export const APPROVED_COPY: readonly string[] = [
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
  'determination, or advice, and it does not estimate the market value of any permanent easement.';
