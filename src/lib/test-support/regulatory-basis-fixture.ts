/**
 * Throwaway RegulatoryBasis values for tests that need a well-formed entry and
 * do not care what statute it names.
 *
 * DELIBERATELY NOT THE REAL CALIFORNIA BASES. Those live in
 * src/config/state-tiers.ts and a test asserting against them should import
 * them from there, so that editing the real entry breaks the test that depends
 * on it. A fixture that shadowed the real data would let the two drift and
 * report green while doing it.
 */

import type { RegulatoryBasis } from '@/lib/gating/regulatory-basis';

/** A basis with a compensation element, so free mode lapses it. */
export const FIXTURE_COMPENSATION_BASIS: RegulatoryBasis = {
  citation: 'Test Code §1 (fixture)',
  regime: 'document-assistant',
  compensationIsAnElement: true,
  hasCompliancePath: true,
  note: 'Test fixture. Not a real statute.',
};

/** A basis with no compensation element, so free mode does nothing to it. */
export const FIXTURE_UPL_BASIS: RegulatoryBasis = {
  citation: 'Test Code §2 (fixture)',
  regime: 'unauthorized-practice',
  compensationIsAnElement: false,
  hasCompliancePath: false,
  note: 'Test fixture. Not a real statute.',
};

export const FIXTURE_BASES: readonly RegulatoryBasis[] = [
  FIXTURE_COMPENSATION_BASIS,
  FIXTURE_UPL_BASIS,
];
