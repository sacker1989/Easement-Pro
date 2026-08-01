import { describe, it, expect } from 'vitest';
import {
  classifyVintage,
  createSanDiegoAssessorProvider,
  DOCTYPE_MEANINGS,
  FULL_TRANSFER_DOCTYPE,
  isTrustOrEntityOwner,
  escapeSqlLiteral,
  marketAdjustSanDiegoParcel,
  noOpSanDiegoProvider,
  parseDocDate,
  parseSanDiegoAddress,
  SanDiegoLookupError,
  toSanDiegoParcelValuation,
} from './san-diego-assessor-provider';
import {
  isReliableHpiYear,
  SAN_DIEGO_HPI_BY_YEAR,
  SAN_DIEGO_HPI_TRACT_COUNT_BY_YEAR,
} from './san-diego-hpi-data';

/**
 * Verbatim live records from LAFCO/parcels, queried 2026-07-30. Every field
 * below except `Shape.STArea()` is exactly as the county returned it; the
 * areas are the values observed through the provider on the same day.
 *
 * DOCTYPE 1 = full-value transfer. Note SITUS_PRE_DIR is populated here ("E"),
 * which exercises the address composition path.
 */
const LIVE_FULL_TRANSFER_1996 = {
  APN: '4982604500',
  ASR_LAND: 266867,
  ASR_IMPR: 88944,
  ASR_TOTAL: 355811,
  SITUS_ADDRESS: 1590,
  SITUS_PRE_DIR: 'E',
  SITUS_STREET: 'CHASE',
  SITUS_SUFFIX: 'AVE',
  SITUS_POST_DIR: '',
  SITUS_ZIP: '92020-8270',
  DOCDATE: '013196',
  DOCTYPE: '1',
  TOTAL_LVG_AREA: 1103,
  'Shape.STArea()': 57767,
};

/** Live record, DOCTYPE 3 — not a full-value transfer. */
const LIVE_EXCLUDED_2013 = {
  APN: '4982603900',
  ASR_LAND: 49921,
  ASR_IMPR: 103755,
  ASR_TOTAL: 153676,
  SITUS_ADDRESS: 1640,
  SITUS_PRE_DIR: '',
  SITUS_STREET: 'CHASE',
  SITUS_SUFFIX: 'LN',
  SITUS_POST_DIR: '',
  SITUS_ZIP: '92020-8306',
  DOCDATE: '081713',
  DOCTYPE: '3',
  TOTAL_LVG_AREA: 1467,
  'Shape.STArea()': 55588,
};

function stubFetch(payload: unknown, ok = true, status = 200): typeof fetch {
  return (async () => ({ ok, status, json: async () => payload }) as unknown as Response) as
    unknown as typeof fetch;
}

describe('parseDocDate', () => {
  it('reads MMDDYY', () => {
    expect(parseDocDate('013196')).toBe(1996);
    expect(parseDocDate('072020')).toBe(2020);
  });

  it('pivots the two-digit year at the current year', () => {
    expect(parseDocDate('010124')).toBe(2024);
    expect(parseDocDate('010199')).toBe(1999);
  });

  it('rejects impossible dates rather than deriving a year from a corrupt field', () => {
    expect(parseDocDate('991301')).toBeNull(); // month 99
    expect(parseDocDate('009901')).toBeNull(); // month 00
    expect(parseDocDate('013296')).toBeNull(); // day 32
  });

  it('rejects anything that is not six digits', () => {
    expect(parseDocDate('')).toBeNull();
    expect(parseDocDate(null)).toBeNull();
    expect(parseDocDate('13196')).toBeNull();
    expect(parseDocDate('ABCDEF')).toBeNull();
  });
});

