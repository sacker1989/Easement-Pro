import { describe, expect, it } from 'vitest';
import { AssessorLookupError } from './la-county-assessor-provider';
import {
  COOK_FIELDS,
  createCookCountyAssessorProvider,
  escapeEsriLiteral,
} from './cook-county-assessor-provider';

/** A row shaped like the live service returns, taken from a real query. */
const ROW = {
  PIN14_dash: '17-10-221-085-0000',
  street_address: '400 N LAKE SHORE DR',
  CITYNAME: 'CHICAGO',
  ZIP1: '60611',
  UNITDESC: ' ',
  UNITNO: ' ',
  LANDSF: 74671,
  CURRENTVALUE_LAND: 1120035,
  CURRENTVALUE_BLDG: 250000,
  TAXYR: 2025,
};

function stub(rows: Array<Record<string, unknown>>, extra?: unknown): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify(extra ?? { features: rows.map((attributes) => ({ attributes })) }),
      { status: 200 },
    )) as unknown as typeof fetch;
}

/**
 * Decodes a query string for assertion.
 *
 * URLSearchParams encodes a space as '+', which decodeURIComponent does NOT
 * reverse — so a naive decode leaves "ZIP1+=+'60611'" and every assertion
 * about a clause with spaces in it fails for the wrong reason.
 */
function readQuery(url: string): string {
  return decodeURIComponent(url.split('+').join(' '));
}

