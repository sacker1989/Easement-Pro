import { classifyByRules, type TieredResult } from './confidence-tiering';
import {
  CA_DURATION_FALLBACK,
  CA_DURATION_RULE_SET,
  type DurationDetermination,
  type EasementDurationFacts,
} from './ca-rule-set';

export class UnsupportedStateRuleSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedStateRuleSetError';
  }
}

export interface EasementAnalysisInput {
  /** Two-letter USPS state code. Phase 1 MVP only has a rule set for CA. */
  state: string;
  duration: EasementDurationFacts;
}

export interface EasementAnalysisResult {
  state: string;
  duration: TieredResult<DurationDetermination>;
}

/**
 * Runs the Analysis Layer's confidence-tiering gate against a set of
 * extracted easement facts. Per docs/development-strategy-v2.md, Phase 1 MVP
 * only implements a rule set for California — this throws for any other
 * state rather than silently producing an unreviewed determination.
 */
export function analyzeEasement(input: EasementAnalysisInput): EasementAnalysisResult {
  const state = input.state.trim().toUpperCase();
  if (state !== 'CA') {
    throw new UnsupportedStateRuleSetError(
      `No confidence-tier rule set is implemented yet for "${state}"; Phase 1 MVP only covers California.`,
    );
  }

  const duration = classifyByRules(input.duration, CA_DURATION_RULE_SET, CA_DURATION_FALLBACK);
  return { state, duration };
}
