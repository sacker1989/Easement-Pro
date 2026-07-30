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
  calibratedRange,
  describeCalibration,
  isRangeInformative,
  CalibrationError,
  COMBINED_APE_PERCENTILES,
  REPORTABLE_COVERAGE,
  type CalibratedRange,
  type CoverageLevel,
} from './calibrated-range';
export {
  assessZipFitness,
  mayEmitEstimate,
  percentile,
  shareIqr,
  FAILING_ZIP_IQR,
  MIN_COHORT_SIZE,
  PROVISIONAL_IQR_THRESHOLD,
  SOUND_ZIP_IQR_RANGE,
  ZipFitnessError,
  type ZipFitness,
} from './zip-fitness-gate';
export {
  lookupEncumbranceFactor,
  BEFORE_AND_AFTER_METHODOLOGY_NOTE,
  ENCUMBRANCE_FACTORS,
  TTI_PIPELINE_CASE_EXAMPLE,
  type EncumbranceFactor,
  type FactorBasis,
  type FactorLookup,
} from './encumbrance-factors';
export {
  mapJurisdictionToConfidence,
  suggestNextStepByJurisdiction,
  valuationConfidenceToTieredResult,
  type JurisdictionalConfidenceLevel,
  type JurisdictionalValuationContext,
} from './jurisdiction-valuation-bridge';