describe('classifyVintage — the four measured conditions of use', () => {
  it('accepts a full-value transfer in an index-backed year', () => {
    const v = classifyVintage('013196', '1');
    expect(v.year).toBe(1996);
    expect(v.reliability).toBe('usable');
  });

  it('rejects a non-full-value transfer', () => {
    // DOCTYPE 2 and up carry assessed values 1.5-1.75x below type 1, which
    // matches Prop 13 exclusions preserving the prior basis.
    const v = classifyVintage('081713', '3');
    expect(v.year).toBe(2013);
    expect(v.reliability).toBe('excluded-transfer');
    expect(v.explanation).toMatch(/parent-child transfers/);
  });

  it('names the actual document type in its explanation', () => {
    // Confirmed against the county data dictionary, so the user can be told
    // what the instrument was rather than only that it was rejected.
    expect(classifyVintage('081713', '2').explanation).toMatch(/quit claim/i);
    expect(classifyVintage('081713', '6').explanation).toMatch(/trustees deed/i);
  });

  it('rejects a grant deed to a trust or entity as non-arm\'s-length', () => {
    // Measured: this class agrees with the comparable path 23-33% of the time
    // against 66-69% for individually-owned parcels, median ratio near 0.5.
    for (const owner of ['SMITH FAMILY TRUST', 'ACME HOLDINGS LLC', 'JONES J TR', 'BAY PROPERTIES INC']) {
      const v = classifyVintage('013122', '1', owner);
      expect(v.reliability).toBe('non-arms-length');
      expect(v.explanation).toMatch(/excluded from\s+reassessment/);
    }
  });

  it('accepts a grant deed to a natural person', () => {
    expect(classifyVintage('013122', '1', 'SMITH JOHN A').reliability).toBe('usable');
    expect(classifyVintage('013122', '1', 'GARCIA MARIA').reliability).toBe('usable');
  });

  it('skips the owner check when no name is supplied', () => {
    // Backward compatible, but callers should pass the name — this is the
    // largest single source of bad vintages, 45% of recent grant deeds.
    expect(classifyVintage('013122', '1').reliability).toBe('usable');
  });

  it('applies the owner check before the Prop 8 window', () => {
    // A 2005 trust conveyance is non-arm's-length first; both reject, but the
    // explanation the user sees should name the real reason.
    expect(classifyVintage('061505', '1', 'SMITH FAMILY TRUST').reliability).toBe(
      'non-arms-length',
    );
  });

  it('rejects the 2004-2007 bubble window as Prop 8 suspect', () => {
    for (const d of ['061504', '061505', '061506', '061507']) {
      expect(classifyVintage(d, '1').reliability).toBe('prop8-suspect');
    }
    // Boundaries are exclusive on both sides.
    expect(classifyVintage('061503', '1').reliability).toBe('usable');
    expect(classifyVintage('061508', '1').reliability).toBe('usable');
  });

  it('rejects years with too few FHFA tracts to index against', () => {
    // 1985 rests on 129 tracts, 1975 on a single one.
    const v = classifyVintage('010180', '1');
    expect(v.year).toBe(1980);
    expect(v.reliability).toBe('thin-index');
  });

  it('reports an unparseable date rather than guessing', () => {
    const v = classifyVintage('', '1');
    expect(v.year).toBeNull();
    expect(v.reliability).toBe('unparseable');
  });

  it('always explains itself', () => {
    for (const [d, t] of [['013196', '1'], ['081713', '3'], ['061505', '1'], ['010180', '1'], ['', '1']]) {
      expect(classifyVintage(d, t).explanation.length).toBeGreaterThan(40);
    }
  });
});

describe('DOCTYPE_MEANINGS — confirmed against the county data dictionary', () => {
  it('records the two codes the valuation logic turns on', () => {
    // SanGIS PARCELS metadata, from the Assessor's Master Property Record.
    // The behavioural inference was correct on both.
    expect(DOCTYPE_MEANINGS['1']).toBe('Grant deed');
    expect(DOCTYPE_MEANINGS['2']).toBe('Quit claim');
  });

  it('treats only the grant deed as a full transfer', () => {
    expect(FULL_TRANSFER_DOCTYPE).toBe('1');
    expect(DOCTYPE_MEANINGS[FULL_TRANSFER_DOCTYPE]).toBe('Grant deed');
  });

  it('covers every code observed in the live layer', () => {
    // Observed counts: 0,1,2,3,4,5,6,7 all present across 1,088,673 records.
    for (const code of ['0', '1', '2', '3', '4', '5', '6', '7', '8']) {
      expect(DOCTYPE_MEANINGS[code]).toBeDefined();
    }
  });
});

