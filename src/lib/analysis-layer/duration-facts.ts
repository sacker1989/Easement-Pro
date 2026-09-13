/**
 * State-neutral vocabulary for duration facts.
 *
 * WHY THIS IS NOT IN ca-rule-set.ts ANY MORE. `EasementDurationFacts` describes
 * what a DOCUMENT says — whether it contains perpetual language, whether it
 * states a term, whether the image was legible. Those are observations about a
 * piece of paper and they hold in any jurisdiction. They were declared beside
 * California's doctrinal outcomes, which meant every state added later would
 * have inherited California's vocabulary along with the neutral part.
 *
 * The doctrinal half stays in each state's own file. A state must be able to
 * say "this doctrine is not recognised here" without first importing a basis
 * value that presumes it is.
 */

/**
 * The LEGAL CHARACTER of an easement — how it is held and how it arose.
 *
 * Distinct from the PHYSICAL taxonomy in `src/lib/easements/easement-types.ts`,
 * which describes what the easement carries (sewer, drainage, overhead
 * utility). The two axes are orthogonal and both are needed: a sewer easement
 * may be appurtenant or in gross, and the valuation and doctrine questions
 * turn on different ones. Both were once exported as `EasementType`, which is
 * why this one is named for what it actually is.
 */
export type EasementLegalCharacter = 'appurtenant' | 'in-gross' | 'prescriptive' | 'unknown';

export interface EasementDurationFacts {
  easementType: EasementLegalCharacter;
  /** Document contains language like "perpetual", "forever", "runs with the land". */
  hasPerpetualLanguage: boolean;
  /** Document states a term ("for 20 years") or a condition subsequent ("until X occurs"). */
  hasTermOrConditionSubsequent: boolean;
  /** Whether the source document was legible enough to trust the two flags above. */
  documentLegible: boolean;
}
