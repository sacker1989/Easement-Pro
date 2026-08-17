/**
 * Guards the referral package against claiming to be something it is not.
 *
 * Follows the DERIVED_FROM_FEE precedent in temporary-easement.ts: a regex
 * cannot stop a determined caller, but it catches the honest mistake, which is
 * the realistic failure mode — a well-meaning edit that firms up hedged
 * language into an assertion.
 *
 * THE SUBTLETY THAT WOULD BE EASY TO GET WRONG: do not ban the word
 * "appraisal". The package contains it legitimately and repeatedly — "Uniform
 * Appraisal Standards for Federal Land Acquisitions", "this is not an
 * appraisal", "requires a licensed appraiser", "the accepted before and after
 * appraisal method". A word ban would fire on the standard's own name and
 * pressure whoever hit it into stripping the citations, which is the opposite
 * of the goal. So the patterns target CLAIM SHAPES, and the suite carries a
 * false-positive control asserting the citations do not trip them.
 */

/** Claim shapes that must never appear in a rendered package. */
export const FORBIDDEN_CLAIM_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  {
    name: 'asserts the document is an appraisal',
    // The negative lookahead is load-bearing. Without it this pattern fires on
    // the package's own disclaimer — "This package … is NOT an appraisal" —
    // which is the very sentence the scan simultaneously REQUIRES. The
    // false-positive control caught exactly that, on its first run.
    pattern:
      /(this|the)\s+(report|package|estimate|analysis)[^.]{0,60}\b(is|constitutes|serves as|qualifies as)\b(?![^.]{0,40}\b(not|never|no)\b)[^.]{0,30}\ban appraisal\b/i,
  },
  { name: 'asserts appraised value', pattern: /\bappraised value\b/i },
  { name: 'asserts a certified appraisal', pattern: /\bcertified appraisal\b/i },
  { name: 'claims USPAP compliance', pattern: /\bUSPAP[- ]compliant\b/i },
  {
    name: 'offers an opinion of value',
    // Negation lookbehind, for the same reason pattern 1 has a lookahead, and
    // found the same way. STANDING_HEADER says "IT OFFERS NO OPINION OF MARKET
    // VALUE FOR ANY PERMANENT EASEMENT" — the strongest disclaimer in the
    // package — and the unguarded pattern matched it case-insensitively. Every
    // renderer would have thrown on every well-formed package, and the
    // available fix under deadline is to soften the disclaimer, which is
    // backwards. The claim shape is OFFERING an opinion of value; disclaiming
    // one is the opposite and must pass.
    pattern: /(?<!\b(no|not|never|without|neither)\b[^.]{0,25})\bopinion of (market )?value\b/i,
  },
  {
    name: 'states a market value for the easement',
    pattern: /\b(fair )?market value of the easement\s+(is|=)/i,
  },
  { name: 'states what the easement is worth', pattern: /\beasement is worth\b/i },
  { name: 'states compensation as owed', pattern: /\byou are (owed|entitled to)\b/i },
];

/**
 * The affirmative that must be PRESENT. Absence fails the scan just as a
 * forbidden match does — a package that merely avoids claiming to be an
 * appraisal, without saying it is not one, leaves the reader to assume.
 */
export const REQUIRED_DISCLAIMER_PHRASE = 'is not an appraisal';

export interface ClaimScanResult {
  readonly ok: boolean;
  /** Names of the claim shapes found, empty when clean. */
  readonly violations: readonly string[];
  /** True when the required not-an-appraisal sentence is present. */
  readonly hasRequiredDisclaimer: boolean;
}

/** Runs the scan over rendered text. */
export function scanForAppraisalClaims(text: string): ClaimScanResult {
  const violations = FORBIDDEN_CLAIM_PATTERNS.filter((p) => p.pattern.test(text)).map((p) => p.name);
  const hasRequiredDisclaimer = text.toLowerCase().includes(REQUIRED_DISCLAIMER_PHRASE);
  return {
    ok: violations.length === 0 && hasRequiredDisclaimer,
    violations,
    hasRequiredDisclaimer,
  };
}

/** Explains a failed scan in terms a maintainer can act on. */
export function explainClaimScan(result: ClaimScanResult): string {
  if (result.ok) return 'No appraisal claims found, and the required disclaimer is present.';
  const parts: string[] = [];
  if (result.violations.length > 0) {
    parts.push(`Forbidden claim shapes present: ${result.violations.join('; ')}.`);
  }
  if (!result.hasRequiredDisclaimer) {
    parts.push(
      `The required phrase "${REQUIRED_DISCLAIMER_PHRASE}" is missing. Saying nothing is not ` +
        'neutral here — a reader who is not told this is not an appraisal will assume it is one.',
    );
  }
  return parts.join(' ');
}
