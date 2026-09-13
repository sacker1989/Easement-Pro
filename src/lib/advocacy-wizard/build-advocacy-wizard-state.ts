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
 * NO LONGER ASSUMES a rule set exists for every state this wizard makes
 * available. That assumption was stated here and was false for California
 * itself the moment Phase 3 applied the counsel-review gate honestly: CA is
 * Tier A for UPL purposes AND has an unreviewed rule set, so Track 1 is
 * available while the duration field is blocked.
 *
 * THESE ARE TWO SEPARATE GATES AND MUST NOT BE MERGED. state-tiers.ts answers
 * "may this product prepare a document for a fee in this state?", which is a
 * licensing question. The analysis registry answers "does this product know
 * this state's easement law well enough to state a conclusion?", which is a
 * substantive-law question. Different counsel, independent expiry, neither
 * implies the other — and all four combinations occur. `gateWizardField`
 * already blocks a flagged field, so the wizard degrades correctly on its own.
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
