/**
 * What every state entry must carry, and what resolving one returns.
 *
 * THE FIELDS ARE CHOSEN BECAUSE THEY GENUINELY DIFFER BY STATE. Easement
 * doctrine is state law: prescriptive periods vary, implied easement from
 * prior use and easement by necessity are DISTINCT doctrines that some states
 * recognise on different necessity standards, recording acts come in three
 * regimes that change who wins a priority contest, and marketable-title acts
 * extinguish ancient interests — except where easements are excepted, which is
 * usually the decisive nuance.
 *
 * IMPLIED-FROM-PRIOR-USE AND EASEMENT-BY-NECESSITY ARE SEPARATE FIELDS, and
 * merging them is the single most inviting mistake here. They share the word
 * "necessity" and nothing else: prior use turns on an apparent, continuous use
 * existing at severance, whereas necessity turns on landlocking and needs no
 * prior use at all. A state can recognise one and not the other, and can apply
 * strict necessity to one and reasonable necessity to the other.
 */

import type { ConfidenceRule, FlaggedFallback } from './confidence-tiering';
import type { DurationDetermination } from './duration-basis';
import type { EasementDurationFacts } from './duration-facts';
import type { ReviewRecord, StateLegalFact } from './legal-fact';

/**
 * Bumped when this interface gains or changes a field, which re-gates every
 * prior review. A reviewer confirmed the entry they read, not a later one.
 */
export const RULE_SET_SCHEMA_VERSION = 1;

export type { FlaggedFallback };

export interface StateEasementRuleSet {
  /** Two-letter USPS code, uppercase. */
  readonly state: string;
  readonly schemaVersion: number;
  readonly review: ReviewRecord | null;

  /** Statutory period for a prescriptive easement, in years. */
  readonly prescriptivePeriodYears: StateLegalFact<number>;

  /** Implied easement from prior use — the "quasi-easement". */
  readonly impliedFromPriorUse: StateLegalFact<{
    readonly recognised: boolean;
    readonly necessityStandard: 'strict' | 'reasonable';
  }>;

  /** Easement by necessity. A DISTINCT doctrine — see the module header. */
  readonly easementByNecessity: StateLegalFact<{
    readonly recognised: boolean;
    readonly necessityStandard: 'strict' | 'reasonable';
  }>;

  /** Recording-act regime; decides who wins a priority contest. */
  readonly recordingAct: StateLegalFact<'race' | 'notice' | 'race-notice'>;

  /** Marketable-title / ancient-interest cutoff, where it bears on survival. */
  readonly marketableTitle: StateLegalFact<{
    readonly actExists: boolean;
    readonly rootOfTitleYears: number | null;
    /** Whether easements are excepted from extinguishment. Usually decisive, usually nuanced. */
    readonly easementsExcepted: boolean;
  }>;

  /**
   * Ordered, and the ORDER IS REVIEWED CONTENT.
   *
   * `classifyByRules` is first-match-wins, so in the CA set
   * `ca-conflicting-duration-clauses` preceding both express rules is a legal
   * decision, not a stylistic one: it decides what a document containing both
   * perpetual language and a term produces. A state whose law resolves that
   * conflict the other way needs a different ORDER, not a different rule.
   */
  readonly durationRules: ReadonlyArray<
    ConfidenceRule<EasementDurationFacts, DurationDetermination>
  >;
  readonly durationFallback: FlaggedFallback<DurationDetermination>;
}

/**
 * The outcome of asking for a state's rule set.
 *
 * The five `unavailable` reasons gate identically and stay distinct anyway,
 * for the same reason `unclassifiedState()` separates UNCLASSIFIED from Tier
 * C: "we never reviewed this" and "the review went stale" are different
 * statements about the world, and the audit trail needs both.
 */
export type RuleSetResolution =
  | {
      readonly status: 'available';
      readonly ruleSet: StateEasementRuleSet;
      readonly review: ReviewRecord;
    }
  | {
      readonly status: 'unavailable';
      readonly state: string;
      readonly reason:
        | 'no-rule-set'
        | 'never-reviewed'
        | 'review-expired'
        | 'schema-superseded'
        | 'citations-changed';
      readonly explanation: string;
    };
