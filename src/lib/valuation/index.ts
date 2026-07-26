export {
  IMPACT_TIERS,
  resolveImpactPercentage,
  type ImpactTier,
} from './valuation-matrix';
export {
  EasementValuationCalculator,
  type BeforeAndAfterResult,
  type SummationResult,
  type ValuationResult,
} from './calculator';
export {
  mapJurisdictionToConfidence,
  suggestNextStepByJurisdiction,
  valuationConfidenceToTieredResult,
  type JurisdictionalConfidenceLevel,
  type JurisdictionalValuationContext,
} from './jurisdiction-valuation-bridge';
