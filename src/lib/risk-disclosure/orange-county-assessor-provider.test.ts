import { describe, it, expect } from 'vitest';
import {
  createOrangeCountyAssessorProvider,
  escapeSqlLiteral,
  normalizeSiteAddress,
  noOpOrangeCountyProvider,
  OrangeCountyLookupError,
  ORANGE_COUNTY_STALENESS_CAVEAT,
  parseMoneyField,
  REQUIRED_FIELDS,
  toOrangeCountyParcelValuation,
} from './orange-county-assessor-provider';

/**
 * Fixture taken verbatim from a live query against
 * LegalLotsAttributeOpenData/MapServer/0 on 2026-07-27, so the parsing tests
 * exercise the county's real encoding — money as strings, area as a double —
 * rather than a shape we assumed.
 */
const LIVE_ALAMO_ST = {
  AssessmentNo: '071-334-14',
  SiteAddress: '1251 N ALAMO ST',
  SiteZip5: '92801',
  LandVal: '531538',
  ImprovedVal: '72714',
  AssdAmt: null,
  'Shape.STArea()': 6278.8101519153415,
};

/** Second live record; same street, materially lower land value. */
const LIVE_HUNTINGTON_AVE = {
  AssessmentNo: '072-307-03',
  SiteAddress: '2102 W HUNTINGTON AVE',
  SiteZip5: '92801',
  LandVal: '243414',
  ImprovedVal: '84410',
  AssdAmt: null,
  'Shape.STArea()': 6486.6921993518035,
};

function stubFetch(payload: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    ({
      ok,
      status,
      json: async () => payload,
    }) as unknown as Response) as unknown as typeof fetch;
}

describe('parseMoneyField', () => {
  it('parses the county string encoding', () => {
    expect(parseMoneyField('531538')).toBe(531538);
  });

  it('tolerates currency punctuation', () => {
    expect(parseMoneyField('$531,538')).toBe(531538);
  });

  it('distinguishes an unpublished value from zero', () => {
    // A zero land value (exempt parcel) and an absent one are different facts;
    // coercing both to 0 would silently price an exempt parcel.
    expect(parseMoneyField(null)).toBeNull();
    expect(parseMoneyField('')).toBeNull();
    expect(parseMoneyField('   ')).toBeNull();
    expect(parseMoneyField('0')).toBe(0);
  });

  it('returns null for non-numeric text', () => {
    expect(parseMoneyField('N/A')).toBeNull();
  });
});

describe('toOrangeCountyParcelValuation', () => {
  it('derives a per-sq-ft land value from the live record', () => {
    const v = toOrangeCountyParcelValuation(LIVE_ALAMO_ST);
    expect(v.assessmentNo).toBe('071-334-14');
    expect(v.landValue).toBe(531538);
    expect(v.improvementValue).toBe(72714);
    expect(v.zip).toBe('92801');
    // EPSG:2230 is US survey feet, so STArea() is already square feet.
    expect(v.lotAreaSqFt).toBeCloseTo(6278.81, 2);
    expect(v.landValuePerSqFt).toBeCloseTo(531538 / 6278.8101519153415, 6);
  });

  it('always reports a null base year', () => {
    // The layer publishes none. Callers must not infer one from LegalStartDate.
    expect(toOrangeCountyParcelValuation(LIVE_ALAMO_ST).landBaseYear).toBeNull();
    expect(toOrangeCountyParcelValuation(LIVE_HUNTINGTON_AVE).landBaseYear).toBeNull();
  });

  it('preserves the Prop 13 spread rather than smoothing it', () => {
    // Two comparable lots, land values 2.2x apart. The provider reports what
    // the county says; it does not normalise the distortion away.
    const alamo = toOrangeCountyParcelValuation(LIVE_ALAMO_ST);
    const huntington = toOrangeCountyParcelValuation(LIVE_HUNTINGTON_AVE);
    expect(alamo.lotAreaSqFt / huntington.lotAreaSqFt).toBeCloseTo(1, 1);
    expect(alamo.landValue / huntington.landValue).toBeGreaterThan(2);
  });

  it('rejects a parcel with no published land value', () => {
    expect(() => toOrangeCountyParcelValuation({ ...LIVE_ALAMO_ST, LandVal: null })).toThrow(
      /publishes no land value/,
    );
  });

  it('rejects an exempt parcel rather than emitting $0/sq ft', () => {
    expect(() => toOrangeCountyParcelValuation({ ...LIVE_ALAMO_ST, LandVal: '0' })).toThrow(
      /non-positive land value/,
    );
  });

  it('rejects a non-positive parcel area', () => {
    expect(() =>
      toOrangeCountyParcelValuation({ ...LIVE_ALAMO_ST, 'Shape.STArea()': 0 }),
    ).toThrow(/non-positive parcel area/);
  });

  it('rejects a record with no assessment number', () => {
    expect(() => toOrangeCountyParcelValuation({ ...LIVE_ALAMO_ST, AssessmentNo: '  ' })).toThrow(
      /AssessmentNo/,
    );
  });
});

