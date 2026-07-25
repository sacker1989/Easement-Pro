/**
 * Three-tier state compliance schema used to gate Track 1 (Advocacy Wizard)
 * feature availability. See docs/development-strategy-v2.md, "Licensing &
 * State Compliance Agent" section, for the legal reasoning behind this schema.
 *
 * This file owns the schema and gating logic only — it has no data in it.
 * The actual populated matrix (just California for Phase 1) lives in
 * src/config/state-tiers.ts, so adding a state later is a data change there,
 * not a code change here.
 */

export type StateTier = 'A' | 'B' | 'C' | 'UNCLASSIFIED';

export type Track1RequiredFlow =
  | 'licensed-pathway' // Tier A: must run through a licensed/certified relationship
  | 'mandatory-review' // Tier B: mandatory (non opt-in) attorney review before send
  | 'unavailable'; // Tier C / UNCLASSIFIED: Track 1 is not offered at all

export interface StateComplianceEntry {
  /** Two-letter USPS state code, e.g. "CA". */
  state: string;
  tier: StateTier;
  track1RequiredFlow: Track1RequiredFlow;
  /** Track 2 (Request for Clarification) is available nationwide in MVP scope. */
  track2Available: true;
  /** Statute or licensing program this classification rests on, for the audit trail. */
  basis: string | null;
  /** ISO date of last counsel review, or null if this state has never been reviewed. */
  lastReviewedDate: string | null;
  notes?: string;
}

export type StateComplianceMatrix = Readonly<Record<string, StateComplianceEntry>>;

/**
 * Default entry for any state not present in the matrix. Gates the same as
 * Tier C (Track 1 unavailable), but this is an absence-of-review default, not
 * a legal determination that the state restricts or prohibits non-attorney
 * document preparation — those are structurally different claims per the
 * strategy doc's framing note.
 */
export function unclassifiedState(stateCode: string): StateComplianceEntry {
  return {
    state: stateCode,
    tier: 'UNCLASSIFIED',
    track1RequiredFlow: 'unavailable',
    track2Available: true,
    basis: null,
    lastReviewedDate: null,
    notes:
      'Not yet reviewed by counsel. Gates the same as Tier C (Track 1 unavailable), ' +
      'but this is an absence-of-review default, not a legal determination that the ' +
      'state restricts or prohibits non-attorney document preparation.',
  };
}

export function resolveStateCompliance(
  matrix: StateComplianceMatrix,
  stateCode: string,
): StateComplianceEntry {
  const normalized = stateCode.trim().toUpperCase();
  return matrix[normalized] ?? unclassifiedState(normalized);
}

export function isTrack1Available(entry: StateComplianceEntry): boolean {
  return entry.track1RequiredFlow !== 'unavailable';
}
