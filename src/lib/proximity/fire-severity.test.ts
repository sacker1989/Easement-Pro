import { describe, expect, it } from 'vitest';

import {
  buildFireSafetyContent,
  CALFIRE_FHSZ_LRA_LAYER,
  CALFIRE_FHSZ_SRA_LAYER,
  FIRE_SEVERITY_DISCLOSURE,
  lookupFireSeverity,
} from './fire-severity';
import { buildFireStatusNote } from './fire-severity';

/**
 * CAL FIRE lookups are mocked at the fetch boundary: the tests assert the
 * classification discipline (prose, not integer codes), the LRA-then-SRA
 * fallback, and the honest degraded states — never the live service.
 */

type MockFeature = { attributes: Record<string, unknown> };

function mockFetch(
  handler: (url: string) => { ok: boolean; body: unknown } | never,
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const out = handler(String(input));
    return {
      ok: out.ok,
      json: async () => out.body,
    };
  }) as unknown as typeof fetch;
}

const attrs = (FHSZ_Description: string): MockFeature[] => [{ attributes: { FHSZ_Description } }];
const empty = (): MockFeature[] => [];

const Q = { lat: 34.19, lon: -118.11 };

describe('lookupFireSeverity classification', () => {
  it('classifies Very High / High / Moderate from the service prose', async () => {
    for (const [prose, severity] of [
      ['Very High', 'Very High'],
      ['High', 'High'],
      ['Moderate', 'Moderate'],
    ] as const) {
      const r = await lookupFireSeverity({
        ...Q,
        fetchImpl: mockFetch(() => ({ ok: true, body: { features: attrs(prose) } })),
      });
      expect(r.kind).toBe('in-hazard-zone');
      if (r.kind === 'in-hazard-zone') {
        expect(r.severity).toBe(severity);
        expect(r.source).toBe(CALFIRE_FHSZ_LRA_LAYER);
      }
    }
  });

  it('maps NonWildland to not-in-hazard-zone, not to a failure', async () => {
    const r = await lookupFireSeverity({
      ...Q,
      fetchImpl: mockFetch(() => ({ ok: true, body: { features: attrs('NonWildland') } })),
    });
    expect(r.kind).toBe('not-in-hazard-zone');
  });

  it('falls back to the SRA map when the LRA map has no polygon', async () => {
    const r = await lookupFireSeverity({
      ...Q,
      fetchImpl: mockFetch((url) =>
        url.includes('FHSALRA25')
          ? { ok: true, body: { features: empty() } }
          : { ok: true, body: { features: attrs('Very High') } },
      ),
    });
    expect(r.kind).toBe('in-hazard-zone');
    if (r.kind === 'in-hazard-zone') {
      expect(r.source).toBe(CALFIRE_FHSZ_SRA_LAYER);
    }
  });

  it('returns no-map-coverage when neither map has the point', async () => {
    const r = await lookupFireSeverity({
      ...Q,
      fetchImpl: mockFetch(() => ({ ok: true, body: { features: empty() } })),
    });
    expect(r.kind).toBe('no-map-coverage');
  });

  it('returns lookup-failed on HTTP errors, Esri error bodies, and throws', async () => {
    const http = await lookupFireSeverity({
      ...Q,
      fetchImpl: mockFetch(() => ({ ok: false, body: {} })),
    });
    expect(http.kind).toBe('lookup-failed');

    const esri = await lookupFireSeverity({
      ...Q,
      fetchImpl: mockFetch(() => ({ ok: true, body: { error: { message: 'boom' } } })),
    });
    expect(esri.kind).toBe('lookup-failed');

    const thrown = await lookupFireSeverity({
      ...Q,
      fetchImpl: mockFetch(() => {
        throw new Error('network down');
      }),
    });
    expect(thrown.kind).toBe('lookup-failed');
  });

  it('returns lookup-failed rather than guessing at unknown prose', async () => {
    const r = await lookupFireSeverity({
      ...Q,
      fetchImpl: mockFetch(() => ({ ok: true, body: { features: attrs('Something New') } })),
    });
    expect(r.kind).toBe('lookup-failed');
  });

  it('still throws on programmer errors (non-finite coordinates)', async () => {
    await expect(
      lookupFireSeverity({ lat: NaN, lon: -118.11, fetchImpl: mockFetch(() => ({ ok: true, body: {} })) }),
    ).rejects.toThrow(TypeError);
  });
});

