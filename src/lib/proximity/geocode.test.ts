import { describe, expect, it } from 'vitest';
import { CENSUS_BENCHMARK, GEOCODE_DISCLOSURE, geocodeAddress } from './geocode';

const NOW = () => new Date('2026-10-05T00:00:00Z');
const ADDRESS = {
  street: '1200 Getty Center Dr',
  city: 'Los Angeles',
  state: 'CA',
  zip: '90049',
};

function stub(payload: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch;
}

const MATCH = {
  result: {
    addressMatches: [
      {
        matchedAddress: '1200 GETTY CENTER DR, LOS ANGELES, CA, 90049',
        coordinates: { x: -118.476107817724, y: 34.083073315438 },
      },
    ],
  },
};

describe('geocodeAddress', () => {
  it('reads x as longitude and y as latitude', async () => {
    // THE DEFECT THIS PINS. A reversed pair is a valid coordinate somewhere
    // else on earth, so the flood lookup returns a confident answer for the
    // wrong place rather than failing. Nothing downstream can detect it.
    const result = await geocodeAddress({ ...ADDRESS, now: NOW, fetchImpl: stub(MATCH) });
    expect(result.kind).toBe('matched');
    if (result.kind !== 'matched') return;
    expect(result.lat).toBeCloseTo(34.083, 3);
    expect(result.lon).toBeCloseTo(-118.476, 3);
    // California: north of the equator, west of Greenwich.
    expect(result.lat).toBeGreaterThan(0);
    expect(result.lon).toBeLessThan(0);
  });

  it('returns the address the geocoder thinks it matched', async () => {
    // Shown to the user. An interpolated point is only as good as the match,
    // and the match is the one part a homeowner can check themselves.
    const result = await geocodeAddress({ ...ADDRESS, now: NOW, fetchImpl: stub(MATCH) });
    if (result.kind !== 'matched') throw new Error('expected matched');
    expect(result.matchedAddress).toContain('GETTY CENTER DR');
  });

  it('sends a pinned benchmark so a result is reproducible', async () => {
    let seen = '';
    const spy = (async (url: string) => {
      seen = url;
      return new Response(JSON.stringify(MATCH), { status: 200 });
    }) as unknown as typeof fetch;

    await geocodeAddress({ ...ADDRESS, now: NOW, fetchImpl: spy });
    expect(seen).toContain(`benchmark=${CENSUS_BENCHMARK}`);
    expect(seen).toContain('1200+Getty+Center+Dr%2C+Los+Angeles%2C+CA%2C+90049');
  });

  it('omits empty address parts rather than sending stray commas', async () => {
    let seen = '';
    const spy = (async (url: string) => {
      seen = url;
      return new Response(JSON.stringify({ result: { addressMatches: [] } }), { status: 200 });
    }) as unknown as typeof fetch;

    await geocodeAddress({ street: '1 Main St', city: '', state: 'CA', zip: '', now: NOW, fetchImpl: spy });
    expect(seen).toContain('1+Main+St%2C+CA');
    expect(seen).not.toContain('%2C%2C');
  });

  describe('degrading without taking the report down', () => {
    it('reports no match on an empty result', async () => {
      const result = await geocodeAddress({
        ...ADDRESS,
        now: NOW,
        fetchImpl: stub({ result: { addressMatches: [] } }),
      });
      expect(result.kind).toBe('no-match');
    });

    it('reports no match when coordinates are missing from a match', async () => {
      const result = await geocodeAddress({
        ...ADDRESS,
        now: NOW,
        fetchImpl: stub({ result: { addressMatches: [{ matchedAddress: 'somewhere' }] } }),
      });
      expect(result.kind).toBe('no-match');
    });

    it('reports no match for an empty address rather than querying', async () => {
      let called = false;
      const spy = (async () => {
        called = true;
        return new Response('{}', { status: 200 });
      }) as unknown as typeof fetch;

      const result = await geocodeAddress({
        street: '  ',
        city: '',
        state: '',
        zip: '',
        now: NOW,
        fetchImpl: spy,
      });
      expect(result.kind).toBe('no-match');
      expect(called).toBe(false);
    });

    it('does not throw when the Census service is down', async () => {
      const thrower = (async () => {
        throw new Error('ETIMEDOUT');
      }) as unknown as typeof fetch;

      const result = await geocodeAddress({ ...ADDRESS, now: NOW, fetchImpl: thrower });
      expect(result.kind).toBe('lookup-failed');
      if (result.kind !== 'lookup-failed') return;
      expect(result.reason).toBe('ETIMEDOUT');
    });

    it('reports an HTTP failure', async () => {
      const result = await geocodeAddress({ ...ADDRESS, now: NOW, fetchImpl: stub({}, 500) });
      expect(result.kind).toBe('lookup-failed');
    });
  });
});

describe('the disclosure', () => {
  it('says it interpolates rather than finding the building', () => {
    // The limitation that matters when a zone boundary runs nearby, which is
    // exactly when a homeowner most wants to trust the answer.
    expect(GEOCODE_DISCLOSURE).toMatch(/interpolates/i);
    expect(GEOCODE_DISCLOSURE).toMatch(/rather than finding your roof/i);
    expect(GEOCODE_DISCLOSURE).toMatch(/boundary runs nearby/i);
  });

  it('asks the user to check the matched address', () => {
    expect(GEOCODE_DISCLOSURE).toMatch(/check that the matched address/i);
  });
});
