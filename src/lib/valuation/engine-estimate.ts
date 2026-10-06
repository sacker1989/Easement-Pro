/**
 * The IRWA valuation engine, wired into the homeowner report.
 *
 * WHAT THIS IS. The report already carries a screening range
 * (screening-estimate.ts). This module works the same question a second way:
 * it runs the IRWA summation method — area x unit value x impact-tier
 * percentage — across the tier's full low–high bounds and reports the RANGE.
 * The section that renders it is titled "The same question, worked a second
 * way", and it sits BELOW "What this report does not tell you", never above
 * the limits.
 *
 * CONFLICT-NOTICE COMPLIANCE. valuation-matrix.ts carries an emphatic guard:
 * the percentage-of-fee method is the one Uniform Appraisal Standards §4.6.5
 * rejects for appraisals, and output derived from the matrix must never be
 * presented as market value, compensation, or an appraisal. This module
 * obeys it in full:
 *   - the figure is always a RANGE, never a point estimate. `pointEstimate`
 *     does not exist on the result type, so no caller can render one.
 *   - it is never called compensation, market value, or an appraisal in any
 *     copy this module emits.
 *   - it carries the module-mandated disclaimer, all three regime
 *     disclosures, and the federal-standard note in the same block.
 *   - engine output is kept OUT of the referral/handoff path — this module
 *     is rendered on the report page only and is never fed to
 *     buildReferralPackage.
 *   - remainder damages are taken as zero and STATED, not assumed: the
 *     Before-and-After leg, which would establish them, is deliberately not
 *     wired (it needs an appraiser's read of the remainder).
 *
 * TIER MAPPING. Each easement type is mapped to an IRWA impact tier, grounded
 * in the tier's own example text — not in this module's invention. Three
 * types refuse, with reasons, following the same exhaustiveness discipline as
 * SCREENING_BAND_BY_TYPE: the record is exhaustive over EasementType, so a
 * new type is a compile error here rather than a silent gap.
 */

import type { EasementType } from '@/lib/easements/easement-types';
import { EasementValuationCalculator } from './calculator';
import { IMPACT_TIERS } from './valuation-matrix';
import { ORIENTATION_ONLY_BANNER, THREE_REGIME_DISCLOSURE } from './screening-estimate';

type EngineTierKey = 'severe' | 'major' | 'moderate_high' | 'moderate_low';

interface TierMapping {
  readonly tier: EngineTierKey;
  /** Grounded in the tier's own example text. */
  readonly basis: string;
}

interface TierRefusal {
  readonly refusal: string;
}

function isRefusal(m: TierMapping | TierRefusal): m is TierRefusal {
  return 'refusal' in m;
}

/**
 * Easement type to IRWA impact tier, exhaustive by construction.
 *
 * A refusal is a real answer, not a gap: the area-based matrix does not
 * describe these three, and substituting a neighbouring tier would invent
 * the number.
 */
export const ENGINE_TIER_BY_TYPE = {
  'utility-overhead': {
    tier: 'severe',
    basis:
      'The severe tier names "overhead electric" explicitly as its example of severe impact ' +
      'on surface use and conveyance of future uses.',
  },
  pipeline: {
    tier: 'major',
    basis:
      'The major tier names "pipelines" explicitly as its example of major impact on surface ' +
      'use and conveyance of future uses.',
  },
  'storm-drain': {
    tier: 'major',
    basis:
      'The major tier names "drainage" explicitly as its example of major impact on surface use.',
  },
  drainage: {
    tier: 'major',
    basis:
      'The major tier names "drainage" explicitly as its example of major impact on surface use.',
  },
  sewer: {
    tier: 'moderate_low',
    basis:
      'The moderate-low tier names "water/sewer" explicitly as its example of a minor utility ' +
      'along a property line or setback.',
  },
  'water-line': {
    tier: 'moderate_low',
    basis:
      'The moderate-low tier names "water/sewer" explicitly as its example of a minor utility ' +
      'along a property line or setback.',
  },
  'utility-underground': {
    tier: 'moderate_low',
    basis:
      'The moderate-low tier names "minor utility (e.g. water/sewer, cable, telecom)" — the ' +
      'buried-utility case with little surface impact.',
  },
  'access-ingress-egress': {
    tier: 'moderate_high',
    basis:
      'The moderate-high tier names "ingress/egress rights" explicitly as its example of some ' +
      'impact on surface use.',
  },
  'public-right-of-way': {
    tier: 'major',
    basis:
      'Judgment call: a public right of way across frontage has major impact on surface use — ' +
      'the travelled way plus the setback it sterilizes — closest to the major tier\'s ' +
      '"major impact on surface use" description. Flagged for founder review.',
  },
  slope: {
    refusal:
      'No IRWA tier fits a slope easement. Slope easements usually restrict excavation and ' +
      'loading rather than occupation, so their effect on value does not scale with area the ' +
      'way the tier percentages assume.',
  },
  conservation: {
    refusal:
      'No IRWA tier fits a conservation easement. It restricts the whole parcel by the terms ' +
      'of its own instrument rather than a strip, and any percentage would be a share of ' +
      'development value — what the land would be worth if it could be developed — which this ' +
      'product has no way to establish.',
  },
  prescriptive: {
    refusal:
      'No IRWA tier fits a prescriptive easement. Its scope is genuinely uncertain until ' +
      'established — there is no recorded area and no settled allocation of rights to apply ' +
      'a percentage to.',
  },
} satisfies Record<EasementType, TierMapping | TierRefusal>;