describe('buildFireSafetyContent gating', () => {
  const veryHigh = {
    kind: 'in-hazard-zone' as const,
    severity: 'Very High' as const,
    description: 'Very High',
    source: CALFIRE_FHSZ_LRA_LAYER,
    queriedOn: '2026-10-06',
  };

  it('builds the section for overhead lines in a mapped hazard zone', () => {
    const c = buildFireSafetyContent('utility-overhead', veryHigh);
    expect(c).not.toBeNull();
    expect(c?.headline).toBe('Fire risk from the overhead power lines');
    expect(c?.whyItMatters).toContain('4291');
    expect(c?.whoIsResponsible).toContain('utility');
  });

  it('returns null for every other easement type', () => {
    for (const t of ['sewer', 'utility-underground', 'pipeline', 'storm-drain', 'drainage'] as const) {
      expect(buildFireSafetyContent(t, veryHigh)).toBeNull();
    }
  });

  it('returns null for every degraded or non-hazard state', () => {
    const states = [
      { kind: 'not-in-hazard-zone', description: 'NonWildland' },
      { kind: 'no-map-coverage' },
      { kind: 'lookup-failed', reason: 'CAL FIRE service error' },
    ] as const;
    for (const s of states) {
      expect(
        buildFireSafetyContent('utility-overhead', { ...s, source: CALFIRE_FHSZ_LRA_LAYER, queriedOn: '2026-10-06' } as never),
      ).toBeNull();
    }
  });

  it('keeps the headline jargon-free', () => {
    const c = buildFireSafetyContent('utility-overhead', veryHigh);
    expect(c?.headline.toLowerCase()).not.toContain('easement');
  });

  it('attributes CAL FIRE / OSFM with map vintages in the disclosure', () => {
    expect(FIRE_SEVERITY_DISCLOSURE).toContain('CAL FIRE');
    expect(FIRE_SEVERITY_DISCLOSURE).toContain('State Fire Marshal');
    expect(FIRE_SEVERITY_DISCLOSURE).toContain('2025');
    expect(FIRE_SEVERITY_DISCLOSURE).toContain('CC BY');
  });
});

describe('every parcel gets a fire answer, not only hazard-zone ones', () => {
  const base = { source: 'https://example.test/fhsz', queriedOn: '2026-10-25' } as const;

  it('says plainly when the map shows no hazard zone', () => {
    /*
     * SILENCE WAS THE BUG. buildFireSafetyContent returns null unless the
     * easement is overhead-utility AND the parcel is in a hazard zone, so
     * every other parcel rendered nothing — and "not in a mapped zone" and
     * "we never looked" are the same blank page to a reader.
     */
    const note = buildFireStatusNote({
      kind: 'not-in-hazard-zone',
      description: 'NonWildland',
      ...base,
    });
    expect(note.heading).toMatch(/does not map this parcel/i);
    expect(note.body).toContain('NonWildland');
  });

  it('never lets an absence of mapping read as an absence of hazard', () => {
    const note = buildFireStatusNote({ kind: 'no-map-coverage', ...base });
    expect(note.body).toMatch(/not a finding of low hazard/i);
  });

  it('says a failed lookup told us nothing, rather than saying nothing', () => {
    const note = buildFireStatusNote({ kind: 'lookup-failed', reason: 'timeout', ...base });
    expect(note.heading).toMatch(/could not reach/i);
    expect(note.body).toMatch(/says nothing either way/i);
  });

  it('carries the wildland limit on EVERY outcome', () => {
    /*
     * THE SENTENCE THAT RECONCILES TWO TRUE THINGS. CAL FIRE maps southern
     * Altadena as NonWildland and the Eaton Fire destroyed it in January
     * 2025, because FHSZ models wildland fire and that was an urban
     * conflagration. A homeowner reading "not in a mapped hazard zone" after
     * their neighbourhood burned is owed that explanation, and it has to
     * travel with the reassuring outcomes as much as the alarming ones.
     */
    const results = [
      { kind: 'in-hazard-zone', severity: 'Very High', description: 'Very High', ...base },
      { kind: 'not-in-hazard-zone', description: 'NonWildland', ...base },
      { kind: 'no-map-coverage', ...base },
      { kind: 'lookup-failed', reason: 'network', ...base },
    ] as const;
    for (const r of results) {
      const note = buildFireStatusNote(r);
      expect(note.limit, `${r.kind} lost the wildland limit`).toMatch(/WILDLAND/);
      expect(note.limit).toMatch(/urban conflagration/i);
      expect(note.limit).toMatch(/not a record of what has burned/i);
    }
  });
});
