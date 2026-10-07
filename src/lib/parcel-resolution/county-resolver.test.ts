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

describe('the three counties with live providers are all reachable', () => {
  const at = (zip: string, state = 'CA') =>
    zipHeuristicCountyResolver.resolve({
      street: '1 Main St',
      city: 'X',
      state,
      zip,
      zipPlus4: null,
    });

  it('resolves Orange County ZIPs', () => {
    // Before this, Anaheim resolved to null and /report reported "no provider
    // built for this county" for a county whose provider works.
    expect(at('92801')).toBe('Orange'); // Anaheim
    expect(at('92626')).toBe('Orange'); // Costa Mesa
    expect(at('92602')).toBe('Orange'); // Irvine
  });

  it('resolves San Diego County ZIPs', () => {
    expect(at('92020')).toBe('San Diego'); // El Cajon
    expect(at('92101')).toBe('San Diego'); // San Diego city
    expect(at('91910')).toBe('San Diego'); // Chula Vista
  });

  it('still resolves LA County ZIPs', () => {
    expect(at('91304')).toBe('Los Angeles'); // Canoga Park
    expect(at('90012')).toBe('Los Angeles'); // downtown LA
  });

  it('gives Orange County enclaves inside the LA band to Orange', () => {
    // 90620 and 90720 sit inside the LA range 90001-90899. Testing LA first
    // would claim Buena Park and Seal Beach for the wrong county, and the
    // wrong county means the wrong assessor service.
    expect(at('90620')).toBe('Orange'); // Buena Park
    expect(at('90720')).toBe('Orange'); // Los Alamitos
  });

  it('returns null outside California rather than guessing', () => {
    expect(at('78701', 'TX')).toBeNull();
  });
});

describe('Illinois, added with Cook County', () => {
  const resolve = (zip: string, state = 'IL') =>
    zipHeuristicCountyResolver.resolve({
      street: '1 Test St',
      city: 'Chicago',
      state,
      zip,
    } as never);

  it('routes Chicago ZIPs to Cook', () => {
    for (const zip of ['60601', '60614', '60707']) {
      expect(resolve(zip), zip).toBe('Cook');
    }
  });

  it('routes suburban Cook ZIPs to Cook', () => {
    for (const zip of ['60005', '60302', '60805']) {
      expect(resolve(zip), zip).toBe('Cook');
    }
  });

  it('returns null for an Illinois ZIP outside the ranges', () => {
    // A collar-county address gets the national-benchmark path rather than a
    // neighbouring county's figures. Null is the honest answer, not a gap.
    for (const zip of ['60540', '61820', '62701']) {
      expect(resolve(zip), zip).toBeNull();
    }
  });

  it('does not let an Illinois ZIP resolve under a California state code', () => {
    // The branch is keyed on state, so a 606xx typed with state CA must not
    // fall through to the LA ranges and claim a Chicago parcel.
    expect(resolve('60601', 'CA')).toBeNull();
  });

  it('leaves California resolution unchanged', () => {
    expect(resolve('90049', 'CA')).toBe('Los Angeles');
    expect(resolve('92651', 'CA')).toBe('Orange');
  });
});
