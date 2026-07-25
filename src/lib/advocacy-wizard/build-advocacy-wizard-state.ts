import { analyzeEasement, type DurationDetermination, type EasementDurationFacts } from '@/lib/analysis-layer';
import { evaluateAdvocacyWizardAccess, type AdvocacyWizardAccessDecision } from '@/lib/gating/advocacy-wizard-access';
import { getStateCompliance } from '@/config/state-tiers';
import { gateWizardField, type WizardFieldGateResult } from './gate-wizard-field';

export interface AdvocacyWizardInput {
  state: string;
  duration: EasementDurationFacts;
}

export interface AdvocacyWizardFields {
  duration: WizardFieldGateResult<DurationDetermination>;
}

export interface AdvocacyWizardState {
  access: AdvocacyWizardAccessDecision;
  /** null when the wizard isn't available in this state — nothing to gate per-field yet. */
  fields: AdvocacyWizardFields | null;
}

/**
 * Combines the two gating layers into the state the wizard UI needs: whether
 * Track 1 is offered at all here (state-level), and if so, the per-field
 * gate results for each wizard field (currently just duration — more fields
 * plug in the same way as the Analysis Layer grows past Phase 1 MVP).
 *
 * Assumes analysis-layer has a rule set for any state this wizard makes
 * available; true for Phase 1 MVP since only CA is Tier A and CA is the only
 * rule set implemented. Adding a Tier A/B state without its rule set would
 * need this assumption revisited.
 */
export function buildAdvocacyWizardState(input: AdvocacyWizardInput): AdvocacyWizardState {
  const stateCompliance = getStateCompliance(input.state);
  const access = evaluateAdvocacyWizardAccess(stateCompliance);

  if (!access.available) {
    return { access, fields: null };
  }

  const analysis = analyzeEasement({ state: stateCompliance.state, duration: input.duration });
  const duration = gateWizardField('Easement duration', analysis.duration);

  return { access, fields: { duration } };
}
