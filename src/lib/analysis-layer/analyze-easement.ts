import { classifyByRules, type TieredResult } from './confidence-tiering';
// State-agnostic on purpose: this is the multi-state entry point, so its
// result type must not be narrowed to one state's doctrine.
import type { DurationDetermination } from './duration-basis';
import type { EasementDurationFacts } from './duration-facts';
import { registeredRuleSet, resolveStateRuleSet, resolveStateRuleSetAt } from './registry';
import type { RuleSetResolution } from './rule-set';

/**
 * Retained and NARROWED to genuine programmer error.
 *
 * It used to mean "no rule set for this state", which is an ordinary fact
 * about the world and now returns a flagged result. It now means only that
 * the caller passed something that is not a state code at all.
 */
export class UnsupportedStateRuleSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedStateRuleSetError';
  }
}

export interface EasementAnalysisInput {
  /** Two-letter USPS state code. */
  state: string;
  duration: EasementDurationFacts;
}

export interface EasementAnalysisResult {
  readonly state: string;
  /** Why the rules ran, or why they did not. Carried so the UI and audit can branch. */
  readonly ruleSet: RuleSetResolution;
  readonly duration: TieredResult<DurationDetermination>;
}

/** The rule id the UI and the audit trail branch on. Distinct on purpose. */
export const UNAVAILABLE_RULE_ID = 'state-rule-set-unavailable';

function unavailableResult(
  state: string,
  reason: string,
): Extract<TieredResult<DurationDetermination>, { tier: 'flagged-ambiguous' }> {
  return {
    tier: 'flagged-ambiguous',
    ruleId: UNAVAILABLE_RULE_ID,
    flagReason:
      `Easement duration is governed by ${state} law, and this product has no counsel-reviewed ` +
      `rule set for ${state} (${reason}). No determination is offered. This is an absence of ` +
      `review, not a finding that the easement itself is ambiguous.`,
  };
}

/**
 * Runs the Analysis Layer's confidence-tiering gate.
 *
 * BEHAVIOUR CHANGE, PHASE 3. This used to throw for any state but CA. Throwing
 * is not degrading: it forced every caller into a try/catch and produced no
 * user-facing tiered result, when what the product needs is a
 * `flagged-ambiguous` the existing three-state display already renders.
 *
 * AND CALIFORNIA NOW DEGRADES TOO. The CA entry has no review record, so it
 * resolves `unavailable` exactly as Texas does. That is the honest application
 * of the gate rather than a regression — the previous behaviour asserted a
 * California determination on the strength of a rule set nobody had reviewed.
 *
 * WHEN UNAVAILABLE, NO RULE IS EVALUATED. Not evaluated and discarded —
 * unreached. A rule set that cannot be trusted to produce a conclusion cannot
 * be trusted to produce a flag REASON either, and evaluating it anyway invites
 * a later refactor to start reading the result.
 */
export function analyzeEasement(input: EasementAnalysisInput): EasementAnalysisResult {
  return analyzeEasementAt(input, new Date().toISOString().slice(0, 10));
}

/** As `analyzeEasement`, with the date supplied. For tests and deterministic audits. */
export function analyzeEasementAt(
  input: EasementAnalysisInput,
  today: string,
): EasementAnalysisResult {
  const state = input.state.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(state)) {
    throw new UnsupportedStateRuleSetError(
      `"${input.state}" is not a two-letter state code. This is a programmer error rather than an ` +
        'unsupported jurisdiction — a state with no rule set returns a flagged result instead.',
    );
  }

  const ruleSet = resolveStateRuleSetAt(state, today);

  if (ruleSet.status === 'unavailable') {
    // PARTIAL OPERATION IN AN UNREVIEWED STATE.
    //
    // The gate blocks claims about the LAW. It was also blocking claims about
    // the DOCUMENT, which is a different thing and needs no review: "your
    // instrument contains the word perpetual and states no term" is a reading
    // any careful person would agree with, holds identically in every
    // jurisdiction, and asserts nothing about what the law does with it.
    // Blocking both together told a homeowner holding an instrument that
    // plainly answers their question that nothing could be determined.
    //
    // So where an entry EXISTS but is unreviewed, its observation rules run
    // and its doctrine rules do not. Where no entry exists at all there is
    // nothing to run, reviewed or otherwise.
    const entry = registeredRuleSet(state);
    if (entry !== undefined) {
      const observationOnly = entry.durationRules.filter((r) => r.claimType === 'observation');
      const result = classifyByRules(input.duration, observationOnly, entry.durationFallback);
      // The fallback fires when no observation rule matched, which means the
      // answer depends on doctrine. That is the unreviewed case, and it must
      // say so rather than reporting the state's generic fallback copy.
      if (result.ruleId !== 'fallback-no-rule-matched') {
        return { state, ruleSet, duration: result };
      }
    }
    return { state, ruleSet, duration: unavailableResult(state, ruleSet.reason) };
  }

  const duration = classifyByRules(
    input.duration,
    ruleSet.ruleSet.durationRules,
    ruleSet.ruleSet.durationFallback,
  );
  return { state, ruleSet, duration };
}

export { resolveStateRuleSet };
