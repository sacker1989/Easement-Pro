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

describe('a parcel the assessor publishes no land area for', () => {
  /*
   * CAUGHT ON PRODUCTION, AND IT WAS NOT A DEGRADED REPORT — IT WAS NO
   * REPORT. 5801 W Cermak Rd, Cicero is class `EX (Exempt Property)`: the
   * county returns `LANDSF: 0` and `Shape.STArea(): 16778.78`. Returning 0
   * made the page compare an 800 sq ft easement against a 0 sq ft lot, decide
   * the easement was larger than the parcel, and render "exceeds this
   * parcel's actual lot area of 0 sq ft" in place of the whole report.
   *
   * 92,118 of Cook's 1,865,928 parcels have LANDSF = 0 — 4.9%, measured
   * 2026-10-15. 1,647 tests passed through this the entire time, which is why
   * these exist.
   */
  const exempt = {
    ...ROW,
    PIN14_dash: '16-29-203-003-0000',
    street_address: '5801 W CERMAK RD',
    CITYNAME: 'CICERO',
    ZIP1: '60804',
    LANDSF: 0,
    'Shape.STArea()': 16778.78041862204,
    CURRENTVALUE_LAND: null,
    CURRENTVALUE_BLDG: null,
    TAXYR: 2026,
  };

  it('falls back to the polygon area rather than reporting zero', async () => {
    const r = await createCookCountyAssessorProvider({ fetchImpl: stub([exempt]) }).findByAddress(
      '5801 W Cermak Rd',
      '60804',
    );
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    expect(r.valuation.lotAreaSqFt).toBeCloseTo(16778.78, 1);
  });

  it('requests the field it falls back to', () => {
    /*
     * The comment on COOK_FIELDS warns that a field parsed but not requested
     * is undefined at runtime with no type error. The fallback was written
     * before the field was added to the list, which is exactly that bug.
     */
    expect(COOK_FIELDS).toContain('Shape.STArea()');
  });

  it('still prefers LANDSF when the assessor publishes one', async () => {
    // The reason for the preference is unchanged: LANDSF is the figure the
    // land value is assessed against, so the two stay consistent. The
    // polygon area here is deliberately different and must be ignored.
    const both = { ...ROW, LANDSF: 74671, 'Shape.STArea()': 99999 };
    const r = await createCookCountyAssessorProvider({ fetchImpl: stub([both]) }).findByAddress(
      '400 N Lake Shore Dr',
    );
    if (r.status !== 'found') throw new Error('expected found');
    expect(r.valuation.lotAreaSqFt).toBe(74671);
  });

  it('does not invent a land value per sq ft from an unpublished value', async () => {
    const r = await createCookCountyAssessorProvider({ fetchImpl: stub([exempt]) }).findByAddress(
      '5801 W Cermak Rd',
    );
    if (r.status !== 'found') throw new Error('expected found');
    // The area is now known and the value is not. A quotient of 0 is correct
    // here precisely because it is not presented as a price: resolvePricePerSqFt
    // rejects a non-positive figure rather than passing it through.
    expect(r.valuation.landValue).toBe(0);
    expect(r.valuation.landValuePerSqFt).toBe(0);
  });

  it('reports zero only when neither figure exists', async () => {
    const neither = { ...ROW, LANDSF: 0, 'Shape.STArea()': 0 };
    const r = await createCookCountyAssessorProvider({ fetchImpl: stub([neither]) }).findByAddress(
      '400 N Lake Shore Dr',
    );
    if (r.status !== 'found') throw new Error('expected found');
    // Nothing is fabricated to fill the gap; the page is responsible for not
    // treating this zero as a measurement, and is guarded separately.
    expect(r.valuation.lotAreaSqFt).toBe(0);
  });
});

describe('a condominium unit does not get the building\'s land price', () => {
  /*
   * MEASURED AT 222 N COLUMBUS DR, CHICAGO on 2026-10-15. Every unit in the
   * tower publishes LANDSF 41,068 — the building's footprint — against a
   * per-unit CURRENTVALUE_LAND between $1,239 and $2,299. Dividing gives
   * $0.03/sq ft, and that quotient is what an easement valuation multiplies,
   * so a unit owner was being handed a figure understated by roughly the
   * number of units in their building.
   *
   * The detection is the county's own encoding, not a heuristic: a PIN's last
   * four digits are the unit, and -0000 means the parcel is undivided.
   * 467,398 of Cook's 1,865,928 parcels carry a unit suffix.
   */
  const unit = {
    ...ROW,
    PIN14_dash: '17-10-316-033-1307',
    street_address: '222 N COLUMBUS DR 3102',
    LANDSF: 41068,
    CURRENTVALUE_LAND: 2103,
  };

  it('marks a unit-suffixed PIN as an undivided interest', async () => {
    const r = await createCookCountyAssessorProvider({ fetchImpl: stub([unit]) }).findByAddress(
      '222 N Columbus Dr',
    );
    if (r.status !== 'found') throw new Error('expected found');
    expect(r.valuation.lotTenure).toBe('undivided-interest');
  });

  it('refuses to derive a price per square foot from it', async () => {
    const r = await createCookCountyAssessorProvider({ fetchImpl: stub([unit]) }).findByAddress(
      '222 N Columbus Dr',
    );
    if (r.status !== 'found') throw new Error('expected found');
    // Not 2103/41068 = 0.051. Zero routes into the refusal paths that
    // buildValuationEstimate and screeningEstimate already have and test.
    expect(r.valuation.landValuePerSqFt).toBe(0);
    // The area and value are still reported as the county published them.
    expect(r.valuation.lotAreaSqFt).toBe(41068);
    expect(r.valuation.landValue).toBe(2103);
  });

  it('leaves a whole parcel alone', async () => {
    const r = await createCookCountyAssessorProvider({ fetchImpl: stub([ROW]) }).findByAddress(
      '400 N Lake Shore Dr',
    );
    if (r.status !== 'found') throw new Error('expected found');
    expect(r.valuation.lotTenure).toBe('whole-parcel');
    expect(r.valuation.landValuePerSqFt).toBeCloseTo(1120035 / 74671, 6);
  });

  it('does not treat a unit suffix of other digits as whole', async () => {
    // -0000 is the only undivided form. -1001, -1307, -0001 are all units.
    for (const pin of ['17-10-316-033-1001', '17-10-316-033-0001', '17-10-316-033-9999']) {
      const r = await createCookCountyAssessorProvider({
        fetchImpl: stub([{ ...unit, PIN14_dash: pin }]),
      }).findByAddress('x');
      if (r.status !== 'found') throw new Error('expected found');
      expect(r.valuation.lotTenure).toBe('undivided-interest');
    }
  });
});