export interface EngineRange {
  readonly status: 'range';
  readonly low: number;
  readonly high: number;
  readonly lowPercent: number;
  readonly highPercent: number;
  readonly tierName: string;
  readonly derivation: string;
  readonly caveats: readonly string[];
}

export interface EngineRefused {
  readonly status: 'refused';
  readonly reason: string;
}

export interface EngineInsufficientData {
  readonly status: 'insufficient-data';
  readonly reason: string;
  readonly missing: readonly string[];
}

export type EngineEstimateResult = EngineRange | EngineRefused | EngineInsufficientData;

export interface EngineEstimateInputs {
  readonly easementType: EasementType;
  /** Assessed land value per square foot. Null when no county record matched. */
  readonly landValuePerSqFt: number | null;
  readonly easementAreaSqFt: number;
  readonly totalPropertyAreaSqFt: number;
}

/** The federal-standard note the conflict notice requires in the same block. */
export const ENGINE_FEDERAL_NOTE =
  'The controlling federal standard (Uniform Appraisal Standards for Federal Land ' +
  'Acquisitions §4.6.5) rejects percentage-of-fee as an appraisal method: the correct ' +
  'measure it names is the value of the whole property before the easement minus its ' +
  'value afterwards. That comparison requires a licensed appraiser looking at your ' +
  'specific property. This section shows the IRWA percentage method anyway — the same ' +
  'question worked a second way — so read it as orientation, the way the screening range ' +
  'above is. It is not market value, not compensation, and not an appraisal.';

const fmt = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Runs the IRWA summation method across the tier's low–high bounds and
 * returns the range. Never a point estimate.
 *
 * Refusal and insufficient-data are ordinary outcomes, not errors — three of
 * the twelve types have no fitting tier, and a parcel with no county match
 * has no land value. Nothing is defaulted or assumed.
 */
export function engineEstimate(inputs: EngineEstimateInputs): EngineEstimateResult {
  const mapping = ENGINE_TIER_BY_TYPE[inputs.easementType];
  if (isRefusal(mapping)) {
    return { status: 'refused', reason: mapping.refusal };
  }

  const missing: string[] = [];
  const landValue = inputs.landValuePerSqFt;
  if (landValue === null || !Number.isFinite(landValue) || landValue <= 0) {
    missing.push('land value per square foot (no county assessment matched this address)');
  }
  const area = inputs.easementAreaSqFt;
  const total = inputs.totalPropertyAreaSqFt;
  if (!Number.isFinite(area) || area <= 0) {
    missing.push('a usable easement area in square feet');
  } else if (Number.isFinite(total) && total > 0 && area > total) {
    missing.push('an easement area no larger than the lot itself');
  }
  if (!Number.isFinite(total) || total <= 0) {
    missing.push('a usable lot area in square feet');
  }

  if (missing.length > 0 || landValue === null) {
    return {
      status: 'insufficient-data',
      reason:
        'The second calculation needs a land value per square foot and the two areas, and ' +
        'one of them is missing. Nothing is substituted — a guessed input would produce a ' +
        'guessed range, which is worse than no range.',
      missing,
    };
  }

  const tier = IMPACT_TIERS[mapping.tier];
  if (tier === undefined) {
    throw new Error(
      `ENGINE_TIER_BY_TYPE maps to tier "${mapping.tier}" but IMPACT_TIERS has no such tier. ` +
        'These two must not drift apart.',
    );
  }
  const calc = new EasementValuationCalculator(total, 'sq ft', landValue);
  // Explicit bounds, never the midpoint: resolveImpactPercentage would
  // average the tier, and an average invites being read as the answer.
  const lowResult = calc.summationMethod(area, mapping.tier, 0, tier.lowPercent);
  const highResult = calc.summationMethod(area, mapping.tier, 0, tier.highPercent);

  const derivation =
    `IRWA impact tier "${tier.name}" (${tier.lowPercent}\u2013${tier.highPercent}% of the strip\u2019s ` +
    `land value), applied to ${area.toLocaleString('en-US')} sq ft at ${fmt(landValue)}/sq ft. ` +
    `Remainder damages taken as zero — stated, not assumed: the Before-and-After leg that would ` +
    `establish them needs an appraiser\u2019s read of the remainder, which this product does not ` +
    `have, so it is deliberately not computed.`;

  return {
    status: 'range',
    low: lowResult.totalCompensation,
    high: highResult.totalCompensation,
    lowPercent: tier.lowPercent,
    highPercent: tier.highPercent,
    tierName: tier.name,
    derivation,
    caveats: [
      ORIENTATION_ONLY_BANNER,
      THREE_REGIME_DISCLOSURE.valuation,
      THREE_REGIME_DISCLOSURE.legal,
      THREE_REGIME_DISCLOSURE.advertising,
      ENGINE_FEDERAL_NOTE,
    ],
  };
}
