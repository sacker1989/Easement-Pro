import { describe, expect, it } from 'vitest';
import {
  BFE_NO_VALUE,
  FLOOD_ZONE_DISCLOSURE,
  floodImplication,
  lookupFloodZone,
  NFHL_FLOOD_ZONE_LAYER,
  type FloodZoneFound,
} from './flood-zone';

const NOW = () => new Date('2026-10-05T00:00:00Z');

function stub(payload: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch;
}

function featurePayload(attributes: Record<string, unknown>) {
  return { features: [{ attributes }] };
}

const LA = { lat: 34.09, lon: -118.47 };

describe('lookupFloodZone', () => {
  it('reads the zone, the service’s own description and the SFHA flag', async () => {
    const result = await lookupFloodZone({
      ...LA,
      now: NOW,
      fetchImpl: stub(
        featurePayload({
          FLD_ZONE: 'AE',
          ZONE_SUBTY: 'FLOODWAY',
          SFHA_TF: 'T',
          STATIC_BFE: 412.5,
        }),
      ),
    });

    expect(result).toEqual({
      kind: 'found',
      zone: 'AE',
      description: 'FLOODWAY',
      inSpecialFloodHazardArea: true,
      baseFloodElevationFt: 412.5,
      source: NFHL_FLOOD_ZONE_LAYER,
      queriedOn: '2026-10-05',
    });
  });

  it('maps FEMA’s -9999 sentinel to null rather than showing it', async () => {
    // Rendering "-9999 ft" to a homeowner is the kind of defect that survives
    // review because it looks like data. Every real Zone X response observed
    // carries this value.
    const result = await lookupFloodZone({
      ...LA,
      now: NOW,
      fetchImpl: stub(
        featurePayload({ FLD_ZONE: 'X', ZONE_SUBTY: null, SFHA_TF: 'F', STATIC_BFE: BFE_NO_VALUE }),
      ),
    });
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.baseFloodElevationFt).toBeNull();
    expect(result.description).toBeNull();
  });

  it('reads the SFHA flag rather than inferring it from the zone letter', async () => {
    // Deriving this would mean encoding the SFHA zone list from memory. The
    // service answers it, so the service is believed — including when the two
    // would disagree, which is what this fixture forces.
    const result = await lookupFloodZone({
      ...LA,
      now: NOW,
      fetchImpl: stub(featurePayload({ FLD_ZONE: 'X', SFHA_TF: 'T', STATIC_BFE: BFE_NO_VALUE })),
    });
    if (result.kind !== 'found') throw new Error('expected found');
    expect(result.inSpecialFloodHazardArea).toBe(true);
  });

  describe('degrading without taking the report down', () => {
    it('reports no coverage when NFHL has no polygon', async () => {
      const result = await lookupFloodZone({ ...LA, now: NOW, fetchImpl: stub({ features: [] }) });
      expect(result.kind).toBe('no-map-coverage');
    });

    it('treats a blank zone string as no coverage', async () => {
      const result = await lookupFloodZone({
        ...LA,
        now: NOW,
        fetchImpl: stub(featurePayload({ FLD_ZONE: '   ', SFHA_TF: 'F' })),
      });
      expect(result.kind).toBe('no-map-coverage');
    });

    it('catches an Esri error body served with HTTP 200', async () => {
      // Esri answers 200 with {error:{...}}. Every other provider here checks
      // for it; this one would otherwise report a successful lookup of nothing.
      const result = await lookupFloodZone({
        ...LA,
        now: NOW,
        fetchImpl: stub({ error: { message: 'Invalid or missing input parameters.' } }),
      });
      expect(result.kind).toBe('lookup-failed');
      if (result.kind !== 'lookup-failed') return;
      expect(result.reason).toContain('Invalid or missing input parameters');
    });

    it('does not throw when FEMA is down', async () => {
      // THE PROPERTY THAT MATTERS. Six other sections of the report are fine
      // without this one, and an outage at FEMA must not take them with it.
      const thrower = (async () => {
        throw new Error('ECONNRESET');
      }) as unknown as typeof fetch;

      const result = await lookupFloodZone({ ...LA, now: NOW, fetchImpl: thrower });
      expect(result.kind).toBe('lookup-failed');
      if (result.kind !== 'lookup-failed') return;
      expect(result.reason).toBe('ECONNRESET');
    });

    it('reports an HTTP failure rather than parsing it', async () => {
      const result = await lookupFloodZone({ ...LA, now: NOW, fetchImpl: stub({}, 503) });
      expect(result.kind).toBe('lookup-failed');
    });
  });

  it('throws only for a programmer error', async () => {
    await expect(lookupFloodZone({ lat: Number.NaN, lon: 0 })).rejects.toThrow(TypeError);
  });

  it('queries the point as a point, in WGS84', async () => {
    let seen = '';
    const spy = (async (url: string) => {
      seen = url;
      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await lookupFloodZone({ ...LA, now: NOW, fetchImpl: spy });
    // lon,lat order — reversing it silently returns a zone for the wrong
    // hemisphere rather than an error, which is the worst kind of bug here.
    expect(seen).toContain('geometry=-118.47%2C34.09');
    expect(seen).toContain('inSR=4326');
    expect(seen).toContain('returnGeometry=false');
  });
});

describe('floodImplication', () => {
  const base: FloodZoneFound = {
    kind: 'found',
    zone: 'X',
    description: null,
    inSpecialFloodHazardArea: false,
    baseFloodElevationFt: null,
    source: NFHL_FLOOD_ZONE_LAYER,
    queriedOn: '2026-10-05',
  };

  it('names the two costs inside a hazard area', () => {
    const text = floodImplication({ ...base, zone: 'AE', inSpecialFloodHazardArea: true });
    expect(text).toMatch(/insurance/i);
    expect(text).toMatch(/build/i);
  });

  it('treats levee-protected Zone X as its own case, not as minimal risk', () => {
    // THE DISTINCTION THIS FUNCTION EXISTS FOR. "Zone X, reduced risk due to
    // levee" is outside the SFHA and is not "Zone X, minimal hazard". The
    // protection is a structure that can be overtopped or decertified, and a
    // decertification moves every property behind it at once.
    const levee = floodImplication({
      ...base,
      description: 'AREA WITH REDUCED FLOOD RISK DUE TO LEVEE',
    });
    expect(levee).toMatch(/levee/i);
    expect(levee).toMatch(/decertif/i);
    expect(levee).not.toBe(floodImplication(base));
  });

  it('does not tell an out-of-zone owner that flooding is impossible', () => {
    const text = floodImplication(base);
    expect(text).toMatch(/not a statement that flooding is impossible/i);
    expect(text).toMatch(/outside mapped hazard areas/i);
  });
});

describe('the disclosure', () => {
  it('says it is a regulatory map and not a survey', () => {
    expect(FLOOD_ZONE_DISCLOSURE).toMatch(/regulatory flood map/i);
    expect(FLOOD_ZONE_DISCLOSURE).toMatch(/not a survey/i);
  });

  it('says a single point cannot speak for a whole lot', () => {
    expect(FLOOD_ZONE_DISCLOSURE).toMatch(/single point/i);
    expect(FLOOD_ZONE_DISCLOSURE).toMatch(/more than one zone/i);
  });

  it('says unmapped is not low risk', () => {
    // The failure mode most likely to mislead: absence of a polygon reading as
    // a clean bill of health.
    expect(FLOOD_ZONE_DISCLOSURE).toMatch(/not a finding that the risk is low/i);
  });
});
