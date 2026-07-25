import {
  resolveStateCompliance,
  type StateComplianceEntry,
  type StateComplianceMatrix,
} from '@/lib/gating/state-tier-config';

/**
 * The single populated state-compliance matrix for the whole app. Phase 1
 * MVP ships with California as the only Tier A entry — per
 * docs/development-strategy-v2.md: "no state beyond CA should be enabled for
 * Track 1 until [counsel] review is done."
 *
 * Adding a state later should mean adding an entry here, not touching gating
 * logic elsewhere in the app.
 */
export const STATE_COMPLIANCE_MATRIX: StateComplianceMatrix = {
  CA: {
    state: 'CA',
    tier: 'A',
    track1RequiredFlow: 'licensed-pathway',
    track2Available: true,
    basis: 'Legal Document Assistant statute, Cal. Bus. & Prof. Code §6400 et seq.',
    lastReviewedDate: null,
    notes:
      "Phase 1 MVP's only Tier A entry. lastReviewedDate must be set once counsel " +
      'sign-off is actually recorded — do not treat this entry as reviewed until then.',
  },
};

export function getStateCompliance(stateCode: string): StateComplianceEntry {
  return resolveStateCompliance(STATE_COMPLIANCE_MATRIX, stateCode);
}
