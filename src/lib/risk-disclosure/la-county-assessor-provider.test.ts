import { describe, expect, it, vi } from 'vitest';
import {
  AssessorLookupError,
  createLaCountyAssessorProvider,
  noOpAssessorProvider,
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

    const firstCall = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall).toBeDefined();
    const url = String(firstCall![0]);
    expect(url).toContain('Roll_LandValue');
    expect(url).toContain('Shape.STArea');
    expect(url).toContain('returnGeometry=false');
  });
});

describe('noOpAssessorProvider', () => {
  it('returns null so estimates degrade instead of failing', async () => {
    expect(await noOpAssessorProvider.fetchByAin('2004001003')).toBeNull();
  });
});