describe('toSanDiegoParcelValuation', () => {
  it('maps a live record', () => {
    const v = toSanDiegoParcelValuation(LIVE_FULL_TRANSFER_1996);
    expect(v.apn).toBe('4982604500');
    expect(v.landValue).toBe(266867);
    expect(v.improvementValue).toBe(88944);
    expect(v.livingAreaSqFt).toBe(1103);
    expect(v.landValuePerSqFt).toBeCloseTo(266867 / 57767, 6);
    expect(v.vintage.reliability).toBe('usable');
  });

  it('composes the situs address from its separate columns', () => {
    // The county splits house number, pre-dir, street, suffix and post-dir.
    // This record has a pre-directional, which must survive composition.
    expect(toSanDiegoParcelValuation(LIVE_FULL_TRANSFER_1996).situsFullAddress).toBe(
      '1590 E CHASE AVE',
    );
    expect(toSanDiegoParcelValuation(LIVE_EXCLUDED_2013).situsFullAddress).toBe('1640 CHASE LN');
  });

  it('rejects an exempt parcel rather than emitting $0/sq ft', () => {
    expect(() => toSanDiegoParcelValuation({ ...LIVE_FULL_TRANSFER_1996, ASR_LAND: 0 })).toThrow(
      /non-positive land value/,
    );
  });

  it('rejects a non-positive parcel area', () => {
    expect(() =>
      toSanDiegoParcelValuation({ ...LIVE_FULL_TRANSFER_1996, 'Shape.STArea()': 0 }),
    ).toThrow(/non-positive parcel area/);
  });

  it('tolerates a null living area', () => {
    const v = toSanDiegoParcelValuation({ ...LIVE_FULL_TRANSFER_1996, TOTAL_LVG_AREA: null });
    expect(v.livingAreaSqFt).toBeNull();
  });
});

describe('marketAdjustSanDiegoParcel', () => {
  it('indexes a usable vintage forward', () => {
    const v = toSanDiegoParcelValuation(LIVE_FULL_TRANSFER_1996);
    const adj = marketAdjustSanDiegoParcel(v);
    expect(adj).not.toBeNull();
    // 1996 HPI 89.72 -> 2025 HPI 493.05
    expect(adj!.indexRatio).toBeCloseTo(493.05 / 89.72, 6);
    expect(adj!.indexedLandValue).toBeCloseTo(266867 * (493.05 / 89.72), 4);
    expect(adj!.vintageYear).toBe(1996);
  });

  it('refuses to adjust anything that is not usable', () => {
    // No "adjust anyway with a caveat" path — an unreliable vintage produces a
    // different quantity, not a weaker estimate.
    for (const attrs of [
      LIVE_EXCLUDED_2013,
      { ...LIVE_FULL_TRANSFER_1996, DOCDATE: '061505' },
      { ...LIVE_FULL_TRANSFER_1996, DOCDATE: '010180' },
      { ...LIVE_FULL_TRANSFER_1996, DOCDATE: '' },
    ]) {
      expect(marketAdjustSanDiegoParcel(toSanDiegoParcelValuation(attrs))).toBeNull();
    }
  });

  it('says the vintage is inferred, not a published base year', () => {
    const adj = marketAdjustSanDiegoParcel(toSanDiegoParcelValuation(LIVE_FULL_TRANSFER_1996));
    expect(adj!.note).toMatch(/not from a published assessment base year/);
    expect(adj!.note).toMatch(/not an appraisal/);
  });
});

