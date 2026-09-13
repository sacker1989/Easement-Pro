/**
 * The user-facing disclosure that the legal rules behind the output have not
 * been reviewed by an attorney.
 *
 * WHY THIS IS DERIVED RATHER THAN HARDCODED. A disclaimer that states a fact
 * about the world has to track that fact, or it becomes a different kind of
 * inaccuracy: a page still saying "unreviewed" after a review lands is not
 * cautious, it is stale, and it teaches readers the warnings are boilerplate.
 * So this reads `resolveStateRuleSet` — the same gate `analyzeEasement` reads
 * before deciding whether to run a rule at all. One source of truth, two
 * consumers, and no way for the copy to drift from the behaviour it describes.
 *
 * TODAY IT SHOWS EVERYWHERE, and that is correct. California has a rule set
 * with `review: null`; every other state has none. There is no state in which
 * this disclosure is currently suppressed, and the suppression branch exists
 * so that fact is visible rather than assumed permanent.
 */

import { resolveStateRuleSet } from '@/lib/analysis-layer/registry';
import type { RuleSetResolution } from '@/lib/analysis-layer/rule-set';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';

export interface LegalReviewDisclosure {
  /** True when the disclosure must render. */
  readonly required: boolean;
  /** The copy to render, or null when a reviewed rule set governs. */
  readonly text: string | null;
  /** Machine-readable reason, for the audit record. */
  readonly reason: string;
}

/**
 * Whether this state's legal rules carry a counsel review, and the copy to
 * show if they do not.
 *
 * Takes a state code and nothing else — no `force`, no `suppress`. A
 * disclosure with an off switch is a disclosure that gets switched off.
 */
export function legalReviewDisclosure(stateCode: string): LegalReviewDisclosure {
  return disclosureFor(resolveStateRuleSet(stateCode));
}

/**
 * The decision itself, given a resolution.
 *
 * Split out because the suppression branch is CURRENTLY UNREACHABLE through
 * the registry — no state has a review, so `available` never occurs, and a
 * mutation deleting that branch passed every test. A branch that cannot be
 * exercised is a branch nobody has checked, and this is the branch that
 * decides whether a legal warning stops appearing. Taking a resolution rather
 * than a state code makes it reachable from a test without giving any caller a
 * way to fabricate one in production: `resolveStateRuleSet` remains the only
 * source of resolutions, and it still has no bypass.
 */
export function disclosureFor(resolution: RuleSetResolution): LegalReviewDisclosure {
  if (resolution.status === 'available') {
    return {
      required: false,
      text: null,
      reason: `${resolution.ruleSet.state} rule set reviewed under record ${resolution.review.id}`,
    };
  }

  return {
    required: true,
    text: CURRENT_DISCLAIMER.unreviewedLawText,
    reason: `${resolution.state} rule set unavailable: ${resolution.reason}`,
  };
}

/**
 * The full block for a surface that both applies legal rules and hands the
 * user a document — the report, the referral package, a letter.
 *
 * Ordered deliberately: what this is not, then what has not been checked. A
 * reader who stops after the first line has still been told the thing that
 * matters most.
 */
export function fullLegalDisclosure(stateCode: string): readonly string[] {
  const review = legalReviewDisclosure(stateCode);
  const lines = [CURRENT_DISCLAIMER.notLegalCounselText];
  if (review.text !== null) lines.push(review.text);
  return lines;
}
