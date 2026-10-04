export {
  classifyByRules,
  type ConfidenceRule,
  type ConfidenceTier,
  type TieredResult,
} from './confidence-tiering';
export {
  CA_DURATION_FALLBACK,
  CA_DURATION_RULE_SET,
  type CaDurationBasis,
  type CaDurationDetermination,
  type EasementDurationFacts,
  type EasementLegalCharacter,
} from './ca-rule-set';
export {
  analyzeEasement,
  UnsupportedStateRuleSetError,
  type EasementAnalysisInput,
  type EasementAnalysisResult,
} from './analyze-easement';
export {
  type DurationDetermination,
  type ExpressDurationBasis,
} from './duration-basis';
export {
  FL_DURATION_FALLBACK,
  FL_DURATION_RULE_SET,
  FL_RULE_SET,
  type FlDurationBasis,
} from './rule-sets/fl';
/*
 * The registry is the supported way to reach a state, and it is exported
 * alongside the two concrete rule sets on purpose. A caller importing
 * CA_RULE_SET or FL_RULE_SET directly gets the entry WITHOUT the review gate —
 * fine for a test or a docket renderer, wrong for anything user-facing.
 * `analyzeEasement` above is what user-facing code wants.
 */
export { registeredStates, resolveStateRuleSet } from './registry';
export { type RuleSetResolution, type StateEasementRuleSet } from './rule-set';
