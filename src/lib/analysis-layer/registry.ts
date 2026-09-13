/**
 * State rule-set lookup, and the counsel-review gate.
 *
 * `resolveStateRuleSet` TAKES EXACTLY ONE PARAMETER. No `defaultRuleSet`, no
 * `fallbackState`, no `allowUnreviewed` flag. That mirrors
 * `lookupEncumbranceFactor(type)` and it is the load-bearing decision in this
 * file: a gate with a bypass parameter is a gate that will be bypassed, first
 * in a test fixture, then in a demo, then in production. The arity is asserted
 * in the suite so the parameter cannot be added later without a failing test.
 *
 * THE GATE IS NOT SATISFIED BY HAVING AN ENTRY. An entry with no review, a
 * review that has expired, a review taken against an older schema, or a review
 * whose citations have since changed all resolve to `unavailable`. California
 * is in the registry and resolves to `unavailable` today, which is the honest
 * state of the world rather than a bug.
 */

import { CA_RULE_SET } from './rule-sets/ca';
import {
  RULE_SET_SCHEMA_VERSION,
  type RuleSetResolution,
  type StateEasementRuleSet,
} from './rule-set';
import { REVIEW_MAX_AGE_MONTHS, type ReviewRecord } from './legal-fact';

const REGISTRY: readonly StateEasementRuleSet[] = [CA_RULE_SET];

/** States with an ENTRY. Not states that have cleared the gate — see the header. */
export function registeredStates(): readonly string[] {
  return REGISTRY.map((r) => r.state);
}

/**
 * Digest over every citation in an entry.
 *
 * Deliberately simple and deterministic rather than cryptographic: the threat
 * model is an edit nobody meant to slip past a stale review, not an adversary.
 * A reviewer confirmed the words they read; if the words change, the review no
 * longer covers them.
 */
export function citationsDigest(ruleSet: StateEasementRuleSet): string {
  const facts = [
    ruleSet.prescriptivePeriodYears,
    ruleSet.impliedFromPriorUse,
    ruleSet.easementByNecessity,
    ruleSet.recordingAct,
    ruleSet.marketableTitle,
  ];
  const parts = facts.map((f) =>
    f.citation === null ? 'none' : `${f.citation.label}|${f.citation.quotedText}`,
  );
  let hash = 0;
  const joined = parts.join('||');
  for (let i = 0; i < joined.length; i += 1) {
    hash = (hash * 31 + joined.charCodeAt(i)) | 0;
  }
  return `cd_${(hash >>> 0).toString(16)}`;
}

function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) -
    (to.getUTCDate() < from.getUTCDate() ? 1 : 0)
  );
}

function gateReview(
  ruleSet: StateEasementRuleSet,
  review: ReviewRecord,
  today: string,
): RuleSetResolution {
  const state = ruleSet.state;

  if (review.reviewedSchemaVersion < RULE_SET_SCHEMA_VERSION) {
    return {
      status: 'unavailable',
      state,
      reason: 'schema-superseded',
      explanation:
        `The ${state} rule set was reviewed against schema version ` +
        `${review.reviewedSchemaVersion}, and the current schema is ${RULE_SET_SCHEMA_VERSION}. A ` +
        'reviewer confirmed the entry they read, not the fields added afterwards. The review must ' +
        'be renewed against the current shape.',
    };
  }

  if (review.expiresOn < today) {
    return {
      status: 'unavailable',
      state,
      reason: 'review-expired',
      explanation:
        `The ${state} review expired on ${review.expiresOn}. Easement doctrine is statutory in ` +
        'part, and a legislative session can pass between reviews. No determination is offered ' +
        'until it is renewed.',
    };
  }

  if (monthsBetween(review.reviewedOn, today) > REVIEW_MAX_AGE_MONTHS) {
    return {
      status: 'unavailable',
      state,
      reason: 'review-expired',
      explanation:
        `The ${state} review was taken on ${review.reviewedOn}, more than ` +
        `${REVIEW_MAX_AGE_MONTHS} months ago, which is the ceiling this product applies even where ` +
        'an entry sets a longer expiry.',
    };
  }

  if (review.citationsDigest !== citationsDigest(ruleSet)) {
    return {
      status: 'unavailable',
      state,
      reason: 'citations-changed',
      explanation:
        `At least one citation in the ${state} rule set has changed since it was reviewed. The ` +
        'reviewer confirmed the words they read; different words are outside that confirmation.',
    };
  }

  return { status: 'available', ruleSet, review };
}

/**
 * The gate, with the date supplied.
 *
 * Split out so `resolveStateRuleSet` can keep a ONE-PARAMETER signature while
 * expiry stays deterministically testable. Note what this still cannot do: no
 * value of `today` turns an unreviewed or digest-mismatched entry into an
 * available one, so exposing it widens testability without widening the gate.
 */
export function resolveStateRuleSetAt(stateCode: string, today: string): RuleSetResolution {
  const state = stateCode.trim().toUpperCase();
  const now = today;

  const ruleSet = REGISTRY.find((r) => r.state === state);
  if (ruleSet === undefined) {
    return {
      status: 'unavailable',
      state,
      reason: 'no-rule-set',
      explanation:
        `No easement rule set exists for ${state}. Easement doctrine is state law and genuinely ` +
        'differs — prescriptive periods, which implied-easement doctrines are recognised and on ' +
        'what necessity standard, recording-act priority, and whether a marketable-title act ' +
        'extinguishes ancient interests. None of that transfers from another state, so nothing is ' +
        'offered here rather than a neighbour\'s answer.',
    };
  }

  if (ruleSet.review === null) {
    return {
      status: 'unavailable',
      state,
      reason: 'never-reviewed',
      explanation:
        `A ${state} rule set exists but has never been reviewed by counsel licensed in ${state}. ` +
        'Its citations are fetched primary sources and are useful evidence FOR a review; they are ' +
        'not a substitute for one. No substantive determination is offered.',
    };
  }

  return gateReview(ruleSet, ruleSet.review, now);
}

/**
 * Resolves a state's rule set, or explains why none is available.
 *
 * EXACTLY ONE PARAMETER, and the suite asserts the arity. No `defaultRuleSet`,
 * no `fallbackState`, no `allowUnreviewed`. A gate with a bypass parameter is a
 * gate that gets bypassed — first in a fixture, then in a demo, then in
 * production — and the arity test is what makes adding one a visible act
 * rather than a quiet one.
 */
export function resolveStateRuleSet(stateCode: string): RuleSetResolution {
  return resolveStateRuleSetAt(stateCode, new Date().toISOString().slice(0, 10));
}