describe('where-clause safety', () => {
  it('doubles single quotes so a literal cannot close the clause', () => {
    expect(escapeSqlLiteral("O'BRIEN ST")).toBe("O''BRIEN ST");
  });

  it('neutralises LIKE wildcards', () => {
    // Without this, a typed "%" would match every parcel in the county.
    expect(escapeSqlLiteral('100%')).toBe('100[%]');
    expect(escapeSqlLiteral('A_B')).toBe('A[_]B');
  });

  it('rejects a malformed assessment number instead of sanitizing it', async () => {
    const provider = createOrangeCountyAssessorProvider({ fetchImpl: stubFetch({ features: [] }) });
    await expect(provider.fetchByAssessmentNo("071' OR '1'='1")).rejects.toThrow(
      /not a well-formed/,
    );
  });
});

describe('normalizeSiteAddress', () => {
  it('matches the county storage form', () => {
    expect(normalizeSiteAddress('  1251 n   alamo st. ')).toBe('1251 N ALAMO ST');
  });
});

describe('createOrangeCountyAssessorProvider', () => {
  it('returns a valuation for a single address match', async () => {
    const provider = createOrangeCountyAssessorProvider({
      fetchImpl: stubFetch({ features: [{ attributes: LIVE_ALAMO_ST }] }),
    });
    const result = await provider.findByAddress('1251 N Alamo St', '92801');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.valuation.landValue).toBe(531538);
    }
  });

  it('reports ambiguity rather than pricing an arbitrary neighbor', async () => {
    const provider = createOrangeCountyAssessorProvider({
      fetchImpl: stubFetch({
        features: [{ attributes: LIVE_ALAMO_ST }, { attributes: LIVE_HUNTINGTON_AVE }],
      }),
    });
    const result = await provider.findByAddress('2100 W Huntington');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0]!.assessmentNo).toBe('071-334-14');
    }
  });

  it('reports not-found for an empty feature list', async () => {
    const provider = createOrangeCountyAssessorProvider({ fetchImpl: stubFetch({ features: [] }) });
    expect((await provider.findByAddress('1 NOWHERE ST')).status).toBe('not-found');
  });

  it('rejects an empty street line', async () => {
    const provider = createOrangeCountyAssessorProvider({ fetchImpl: stubFetch({ features: [] }) });
    await expect(provider.findByAddress('   ')).rejects.toThrow(/empty/);
  });

  it('surfaces an HTTP failure', async () => {
    const provider = createOrangeCountyAssessorProvider({
      fetchImpl: stubFetch({}, false, 503),
    });
    await expect(provider.findByAddress('1251 N ALAMO ST')).rejects.toThrow(
      OrangeCountyLookupError,
    );
  });

  it("surfaces Esri's 200-with-error body", async () => {
    // Esri returns HTTP 200 with an error object; a naive client reads that as success.
    const provider = createOrangeCountyAssessorProvider({
      fetchImpl: stubFetch({ error: { code: 400, message: 'Invalid where clause' } }),
    });
    await expect(provider.findByAddress('1251 N ALAMO ST')).rejects.toThrow(/Invalid where clause/);
  });
});

describe('noOpOrangeCountyProvider', () => {
  it('degrades to not-found rather than throwing', async () => {
    expect(await noOpOrangeCountyProvider.fetchByAssessmentNo('071-334-14')).toBeNull();
    expect((await noOpOrangeCountyProvider.findByAddress('anywhere')).status).toBe('not-found');
  });
});

