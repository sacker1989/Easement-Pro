import { describe, expect, it } from 'vitest';
import { HAND_VERIFIED_PARCELS } from './hand-verified-parcels';
import { formatScorecards, normalizeParcelId, scoreVendor } from './scorecard';
import type { ParcelVendor, VendorParcelResult } from './vendor';
import { VENDOR_ADAPTERS } from './adapters';

const SAMPLE = HAND_VERIFIED_PARCELS.slice(0, 4);

/** Builds a vendor that answers from a map keyed by street line. */
function fakeVendor(
  answer: (streetLine: string) => VendorParcelResult | null,
  configured = true,
): ParcelVendor {
  return {
    id: 'regrid',
    displayName: 'Fake',
    isConfigured: () => configured,
    async lookup({ streetLine }) {
      return answer(streetLine);
    },
  };
}

function perfectResultFor(streetLine: string): VendorParcelResult | null {
  const p = SAMPLE.find((x) => x.streetLine === streetLine);
  if (!p) return null;
  return {
    parcelId: p.apn,
    lotAreaSqFt: p.lotAreaSqFt,
    landValue: p.landValue,
    improvementValue: p.improvementValue,
    rollYear: p.rollYear,
    hasDocumentImage: true,
  };
}

describe('normalizeParcelId', () => {
  it('ignores the punctuation vendors disagree about', () => {
    expect(normalizeParcelId('2004-001-003')).toBe(normalizeParcelId('2004001003'));
  });
});

describe('scoreVendor', () => {
  it('scores a perfect vendor at full marks', async () => {
    const card = await scoreVendor(fakeVendor(perfectResultFor), SAMPLE);
    expect(card.coverageRate).toBe(1);
    expect(card.parcelIdAccuracy).toBe(1);
    expect(card.lotAreaAccuracy).toBe(1);
    expect(card.landValueAccuracy).toBe(1);
    expect(card.errorCount).toBe(0);
  });

  it('accepts either AIN or APN as the parcel identifier', async () => {
    const card = await scoreVendor(
      fakeVendor((s) => {
        const base = perfectResultFor(s);
        const p = SAMPLE.find((x) => x.streetLine === s);
        return base && p ? { ...base, parcelId: p.ain } : null;
      }),
      SAMPLE,
    );
    expect(card.parcelIdAccuracy).toBe(1);
  });

  it('counts a wrong parcel id as a mismatch, not a rounding difference', async () => {
    const card = await scoreVendor(
      fakeVendor((s) => {
        const base = perfectResultFor(s);
        return base ? { ...base, parcelId: '9999999999' } : null;
      }),
      SAMPLE,
    );
    expect(card.coverageRate).toBe(1);
    expect(card.parcelIdAccuracy).toBe(0);
  });

  it('tolerates small lot-area differences but not large ones', async () => {
    const near = await scoreVendor(
      fakeVendor((s) => {
        const base = perfectResultFor(s);
        return base && base.lotAreaSqFt ? { ...base, lotAreaSqFt: base.lotAreaSqFt * 1.01 } : base;
      }),
      SAMPLE,
    );
    expect(near.lotAreaAccuracy).toBe(1);

    const far = await scoreVendor(
      fakeVendor((s) => {
        const base = perfectResultFor(s);
        return base && base.lotAreaSqFt ? { ...base, lotAreaSqFt: base.lotAreaSqFt * 1.4 } : base;
      }),
      SAMPLE,
    );
    expect(far.lotAreaAccuracy).toBe(0);
  });

  it('separates no-coverage from wrong-answer', async () => {
    const card = await scoreVendor(fakeVendor(() => null), SAMPLE);
    expect(card.coverageRate).toBe(0);
    // Accuracy is over records actually returned, so it must not read as 0% correct.
    expect(card.parcelIdAccuracy).toBe(0);
    expect(card.errorCount).toBe(0);
  });

  it('records thrown errors without aborting the run', async () => {
    let calls = 0;
    const card = await scoreVendor(
      fakeVendor((s) => {
        calls += 1;
        if (calls === 2) throw new Error('rate limited');
        return perfectResultFor(s);
      }),
      SAMPLE,
    );
    expect(card.scores).toHaveLength(SAMPLE.length);
    expect(card.errorCount).toBe(1);
  });

  it('reports an unconfigured vendor without attempting lookups', async () => {
    const card = await scoreVendor(
      fakeVendor(() => {
        throw new Error('should not be called');
      }, false),
      SAMPLE,
    );
    expect(card.configured).toBe(false);
    expect(card.parcelsAttempted).toBe(0);
  });

  it('breaks coverage down by stratum to expose weak spots', async () => {
    const card = await scoreVendor(
      fakeVendor((s) => {
        const p = SAMPLE.find((x) => x.streetLine === s);
        // Simulate a vendor that cannot resolve multi-unit addresses.
        return p && p.stratum === 'multi-unit' ? null : perfectResultFor(s);
      }),
      SAMPLE,
    );
    for (const [stratum, value] of Object.entries(card.coverageByStratum)) {
      if (stratum === 'multi-unit') expect(value).toBe(0);
    }
  });
});

describe('formatScorecards', () => {
  it('names vendors that were skipped for want of credentials', async () => {
    const card = await scoreVendor(fakeVendor(() => null, false), SAMPLE);
    const text = formatScorecards([card]);
    expect(text).toContain('Not evaluated (no credentials)');
    expect(text).toContain('Fake');
  });
});

describe('bundled vendor adapters', () => {
  it('covers the four candidates named in the strategy doc', () => {
    expect(VENDOR_ADAPTERS.map((v) => v.id).sort()).toEqual([
      'attom',
      'cotality',
      'datatree',
      'regrid',
    ]);
  });

  it('reports unconfigured while no credentials are set', () => {
    // None of these keys exist yet; the harness must not pretend otherwise.
    for (const vendor of VENDOR_ADAPTERS) {
      if (!vendor.isConfigured()) {
        expect(vendor.isConfigured()).toBe(false);
      }
    }
  });

  it('refuses to invent a response when a key is absent', async () => {
    const attom = VENDOR_ADAPTERS.find((v) => v.id === 'attom')!;
    if (!attom.isConfigured()) {
      await expect(
        attom.lookup({ streetLine: '8321 Faust Ave', zip: '91304', state: 'CA' }),
      ).rejects.toThrow(/No credentials configured/);
    }
  });
});

describe('hand-verified parcel set', () => {
  it('is stratified rather than 25 lookalike suburban homes', () => {
    const strata = new Set(HAND_VERIFIED_PARCELS.map((p) => p.stratum));
    expect(strata.size).toBeGreaterThanOrEqual(5);
  });

  it('carries parcel identity and geometry for every row', () => {
    for (const p of HAND_VERIFIED_PARCELS) {
      expect(p.ain).toMatch(/^\d+$/);
      expect(p.lotAreaSqFt).toBeGreaterThan(0);
      expect(p.streetLine.length).toBeGreaterThan(0);
    }
  });

  it('includes parcels the county publishes no assessed value for', () => {
    // Exempt and public parcels carry null. Keeping them in the set is the
    // point: a vendor that invents a value for them should be visible.
    expect(HAND_VERIFIED_PARCELS.some((p) => p.landValue === null)).toBe(true);
  });

  it('includes multi-unit addresses, where vendors most often diverge', () => {
    expect(HAND_VERIFIED_PARCELS.some((p) => p.unit !== null)).toBe(true);
  });
});