describe('parseSanDiegoAddress', () => {
  it('strips a suffix the county stores separately', () => {
    expect(parseSanDiegoAddress('5102 Enelra Pl')).toEqual({
      houseNumber: 5102,
      street: 'ENELRA',
    });
  });

  it('keeps multi-word street names intact', () => {
    // The county stores values such as "PAUL JONES".
    expect(parseSanDiegoAddress('3741 Paul Jones Ave')).toEqual({
      houseNumber: 3741,
      street: 'PAUL JONES',
    });
  });

  it('works when the user omits the suffix', () => {
    expect(parseSanDiegoAddress('4212 Dakota')).toEqual({ houseNumber: 4212, street: 'DAKOTA' });
  });

  it('rejects a line with no house number', () => {
    expect(() => parseSanDiegoAddress('Dakota Drive')).toThrow(/house number/);
  });
});

describe('where-clause safety', () => {
  it('doubles quotes and neutralises wildcards', () => {
    expect(escapeSqlLiteral("O'BRIEN")).toBe("O''BRIEN");
    expect(escapeSqlLiteral('100%')).toBe('100[%]');
  });

  it('rejects a malformed APN instead of sanitizing it', async () => {
    const p = createSanDiegoAssessorProvider({ fetchImpl: stubFetch({ features: [] }) });
    await expect(p.fetchByApn("498' OR '1'='1")).rejects.toThrow(/not a well-formed/);
  });
});

describe('createSanDiegoAssessorProvider', () => {
  it('returns a valuation for a single match', async () => {
    const p = createSanDiegoAssessorProvider({
      fetchImpl: stubFetch({ features: [{ attributes: LIVE_FULL_TRANSFER_1996 }] }),
    });
    const r = await p.findByAddress('1590 E Chase Ave', '92020');
    expect(r.status).toBe('found');
    if (r.status === 'found') expect(r.valuation.landValue).toBe(266867);
  });

  it('reports ambiguity rather than pricing an arbitrary neighbour', async () => {
    const p = createSanDiegoAssessorProvider({
      fetchImpl: stubFetch({
        features: [{ attributes: LIVE_FULL_TRANSFER_1996 }, { attributes: LIVE_EXCLUDED_2013 }],
      }),
    });
    const r = await p.findByAddress('1590 E Chase Ave');
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') expect(r.candidates).toHaveLength(2);
  });

  it('surfaces HTTP and Esri 200-with-error failures', async () => {
    await expect(
      createSanDiegoAssessorProvider({ fetchImpl: stubFetch({}, false, 503) }).findByAddress(
        '1590 E Chase Ave',
      ),
    ).rejects.toThrow(SanDiegoLookupError);

    await expect(
      createSanDiegoAssessorProvider({
        fetchImpl: stubFetch({ error: { code: 400, message: 'Invalid where clause' } }),
      }).findByAddress('1590 E Chase Ave'),
    ).rejects.toThrow(/Invalid where clause/);
  });

  it('degrades to not-found in the no-op provider', async () => {
    expect(await noOpSanDiegoProvider.fetchByApn('4982604500')).toBeNull();
    expect((await noOpSanDiegoProvider.findByAddress('anywhere')).status).toBe('not-found');
  });
});

describe('San Diego HPI data', () => {
  it('gates the sparse early years', () => {
    // 1975 rests on a single tract; a median over one tract is not an index.
    expect(SAN_DIEGO_HPI_TRACT_COUNT_BY_YEAR[1975]).toBe(1);
    expect(isReliableHpiYear(1975)).toBe(false);
    expect(isReliableHpiYear(1985)).toBe(false);
    expect(isReliableHpiYear(1986)).toBe(true);
  });

  it('records the measured troughs rather than a smooth curve', () => {
    // 1995 and 2010 are real declines; smoothing them away would hide the
    // housing cycle the validation relies on.
    expect(SAN_DIEGO_HPI_BY_YEAR[1995]!).toBeLessThan(SAN_DIEGO_HPI_BY_YEAR[1990]!);
    expect(SAN_DIEGO_HPI_BY_YEAR[2010]!).toBeLessThan(SAN_DIEGO_HPI_BY_YEAR[2005]!);
  });

  it('has an index and a tract count for every year', () => {
    for (const y of Object.keys(SAN_DIEGO_HPI_BY_YEAR)) {
      expect(SAN_DIEGO_HPI_TRACT_COUNT_BY_YEAR[Number(y)]).toBeDefined();
    }
  });
});
