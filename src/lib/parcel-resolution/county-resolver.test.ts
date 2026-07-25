import { describe, expect, it } from 'vitest';
import { zipHeuristicCountyResolver } from './county-resolver';
import { normalizeAddress } from './normalize-address';

describe('zipHeuristicCountyResolver', () => {
  it('resolves a CA ZIP in the LA basin range to Los Angeles', () => {
    const address = normalizeAddress({
      street: '100 Main St',
      city: 'Beverly Hills',
      state: 'CA',
      zip: '90210',
    });
    expect(zipHeuristicCountyResolver.resolve(address)).toBe('Los Angeles');
  });

  it('returns null for a CA ZIP outside the known LA County ranges', () => {
    const address = normalizeAddress({
      street: '1 Market St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94103',
    });
    expect(zipHeuristicCountyResolver.resolve(address)).toBeNull();
  });

  it('does not match an LA-range ZIP number outside California', () => {
    const address = normalizeAddress({
      street: '100 Main St',
      city: 'Somewhere',
      state: 'TX',
      zip: '90210',
    });
    expect(zipHeuristicCountyResolver.resolve(address)).toBeNull();
  });

  it('prefers an explicit county over the ZIP heuristic', () => {
    const address = normalizeAddress({
      street: '1 Market St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94103',
      county: 'San Francisco',
    });
    expect(zipHeuristicCountyResolver.resolve(address)).toBe('San Francisco');
  });
});
