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

export interface ConfidenceRule<TFacts, TValue> {
  id: string;
  /** Return null to defer to the next rule. Rules are evaluated in order; first match wins. */
  evaluate(facts: TFacts): Omit<TieredResult<TValue>, 'ruleId'> | null;
}

type FlaggedFallback<TValue> = Omit<Extract<TieredResult<TValue>, { tier: 'flagged-ambiguous' }>, 'ruleId'>;

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
