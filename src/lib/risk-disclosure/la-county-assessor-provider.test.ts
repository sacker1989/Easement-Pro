import { describe, expect, it, vi } from 'vitest';
import {
  AssessorLookupError,
  createLaCountyAssessorProvider,
  noOpAssessorProvider,
  REQUIRED_FIELDS,
  toAssessorParcelValuation,
} from './la-county-assessor-provider';

/** Attribute bag as actually returned by the service for AIN 2004001003. */
const LIVE_ATTRS = {
  AIN: '2004001003',
  APN: '2004-001-003',
  SitusFullAddress: '8321 FAUST AVE LOS ANGELES CA 91304',
  Roll_Year: '2026',
  Roll_LandValue: 740440,
  Roll_ImpValue: 313342,
  'Shape.STArea()': 9685.58203125,
};

function fetchReturning(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

/**
 * Reads back the URL a mocked fetch was called with, in readable form.
 * URLSearchParams encodes spaces as "+", which decodeURIComponent leaves
 * alone, so those are restored before matching on SQL fragments.
 */
function requestedUrl(fetchImpl: typeof fetch, callIndex = 0): string {
  const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[callIndex]).toBeDefined();
  return decodeURIComponent(String(calls[callIndex]![0])).replace(/\+/g, ' ');
}

describe('toAssessorParcelValuation', () => {
  it('maps a live attribute bag and derives price per sq ft', () => {
    const v = toAssessorParcelValuation(LIVE_ATTRS);
    expect(v.ain).toBe('2004001003');
    expect(v.rollYear).toBe('2026');
    expect(v.lotAreaSqFt).toBeCloseTo(9685.58, 2);
    // 740440 / 9685.58 ≈ 76.45
    expect(v.landValuePerSqFt).toBeCloseTo(76.45, 2);
  });

  it('rejects a record with no parcel area', () => {
    expect(() => toAssessorParcelValuation({ ...LIVE_ATTRS, 'Shape.STArea()': 0 })).toThrow(
      AssessorLookupError,
    );
  });

  it('rejects a zero-land-value parcel rather than deriving $0/sq ft', () => {
    // Exempt and public parcels legitimately carry a zero land value; emitting
    // a $0/sq ft estimate for them would understate impact to zero.
    expect(() => toAssessorParcelValuation({ ...LIVE_ATTRS, Roll_LandValue: 0 })).toThrow(
      /non-positive land value/,
    );
  });

  it('rejects a record missing a required identity field', () => {
    const { AIN, ...withoutAin } = LIVE_ATTRS;
    expect(() => toAssessorParcelValuation(withoutAin)).toThrow(/AIN/);
  });

  it('tolerates a missing improvement value', () => {
    const { Roll_ImpValue, ...withoutImp } = LIVE_ATTRS;
    expect(toAssessorParcelValuation(withoutImp).improvementValue).toBe(0);
  });
});

