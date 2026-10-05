import { FIXTURE_BASES } from '@/lib/test-support/regulatory-basis-fixture';
import { stateTier } from '@/lib/gating/state-tier-config';
import { describe, expect, it } from 'vitest';
import {
  isTrack1Available,
  resolveStateCompliance,
  type StateComplianceMatrix,
} from './state-tier-config';

const testMatrix: StateComplianceMatrix = {
  CA: {
    state: 'CA',
    tier: stateTier('A'),
    track1RequiredFlow: 'licensed-pathway',
    track2Available: true,
    basis: FIXTURE_BASES,
    lastReviewedDate: '2026-01-01',
  },
};

describe('resolveStateCompliance', () => {
  it('returns the matrix entry for a populated state', () => {
    const entry = resolveStateCompliance(testMatrix, 'CA');
    expect(entry.tier).toBe('A');
    expect(isTrack1Available(entry)).toBe(true);
  });

  it('normalizes lowercase and whitespace in the state code', () => {
    expect(resolveStateCompliance(testMatrix, ' ca ').tier).toBe('A');
  });

  it('defaults an unpopulated state to UNCLASSIFIED with Track 1 unavailable', () => {
    const entry = resolveStateCompliance(testMatrix, 'TX');
    expect(entry.tier).toBe('UNCLASSIFIED');
    expect(entry.track1RequiredFlow).toBe('unavailable');
    expect(entry.track2Available).toBe(true);
    expect(isTrack1Available(entry)).toBe(false);
  });
});
