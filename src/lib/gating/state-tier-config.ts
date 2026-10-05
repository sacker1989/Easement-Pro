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

import type { RegulatoryBasis } from './regulatory-basis';

declare const stateTierBrand: unique symbol;

/**
 * A state's UPL / licensing classification for Track 1 availability.
 *
 * BRANDED DELIBERATELY. EvidenceTier in src/lib/easements/evidence-tier.ts is
 * also literally 'A' | 'B' | 'C' and means something entirely unrelated — how
 * close infrastructure sits to a parcel boundary. Unbranded, the two are
 * mutually assignable and confusing them would silently mis-gate a regulated,
 * paid feature. Construct via stateTier().
 */
export type StateTier = ('A' | 'B' | 'C' | 'UNCLASSIFIED') & {
  readonly [stateTierBrand]: true;
};

/** The only sanctioned way to make a StateTier. */
export function stateTier(t: 'A' | 'B' | 'C' | 'UNCLASSIFIED'): StateTier {
  return t as StateTier;
}

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
  /**
   * Statute or licensing program this classification rests on.
   *
   * STRUCTURED RATHER THAN FREE TEXT SINCE FREE MODE. A string could say
   * "Cal. Bus. & Prof. Code §6400 et seq." and could not say that §6400 stops
   * reaching a product that charges nothing, because compensation is an
   * element of its definition. See regulatory-basis.ts — including why a
   * lapsed basis is good news and still needs recording.
   */
  basis: readonly RegulatoryBasis[] | null;
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
    tier: stateTier('UNCLASSIFIED'),
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