describe('createLaCountyAssessorProvider', () => {
  it('returns a mapped valuation for a found parcel', async () => {
    const provider = createLaCountyAssessorProvider({
      fetchImpl: fetchReturning({ features: [{ attributes: LIVE_ATTRS }] }),
    });
    const v = await provider.fetchByAin('2004001003');
    expect(v?.ain).toBe('2004001003');
    expect(v?.landValuePerSqFt).toBeCloseTo(76.45, 2);
  });

  it('returns null when the parcel is not found', async () => {
    const provider = createLaCountyAssessorProvider({ fetchImpl: fetchReturning({ features: [] }) });
    expect(await provider.fetchByAin('9999999999')).toBeNull();
  });

  it('surfaces an Esri error delivered in a 200 body', async () => {
    // Esri reports query errors with HTTP 200 and an `error` key, so status
    // alone is not a sufficient success check.
    const provider = createLaCountyAssessorProvider({
      fetchImpl: fetchReturning({ error: { code: 400, message: 'Invalid where clause' } }),
    });
    await expect(provider.fetchByAin('2004001003')).rejects.toThrow(/Invalid where clause/);
  });

  it('throws on a non-OK HTTP status', async () => {
    const provider = createLaCountyAssessorProvider({
      fetchImpl: fetchReturning({}, false, 503),
    });
    await expect(provider.fetchByAin('2004001003')).rejects.toThrow(/HTTP 503/);
  });

  it('rejects a malformed AIN without issuing a request', async () => {
    const fetchImpl = fetchReturning({ features: [] });
    const provider = createLaCountyAssessorProvider({ fetchImpl });
    await expect(provider.fetchByAin("1' OR '1'='1")).rejects.toThrow(/well-formed/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requests the fields needed to derive a per-sq-ft value', async () => {
    const fetchImpl = fetchReturning({ features: [{ attributes: LIVE_ATTRS }] });
    const provider = createLaCountyAssessorProvider({ fetchImpl });
    await provider.fetchByAin('2004001003');

    const url = requestedUrl(fetchImpl);
    expect(url).toContain('Roll_LandValue');
    expect(url).toContain('Shape.STArea');
    expect(url).toContain('returnGeometry=false');
  });
});

describe('findByAddress', () => {
  it('returns a valuation when exactly one parcel matches', async () => {
    const provider = createLaCountyAssessorProvider({
      fetchImpl: fetchReturning({ features: [{ attributes: LIVE_ATTRS }] }),
    });
    const result = await provider.findByAddress('8321 Faust Avenue', '91304');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.valuation.ain).toBe('2004001003');
    }
  });

  it('reports ambiguity rather than picking a unit when several parcels share an address', async () => {
    // A condo building yields one AIN per unit. Returning the first would
    // price an arbitrary neighbour's unit as if it were the user's.
    const units = ['1', '2', '3'].map((unit) => ({
      attributes: {
        ...LIVE_ATTRS,
        AIN: `233801502${unit}`,
        SitusUnit: unit,
        SitusFullAddress: `11501 W HATTERAS ST ${unit} NORTH HOLLYWOOD CA 91601`,
      },
    }));
    const provider = createLaCountyAssessorProvider({ fetchImpl: fetchReturning({ features: units }) });

    const result = await provider.findByAddress('11501 W Hatteras St', '91601');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates.map((c) => c.unit)).toEqual(['1', '2', '3']);
    }
  });

  it('resolves to one parcel when the caller supplies the unit', async () => {
    const fetchImpl = fetchReturning({
      features: [{ attributes: { ...LIVE_ATTRS, SitusUnit: '2' } }],
    });
    const provider = createLaCountyAssessorProvider({ fetchImpl });

    const result = await provider.findByAddress('11501 W Hatteras St Unit 2', '91601');
    expect(result.status).toBe('found');
    expect(requestedUrl(fetchImpl)).toContain("SitusUnit='2'");
  });

  it('reads a blank unit as null rather than a space', async () => {
    // The county writes " " into unused situs fields.
    const provider = createLaCountyAssessorProvider({
      fetchImpl: fetchReturning({
        features: [
          { attributes: { ...LIVE_ATTRS, SitusUnit: ' ' } },
          { attributes: { ...LIVE_ATTRS, AIN: '2004001004', SitusUnit: ' ' } },
        ],
      }),
    });
    const result = await provider.findByAddress('8321 Faust Ave');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates.every((c) => c.unit === null)).toBe(true);
    }
  });

  it('returns not-found for an address with no matching parcel', async () => {
    const provider = createLaCountyAssessorProvider({ fetchImpl: fetchReturning({ features: [] }) });
    expect((await provider.findByAddress('1 Nonexistent St')).status).toBe('not-found');
  });

  it('matches ZIP by prefix so ZIP+4 storage does not defeat the lookup', async () => {
    const fetchImpl = fetchReturning({ features: [{ attributes: LIVE_ATTRS }] });
    const provider = createLaCountyAssessorProvider({ fetchImpl });
    await provider.findByAddress('8321 Faust Ave', '91304');
    expect(requestedUrl(fetchImpl)).toContain("SitusZIP LIKE '91304%'");
  });

  it('rejects an unparseable address without issuing a request', async () => {
    const fetchImpl = fetchReturning({ features: [] });
    const provider = createLaCountyAssessorProvider({ fetchImpl });
    await expect(provider.findByAddress('not an address')).rejects.toThrow(/house number/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('noOpAssessorProvider', () => {
  it('returns null so estimates degrade instead of failing', async () => {
    expect(await noOpAssessorProvider.fetchByAin('2004001003')).toBeNull();
  });

  it('reports not-found for address lookups', async () => {
    expect((await noOpAssessorProvider.findByAddress('8321 Faust Ave')).status).toBe('not-found');
  });
});

describe('a condominium unit is not given the development\'s land price', () => {
  /*
   * MEASURED 2026-10-15. At 5053 109th St, seventeen parcels share one area
   * of 26,157 sq ft and carry fifteen different land values: the county
   * publishes the development's area against each unit's value, so dividing
   * understates the price by roughly the number of units. 175,129 of LA's
   * 2,433,213 parcels declare a condominium.
   *
   * THE UNIT NUMBER IS THE WRONG SIGNAL, AND THAT MATTERS. 279,408 parcels
   * carry one, and many are not condominiums: 1833 10th Ave has three
   * parcels of 2,005, 2,017 and 3,124 sq ft — separate lots whose addresses
   * carry unit letters, whose valuations are sound and must be kept. Only the
   * legal description separates the two. UseType and UseDescription cannot:
   * both read "Residential"/"Single" for a condominium, and no row in the
   * county contains the word "condominium" in either.
   */
  const CONDO = {
    ...LIVE_ATTRS,
    LegalDescription: 'TR=72771 LOT 1 CONDO UNIT 1 (AIRSPACE AND 1/17 INT IN COMMON AREA)',
  };

  it('is detected from the legal description', () => {
    expect(toAssessorParcelValuation(CONDO).lotTenure).toBe('undivided-interest');
  });

  it('refuses to derive a price per square foot', () => {
    expect(toAssessorParcelValuation(CONDO).landValuePerSqFt).toBe(0);
  });

  it('keeps reporting the figures the county published', () => {
    const v = toAssessorParcelValuation(CONDO);
    expect(v.landValue).toBe(LIVE_ATTRS.Roll_LandValue);
    expect(v.lotAreaSqFt).toBe(LIVE_ATTRS['Shape.STArea()']);
  });

  it('leaves a lot whose description is an ordinary tract alone', () => {
    // The real wordings, from live rows at TRACT NO 25040.
    for (const legal of ['TRACT NO 25040 LOT   99', 'TR=52320 LOT 8', '']) {
      const v = toAssessorParcelValuation({ ...LIVE_ATTRS, LegalDescription: legal });
      expect(v.lotTenure).toBe('whole-parcel');
      expect(v.landValuePerSqFt).toBeGreaterThan(0);
    }
  });

  it('does not fire on a description that merely mentions a condo nearby', () => {
    // \bCONDO\b, not a substring: CONDOR LANE is a street name, not a tenure.
    const v = toAssessorParcelValuation({
      ...LIVE_ATTRS,
      LegalDescription: 'TRACT NO 9001 LOT 4 CONDOR CANYON',
    });
    expect(v.lotTenure).toBe('whole-parcel');
  });

  it('reads the field it depends on', () => {
    expect(REQUIRED_FIELDS).toContain('LegalDescription');
  });
});