describe('ORANGE_COUNTY_STALENESS_CAVEAT', () => {
  it('names the missing base year and refuses to call the figure an estimate', () => {
    expect(ORANGE_COUNTY_STALENESS_CAVEAT).toMatch(/base\s+year/i);
    expect(ORANGE_COUNTY_STALENESS_CAVEAT).toMatch(/floor on land value, not an estimate/);
  });
});

describe('a unit in a common-interest development', () => {
  /*
   * MEASURED 2026-10-15. All 489 parcels in the 930-18 book publish the
   * identical Shape.STArea() of 135,871.237 sq ft — the whole development —
   * against a per-unit LandVal. 142 Paramount came out at $3.44/sq ft where a
   * fee lot in Santa Ana sits at $73.02. The easement valuation multiplies
   * that quotient, so a fifth of the county's addressed parcels (166,052 of
   * 894,009) were being handed a land price understated ~20x.
   *
   * THE SIGNAL IS THE LEGAL DESCRIPTION. LotType reads "Lot" for a fee parcel
   * and a condominium unit alike, and GPLU_DESC, ZC_DESCR and ZCLASS are null
   * on every row sampled.
   */
  const LIVE_PARAMOUNT = {
    AssessmentNo: '930-18-697',
    SiteAddress: '142 PARAMOUNT',
    SiteZip5: '92618',
    LandVal: '467827',
    ImprovedVal: '0',
    AssdAmt: null,
    'Shape.STArea()': 135871.23733243317,
    LegalDescr:
      'LOT 1 OF TRACT 17740 OF CONDO PROJECT 930-18 LOCATED ON APN 580-602-04, TOGETHER WITH ' +
      'AN UND 1/12 INT IN POR. OF LOT 1',
  };

  /** The other wording, which says PROJECT rather than CONDO PROJECT. */
  const LIVE_CIENEGA = {
    ...LIVE_PARAMOUNT,
    AssessmentNo: '934-74-344',
    SiteAddress: '55 CIENEGA',
    'Shape.STArea()': 16923.4,
    LegalDescr:
      'TRACT 16899 LOT 7, OF PROJECT 934-74 LOCATED ON APN 580-091-26 TOGETHER WITH AN UND ' +
      '1/10 INT IN LOT 7',
  };

  it('is detected from the undivided interest, not the word CONDO', () => {
    /*
     * Matching "CONDO" would have missed 134,000 parcels: only 32,053
     * addressed parcels say CONDO while 166,052 declare an undivided
     * interest. Both wordings must be caught.
     */
    expect(toOrangeCountyParcelValuation(LIVE_PARAMOUNT).lotTenure).toBe('undivided-interest');
    expect(toOrangeCountyParcelValuation(LIVE_CIENEGA).lotTenure).toBe('undivided-interest');
  });

  it('refuses to derive a price per square foot', () => {
    const v = toOrangeCountyParcelValuation(LIVE_PARAMOUNT);
    expect(v.landValuePerSqFt).toBe(0);
    // Not 467827/135871.24 = 3.44.
    expect(v.landValuePerSqFt).not.toBeCloseTo(3.44, 2);
    // Both published figures are still reported unchanged.
    expect(v.lotAreaSqFt).toBeCloseTo(135871.24, 1);
    expect(v.landValue).toBe(467827);
  });

  it('leaves an ordinary fee lot deriving a price as before', () => {
    /*
     * The fixtures have no LegalDescr at all, which is also the case for a
     * row the field was not requested on — so this doubles as a check that an
     * absent description does not silently suppress every valuation in the
     * county.
     */
    const v = toOrangeCountyParcelValuation(LIVE_ALAMO_ST);
    expect(v.lotTenure).toBe('whole-parcel');
    expect(v.landValuePerSqFt).toBeCloseTo(531538 / 6278.8101519153415, 6);
  });

  it('does not fire on a fee lot\'s own legal description', () => {
    // The three real wordings sampled, none of which is a shared interest.
    for (const legal of [
      'P-BOOK: 381 PAGE: 23 PAR: 2',
      'A-TRACT: LIVINGSTON ADD BLOCK: LOT: 21 TR 434',
      'N-TRACT: 17611 BLOCK: LOT: 79',
    ]) {
      expect(
        toOrangeCountyParcelValuation({ ...LIVE_ALAMO_ST, LegalDescr: legal }).lotTenure,
      ).toBe('whole-parcel');
    }
  });

  it('reads the field it depends on', () => {
    expect(REQUIRED_FIELDS).toContain('LegalDescr');
  });
});
