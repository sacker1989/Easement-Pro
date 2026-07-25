/**
 * IRWA Easement Valuation Matrix
 * Source: Donnie Sherwood, SR/WA, MAI, FRICS — "Valuation of Easements" (IRWA methodology)
 * Maps easement impact tiers to percentage-of-fee-value ranges for automated appraisal.
 * Phase 2: integration point between risk disclosure (step 3) and valuation (step 3.5).
 */

export interface ImpactTier {
  readonly name: string;
  readonly description: string;
  readonly lowPercent: number;
  readonly highPercent: number;
}

export const IMPACT_TIERS: Record<string, ImpactTier> = {
  severe: {
    name: 'Severe',
    description:
      'Severe impact on surface use, conveyance of future uses (e.g., overhead electric, flowage, major rail/canal)',
    lowPercent: 90,
    highPercent: 100,
  },
  major: {
    name: 'Major',
    description:
      'Major impact on surface use, conveyance of future uses (e.g., pipelines, drainage, flowage)',
    lowPercent: 75,
    highPercent: 89,
  },
  moderate_high: {
    name: 'Moderate-High',
    description: 'Some impact on surface use, ingress/egress rights (e.g., pipelines, scenic)',
    lowPercent: 51,
    highPercent: 74,
  },
  balanced: {
    name: 'Balanced',
    description: 'Balanced use by owner and holder (e.g., sewer/water lines 50/50 split)',
    lowPercent: 50,
    highPercent: 50,
  },
  moderate_low: {
    name: 'Moderate-Low',
    description:
      'Location along property line/setback, minor utility (e.g., water/sewer, cable, telecom)',
    lowPercent: 26,
    highPercent: 49,
  },
  minor: {
    name: 'Minor',
    description:
      'Nominal effect, air/water/sewer with minimal utility disruption',
    lowPercent: 11,
    highPercent: 25,
  },
  minimal: {
    name: 'Minimal',
    description: 'Small subsurface easement, zero to negligible surface impact',
    lowPercent: 0,
    highPercent: 10,
  },
};

/**
 * Resolve the percentage-of-fee-value for a given impact tier.
 * If custom percentage is provided, use it; otherwise use the midpoint of the tier range.
 */
export function resolveImpactPercentage(
  impactTier: string,
  customPercentage?: number,
): number {
  if (customPercentage !== undefined) {
    if (customPercentage < 0 || customPercentage > 100) {
      throw new RangeError('Custom percentage must be between 0 and 100');
    }
    return customPercentage;
  }

  const tier = IMPACT_TIERS[impactTier];
  if (!tier) {
    throw new Error(
      `Invalid impact tier "${impactTier}". Choose from: ${Object.keys(IMPACT_TIERS).join(', ')}`,
    );
  }

  return (tier.lowPercent + tier.highPercent) / 2;
}
