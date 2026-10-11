import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setOutcomeSink, type OutcomeSink } from '@/lib/observability/outcome-log';
import { lookupParcel, normaliseCountyName, SUPPORTED_COUNTIES } from './county-dispatch';
import { ORANGE_COUNTY_STALENESS_CAVEAT } from '@/lib/risk-disclosure';
import type { NormalizedAddress } from '@/lib/parcel-resolution/types';

/**
 * Attribute fixtures copied from the provider suites, which recorded them from
 * live services. Reusing them keeps this suite honest about field names — a
 * hand-invented payload would pass while the real shape had drifted.
 */
const LA_ATTRS = {
  AIN: '2004001003',
  APN: '2004-001-003',
  SitusFullAddress: '8321 FAUST AVE LOS ANGELES CA 91304',
  Roll_Year: '2026',
  Roll_LandValue: 740440,
  Roll_ImpValue: 313342,
  Roll_LandBaseYear: '2001',
  'Shape.STArea()': 9685.58203125,
};

const OC_ATTRS = {
  AssessmentNo: '071-334-14',
  SiteAddress: '1251 N ALAMO ST',
  SiteZip5: '92801',
  LandVal: '531538',
  ImprovedVal: '72714',
  AssdAmt: null,
  'Shape.STArea()': 6278.8101519153415,
};