function spy() {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify({ features: [{ attributes: ROW }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { urls, impl };
}

describe('findByAddress', () => {
  it('maps a single match to a valuation', async () => {
    const p = createCookCountyAssessorProvider({ fetchImpl: stub([ROW]) });
    const result = await p.findByAddress('400 N Lake Shore Dr', '60611');

    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.valuation).toMatchObject({
      ain: '17-10-221-085-0000',
      apn: '17-10-221-085-0000',
      situsFullAddress: '400 N LAKE SHORE DR, CHICAGO, 60611',
      lotAreaSqFt: 74671,
      landValue: 1120035,
      improvementValue: 250000,
      rollYear: '2025',
    });
  });

  it('derives land value per square foot', () => {
    // Guards a division that silently produces Infinity on a zero-area parcel,
    // which is common: exempt and air-rights parcels carry LANDSF 0.
    return createCookCountyAssessorProvider({ fetchImpl: stub([ROW]) })
      .findByAddress('400 N Lake Shore Dr')
      .then((r) => {
        if (r.status !== 'found') throw new Error('expected found');
        expect(r.valuation.landValuePerSqFt).toBeCloseTo(1120035 / 74671, 6);
      });
  });

  it('returns 0 rather than Infinity for a zero-area parcel', async () => {
    // The live service returns rows like this — the first result for
    // 400 N Lake Shore Dr has LANDSF 0 and null values.
    const p = createCookCountyAssessorProvider({
      fetchImpl: stub([{ ...ROW, LANDSF: 0, CURRENTVALUE_LAND: null, CURRENTVALUE_BLDG: null }]),
    });
    const r = await p.findByAddress('400 N Lake Shore Dr');
    if (r.status !== 'found') throw new Error('expected found');
    expect(r.valuation.landValuePerSqFt).toBe(0);
    expect(Number.isFinite(r.valuation.landValuePerSqFt)).toBe(true);
    expect(r.valuation.landValue).toBe(0);
  });

  it('reports ambiguity rather than picking the first condo unit', async () => {
    // Chicago is dense with condo buildings where one street address yields one
    // PIN per unit. First-match would price an arbitrary neighbour's unit and
    // present it as the user's own.
    const p = createCookCountyAssessorProvider({
      fetchImpl: stub([
        { ...ROW, PIN14_dash: '17-10-221-085-1001', UNITDESC: 'UNIT', UNITNO: '1001' },
        { ...ROW, PIN14_dash: '17-10-221-085-1002', UNITDESC: 'UNIT', UNITNO: '1002' },
      ]),
    });
    const r = await p.findByAddress('400 N Lake Shore Dr');
    expect(r.status).toBe('ambiguous');
    if (r.status !== 'ambiguous') return;
    expect(r.candidates).toHaveLength(2);
    expect(r.candidates[0]!.unit).toBe('UNIT 1001');
  });

  it('treats the county’s blank unit fields as no unit', async () => {
    // Cook writes a single space into unused unit fields, same as LA. A naive
    // truthiness check reports " " as a unit designator.
    const p = createCookCountyAssessorProvider({
      fetchImpl: stub([
        { ...ROW, PIN14_dash: 'a' },
        { ...ROW, PIN14_dash: 'b' },
      ]),
    });
    const r = await p.findByAddress('400 N Lake Shore Dr');
    if (r.status !== 'ambiguous') throw new Error('expected ambiguous');
    expect(r.candidates[0]!.unit).toBeNull();
  });

  it('returns not-found for an empty result and an empty input', async () => {
    const p = createCookCountyAssessorProvider({ fetchImpl: stub([]) });
    expect((await p.findByAddress('nowhere at all')).status).toBe('not-found');
    expect((await p.findByAddress('   ')).status).toBe('not-found');
  });
});

describe('the query it builds', () => {
  it('requests exactly the fields it parses', async () => {
    // A field requested but not parsed is waste; one parsed but not requested
    // is undefined at runtime with no type error.
    const s = spy();
    await createCookCountyAssessorProvider({ fetchImpl: s.impl }).findByAddress('400 N Lake Shore Dr');
    for (const field of COOK_FIELDS) {
      expect(readQuery(s.urls[0]!)).toContain(field);
    }
  });

  it('narrows by ZIP when one is supplied', async () => {
    const s = spy();
    await createCookCountyAssessorProvider({ fetchImpl: s.impl }).findByAddress('400 N Lake Shore Dr', '60611');
    expect(readQuery(s.urls[0]!)).toContain("ZIP1 = '60611'");
  });

  it('does not send a ZIP clause when none is given', async () => {
    const s = spy();
    await createCookCountyAssessorProvider({ fetchImpl: s.impl }).findByAddress('400 N Lake Shore Dr');
    // Not "does not contain ZIP1" — ZIP1 is in outFields on every query,
    // because the result renders it. What must be absent is the WHERE clause.
    expect(readQuery(s.urls[0]!)).not.toContain('ZIP1 =');
  });

  it('asks for no geometry', async () => {
    // Parcel polygons are large and nothing here reads them.
    const s = spy();
    await createCookCountyAssessorProvider({ fetchImpl: s.impl }).findByAddress('400 N Lake Shore Dr');
    expect(s.urls[0]).toContain('returnGeometry=false');
  });
});

describe('escapeEsriLiteral', () => {
  it('doubles an apostrophe', () => {
    /*
     * CHICAGO HAS O'BRIEN STREET, among others. An unescaped apostrophe
     * terminates the SQL literal and produces an Esri parse error, which this
     * provider turns into a thrown AssessorLookupError — but before the escape
     * existed it would have surfaced to a resident of that street as a service
     * failure for an address that is perfectly real.
     */
    expect(escapeEsriLiteral("O'BRIEN ST")).toBe("O''BRIEN ST");
  });

  it('leaves an ordinary value alone', () => {
    expect(escapeEsriLiteral('400 N LAKE SHORE DR')).toBe('400 N LAKE SHORE DR');
  });

  it('is applied to the address in the built query', async () => {
    const s = spy();
    await createCookCountyAssessorProvider({ fetchImpl: s.impl }).findByAddress("123 O'Brien St");
    expect(readQuery(s.urls[0]!)).toContain("O''BRIEN ST");
  });
});

describe('failures are distinguished from empty results', () => {
  it('throws on an Esri error body served with HTTP 200', async () => {
    // Treating this as an empty result set reports "no parcel found" for a
    // malformed query, which looks identical to a genuinely absent parcel and
    // hides the bug.
    const p = createCookCountyAssessorProvider({
      fetchImpl: stub([], { error: { code: 400, message: 'Invalid field: NOPE' } }),
    });
    await expect(p.findByAddress('400 N Lake Shore Dr')).rejects.toThrow(AssessorLookupError);
  });

  it('throws on a non-ok HTTP status', async () => {
    const p = createCookCountyAssessorProvider({
      fetchImpl: (async () => new Response('', { status: 503 })) as unknown as typeof fetch,
    });
    await expect(p.findByAddress('400 N Lake Shore Dr')).rejects.toThrow(/503/);
  });

  it('wraps a transport failure rather than leaking it', async () => {
    const p = createCookCountyAssessorProvider({
      fetchImpl: (async () => {
        throw new Error('ECONNRESET');
      }) as unknown as typeof fetch,
    });
    await expect(p.findByAddress('400 N Lake Shore Dr')).rejects.toThrow(AssessorLookupError);
  });
});

describe('Illinois is not California', () => {
  it('carries no Proposition 13 base year', async () => {
    /*
     * THE SUBSTANTIVE DIFFERENCE. California providers surface a landBaseYear
     * because Prop 13 freezes assessed value to the year of acquisition, so a
     * 2026 roll year can describe a 1978 market. Illinois reassesses on a
     * three-year township cycle, so the roll year already approximates the
     * market year. Null here is correct rather than missing — inventing a base
     * year would fabricate a California concept for a state without one.
     */
    const p = createCookCountyAssessorProvider({ fetchImpl: stub([ROW]) });
    const r = await p.findByAddress('400 N Lake Shore Dr');
    if (r.status !== 'found') throw new Error('expected found');
    expect(r.valuation.landBaseYear).toBeNull();
  });

  it('does not scale the assessed value toward market', async () => {
    // Illinois assesses most residential property at a statutory fraction of
    // market value. Scaling it would turn a published number into a derived
    // one, with the derivation invisible downstream.
    const p = createCookCountyAssessorProvider({ fetchImpl: stub([ROW]) });
    const r = await p.findByAddress('400 N Lake Shore Dr');
    if (r.status !== 'found') throw new Error('expected found');
    expect(r.valuation.landValue).toBe(ROW.CURRENTVALUE_LAND);
  });
});
