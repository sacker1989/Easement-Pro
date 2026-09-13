/**
 * Generic three-state confidence-tiering engine. See docs/development-strategy-v2.md,
 * "Compliance Agent" and "UX Agent" sections — ambiguous findings must never be
 * presented as a false binary; this is the gating logic the UI's three-state
 * display (Clear / Likely with caveat / Flagged — Ambiguous) reads from.
 *
 * This file holds no legal content. Rule sets (e.g. ca-rule-set.ts) plug into
 * it, so a jurisdiction's rules can change without touching this engine.
 */

export type ConfidenceTier = 'clear' | 'likely-with-caveat' | 'flagged-ambiguous';

export type TieredResult<TValue> =
  | { tier: 'clear'; ruleId: string; value: TValue }
  | { tier: 'likely-with-caveat'; ruleId: string; value: TValue; caveat: string }
  | { tier: 'flagged-ambiguous'; ruleId: string; flagReason: string };

/**
 * What a rule actually asserts — and therefore whether it needs counsel review
 * before it may run.
 *
 * THIS IS THE DISTINCTION THAT LETS AN UNREVIEWED STATE STILL BE USEFUL.
 * "Your recorded instrument contains the words 'perpetual' and states no term"
 * is a reading of a document. Any careful reader would agree with it, it holds
 * identically in every jurisdiction, and it asserts nothing about what the law
 * does with that fact. "California presumes an appurtenant easement runs with
 * the land absent contrary language" is state doctrine, and a researcher
 * assembling it from general sources is exactly what the review gate exists to
 * stop reaching a user.
 *
 * Both were previously blocked together, which meant a homeowner holding an
 * instrument that plainly says "perpetual" was told nothing could be
 * determined — when the document had already answered them.
 */
export type RuleClaimType =
  /** Reports an observable fact — what a document says, where data came from.
   *  Asserts no rule of law, so it runs in any state, reviewed or not. */
  | 'observation'
  /** Applies a rule of law. Requires a counsel-reviewed rule set. */
  | 'state-doctrine';

export interface ConfidenceRule<TFacts, TValue> {
  id: string;
  /**
   * Required rather than optional, and deliberately so: a rule added without
   * declaring what it claims would default to whichever value the author
   * happened to omit, and the safe default is the one that makes the rule
   * useless. Forcing the declaration makes it a decision.
   */
  claimType: RuleClaimType;
  /** Return null to defer to the next rule. Rules are evaluated in order; first match wins. */
  evaluate(facts: TFacts): Omit<TieredResult<TValue>, 'ruleId'> | null;
}

/**
 * The fallback a state supplies when no rule matches. Omits `ruleId` because
 * `classifyByRules` stamps that on. Exported in Phase 3 so each state's rule
 * set can declare its own fallback against the same shape.
 */
export type FlaggedFallback<TValue> = Omit<Extract<TieredResult<TValue>, { tier: 'flagged-ambiguous' }>, 'ruleId'>;

/**
 * Runs an ordered rule set against a set of facts. The first rule that
 * returns a non-null outcome wins. If no rule matches, falls back to a
 * flagged-ambiguous result — an unmatched fact pattern should read as
 * "needs review," never silently default to Clear.
 */
export function classifyByRules<TFacts, TValue>(
  facts: TFacts,
  rules: ReadonlyArray<ConfidenceRule<TFacts, TValue>>,
  fallback: FlaggedFallback<TValue>,
): TieredResult<TValue> {
  for (const rule of rules) {
    const outcome = rule.evaluate(facts);
    if (outcome) {
      return { ...outcome, ruleId: rule.id } as TieredResult<TValue>;
    }
  }
  return { ...fallback, ruleId: 'fallback-no-rule-matched' };
}