const SD_ATTRS = {
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

function stubFetch(payload: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
}

function failingFetch(): typeof fetch {
  return (async () => {
    throw new TypeError('socket hang up');
  }) as unknown as typeof fetch;
}

function address(county: string | undefined, over: Partial<NormalizedAddress> = {}): NormalizedAddress {
  return {
    street: '1251 N ALAMO ST',
    city: 'Anaheim',
    state: 'CA',
    zip: '92801',
    zipPlus4: null,
    county,
    ...over,
  };
}

/*
 * Every lookup in this file now emits an outcome record, so the default sink
 * would spray a dozen JSON lines across CI output for tests that are not
 * about logging. Discard by default; the instrumentation suite below installs
 * its own capturing sink and restores this one.
 */
let silenced: OutcomeSink;
beforeAll(() => {
  silenced = setOutcomeSink({ write: () => {} });
});
afterAll(() => {
  setOutcomeSink(silenced);
});

describe('unsupported is not the same as not-found', () => {
  it('reports unsupported-county for a county with no provider', async () => {
    // Reporting "no parcel found" here would describe a search that never
    // happened — the same distinction registry.ts draws for records requests.
    const r = await lookupParcel(address('Ventura County'), { fetchImpl: stubFetch({ features: [] }) });
    expect(r.status).toBe('unsupported-county');
    if (r.status !== 'unsupported-county') return;
    expect(r.explanation).toMatch(/no search was performed/);
    expect(r.explanation).toMatch(/must not be reported as one/);
  });

  it('reports unsupported when no county was resolved at all', async () => {
    const r = await lookupParcel(address(undefined), { fetchImpl: stubFetch({ features: [] }) });
    expect(r.status).toBe('unsupported-county');
  });

  it('reports not-found only where a search actually ran', async () => {
    const r = await lookupParcel(address('Orange County'), { fetchImpl: stubFetch({ features: [] }) });
    expect(r.status).toBe('not-found');
    if (r.status === 'not-found') expect(r.serviceUrl).toContain('ocgis.com');
  });

  it('names exactly the counties it covers', () => {
    // Cook County added 2026-10-07, after launch — the first outside
    // California, and the first on an assessment regime other than
    // Proposition 13.
    expect(SUPPORTED_COUNTIES).toEqual([
      'Los Angeles County',
      'Orange County',
      'San Diego County',
      'Cook County',
    ]);
  });

  it('matches Cook by either spelling', () => {
    expect(normaliseCountyName('Cook')).toBe('Cook County');
    expect(normaliseCountyName('Cook County')).toBe('Cook County');
  });
});

describe('county name matching', () => {
  it('accepts both "Orange" and "Orange County"', () => {
    expect(normaliseCountyName('Orange')).toBe('Orange County');
    expect(normaliseCountyName('Orange County')).toBe('Orange County');
    expect(normaliseCountyName('  los angeles  ')).toBe('Los Angeles County');
  });

  it('returns null rather than guessing', () => {
    expect(normaliseCountyName('Riverside')).toBeNull();
    expect(normaliseCountyName(undefined)).toBeNull();
  });
});

describe('all three counties are reachable', () => {
  it('LA County resolves, carrying its base year', async () => {
    const r = await lookupParcel(address('Los Angeles'), {
      fetchImpl: stubFetch({ features: [{ attributes: LA_ATTRS }] }),
      today: '2026-08-17',
    });
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    expect(r.valuation.landValue).toBe(740440);
    // The distinguishing fact: LA publishes Roll_LandBaseYear, so a frozen
    // assessment can be indexed forward. The other two cannot.
    expect(r.valuation.landBaseYear).toBe('2001');
    expect(r.valuation.rollYear).toBe('2026');
    expect(r.valuation.caveats).toEqual([]);
  });

  it('Orange County resolves, with no base year and the staleness caveat', async () => {
    const r = await lookupParcel(address('Orange County'), {
      fetchImpl: stubFetch({ features: [{ attributes: OC_ATTRS }] }),
    });
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    expect(r.valuation.landValue).toBe(531538);
    // Structurally null, never defaulted from a roll year that also does not
    // exist here. Two comparable lots on one street differ by 2.2x and the
    // distortion cannot be corrected, so the figure travels with its warning.
    expect(r.valuation.landBaseYear).toBeNull();
    expect(r.valuation.rollYear).toBeNull();
    expect(r.valuation.caveats).toContain(ORANGE_COUNTY_STALENESS_CAVEAT);
  });

  it('San Diego resolves, with the DOCDATE vintage carried as a caveat', async () => {
    const r = await lookupParcel(address('San Diego', { street: '1590 E Chase Ave', zip: '92020' }), {
      fetchImpl: stubFetch({ features: [{ attributes: SD_ATTRS }] }),
    });
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    expect(r.valuation.landValue).toBe(266867);
    // A recovered vintage is not a published base year, so it does not get
    // promoted into that field. It travels with its reliability grade.
    expect(r.valuation.landBaseYear).toBeNull();
    expect(r.valuation.caveats[0]).toMatch(/vintage recovered from DOCDATE/);
    expect(r.valuation.caveats[0]).toMatch(/reliability:/);
  });
});

describe('ambiguity is reported, never resolved by guessing', () => {
  it('returns candidates rather than pricing an arbitrary neighbour', async () => {
    const r = await lookupParcel(address('Orange County', { street: '2100 W Huntington' }), {
      fetchImpl: stubFetch({
        features: [{ attributes: OC_ATTRS }, { attributes: { ...OC_ATTRS, AssessmentNo: '071-334-15' } }],
      }),
    });
    expect(r.status).toBe('ambiguous');
    if (r.status !== 'ambiguous') return;
    expect(r.candidates).toHaveLength(2);
    expect(r.candidates[0]!.apn).toBe('071-334-14');
  });
});

describe('a service failure degrades, it does not throw', () => {
  it('returns service-error so the page can still render', async () => {
    // A lookup failure must not sink the report. The county figure is one
    // input; the rest of the analysis does not depend on it.
    const r = await lookupParcel(address('Orange County'), { fetchImpl: failingFetch() });
    expect(r.status).toBe('service-error');
    if (r.status === 'service-error') expect(r.message.length).toBeGreaterThan(0);
  });
});

describe('provenance travels with the figure', () => {
  it('records the service queried and the date', async () => {
    const r = await lookupParcel(address('Los Angeles'), {
      fetchImpl: stubFetch({ features: [{ attributes: LA_ATTRS }] }),
      today: '2026-08-17',
    });
    if (r.status !== 'found') throw new Error('expected found');
    expect(r.valuation.serviceUrl).toContain('lacounty.gov');
    expect(r.valuation.queriedOn).toBe('2026-08-17');
    expect(r.valuation.fipsCode).toBe('06037');
  });
});

describe('the lookup is on the record, because once it was not', () => {
  /*
   * THE BUG THIS SUITE EXISTS FOR. 'county-parcel' was declared in
   * UpstreamService the day outcome-log.ts was written and wired to nothing.
   * San Diego then returned service-error for every address for an unknown
   * stretch, the fallback to national benchmarks did its job quietly, and the
   * only reason anybody found out was a hand-run latency measurement. The
   * slowest upstream, the only one with per-county behaviour, was the one
   * upstream production was not watching.
   */
  function capture(): { lines: string[]; restore: () => void } {
    const lines: string[] = [];
    const previous = setOutcomeSink({ write: (line) => lines.push(line) });
    return { lines, restore: () => setOutcomeSink(previous) };
  }

  async function recordFor(
    ...args: Parameters<typeof lookupParcel>
  ): Promise<Record<string, unknown>> {
    const { lines, restore } = capture();
    try {
      await lookupParcel(...args);
    } finally {
      restore();
    }
    const parcel = lines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .filter((r) => r.service === 'county-parcel');
    expect(parcel, 'no county-parcel record was emitted').toHaveLength(1);
    return parcel[0]!;
  }

  it('records ok, with the state and county, on a hit', async () => {
    const rec = await recordFor(address('Los Angeles'), {
      fetchImpl: stubFetch({ features: [{ attributes: LA_ATTRS }] }),
    });
    expect(rec.result).toBe('ok');
    expect(rec.reason).toBeUndefined();
    expect(rec.state).toBe('CA');
    // 'found' carries the county inside the valuation, not at the top level.
    expect(rec.county).toBe('Los Angeles County');
    expect(typeof rec.durationMs).toBe('number');
  });

  it('records failed on a service error, which is the one worth paging about', async () => {
    const rec = await recordFor(address('Orange County'), { fetchImpl: failingFetch() });
    expect(rec.result).toBe('failed');
    expect(rec.reason).toBe('network');
    expect(rec.county).toBe('Orange County');
  });

  it('records not-found as degraded rather than failed', async () => {
    /*
     * A county that genuinely has no parcel at an address is the ordinary
     * result of a typo. Counting it as a failure would put a permanent floor
     * under the failure rate and make the San Diego signal unreadable.
     */
    const rec = await recordFor(address('Orange County'), { fetchImpl: stubFetch({ features: [] }) });
    expect(rec.result).toBe('degraded');
    expect(rec.reason).toBe('no-match');
  });

  it('records an unsupported county as degraded, with no-coverage', async () => {
    const rec = await recordFor(address('Ventura County'), { fetchImpl: stubFetch({ features: [] }) });
    expect(rec.result).toBe('degraded');
    expect(rec.reason).toBe('no-coverage');
    expect(rec.county).toBe('Ventura County');
  });

  it('survives a county the geocoder could not name', async () => {
    const rec = await recordFor(address(undefined), { fetchImpl: stubFetch({ features: [] }) });
    expect(rec.result).toBe('degraded');
    expect(rec.county).toBeUndefined();
  });

  it('puts no part of the address in the log, on any path', async () => {
    /*
     * THE WHOLE POINT OF THE CLOSED UNION IN outcome-log.ts, asserted from the
     * outside. The street and ZIP below are in the fixture address and in the
     * upstream request URL; a service-error path that logged err.message would
     * leak them, and 'socket hang up' is exactly the sort of message that
     * quotes a URL. Checked across every status so a future branch cannot be
     * the exception.
     */
    const cases: Array<Parameters<typeof lookupParcel>> = [
      [address('Los Angeles'), { fetchImpl: stubFetch({ features: [{ attributes: LA_ATTRS }] }) }],
      [address('Orange County'), { fetchImpl: failingFetch() }],
      [address('Orange County'), { fetchImpl: stubFetch({ features: [] }) }],
      [address('Ventura County'), { fetchImpl: stubFetch({ features: [] }) }],
    ];
    for (const args of cases) {
      const serialised = JSON.stringify(await recordFor(...args));
      for (const secret of ['1251', 'ALAMO', 'Anaheim', '92801']) {
        expect(serialised, `address leaked into the log: ${secret}`).not.toContain(secret);
      }
    }
  });
});
