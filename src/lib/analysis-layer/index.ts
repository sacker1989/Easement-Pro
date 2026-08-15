export {
  classifyByRules,
  type ConfidenceRule,
  type ConfidenceTier,
  type TieredResult,
} from './confidence-tiering';
export {
  CA_DURATION_FALLBACK,
  CA_DURATION_RULE_SET,
  type DurationBasis,
  type DurationDetermination,
  type EasementDurationFacts,
  type EasementLegalCharacter,
} from './ca-rule-set';
export {
  analyzeEasement,
  UnsupportedStateRuleSetError,
  type EasementAnalysisInput,
  type EasementAnalysisResult,
} from './analyze-easement';
