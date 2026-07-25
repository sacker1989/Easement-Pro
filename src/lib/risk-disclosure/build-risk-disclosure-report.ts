import { buildEconomicImpactEstimate, type EconomicImpactEstimate } from './economic-impact';
import { buildRestrictionChecklist, type EasementPurpose, type RestrictionChecklistItem } from './restriction-checklist';

export class InvalidRiskDisclosureInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRiskDisclosureInputError';
  }
}

export interface RiskDisclosureInput {
  easementPurpose: EasementPurpose;
  lotAreaSqFt: number;
  easementAreaSqFt: number;
  /** Whether the address resolved (step 1) to LA County — drives the data-coverage label only. */
  isLaCounty: boolean;
  pricePerSqFtOverride?: number;
}

export interface RiskDisclosureReport {
  restrictionChecklist: RestrictionChecklistItem[];
  economicImpact: EconomicImpactEstimate;
}

/**
 * Track 3 risk-disclosure report. Available nationwide, always free — no
 * payment path exists for this feature, and no state/county gating applies
 * beyond the economic panel's data-coverage label (see economic-impact.ts).
 */
export function buildRiskDisclosureReport(input: RiskDisclosureInput): RiskDisclosureReport {
  if (!Number.isFinite(input.lotAreaSqFt) || input.lotAreaSqFt <= 0) {
    throw new InvalidRiskDisclosureInputError('lotAreaSqFt must be a positive number');
  }
  if (!Number.isFinite(input.easementAreaSqFt) || input.easementAreaSqFt <= 0) {
    throw new InvalidRiskDisclosureInputError('easementAreaSqFt must be a positive number');
  }
  if (input.easementAreaSqFt > input.lotAreaSqFt) {
    throw new InvalidRiskDisclosureInputError('easementAreaSqFt cannot exceed lotAreaSqFt');
  }

  return {
    restrictionChecklist: buildRestrictionChecklist(input.easementPurpose),
    economicImpact: buildEconomicImpactEstimate({
      lotAreaSqFt: input.lotAreaSqFt,
      easementAreaSqFt: input.easementAreaSqFt,
      isLaCounty: input.isLaCounty,
      pricePerSqFtOverride: input.pricePerSqFtOverride,
    }),
  };
}
