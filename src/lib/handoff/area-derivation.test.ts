import { describe, expect, it } from 'vitest';
import {
  AreaDerivationError,
  buildEncumberedArea,
  describeAreaDerivation,
  type AreaDerivation,
} from './area-derivation';

const published: AreaDerivation = {
  kind: 'published-field',
  layer: 'Segment3ROWParcels',
  field: 'AREA_SF',
  queriedOn: '2026-08-02',
};

const computed: AreaDerivation = {
  kind: 'geometry-computed',
  layer: 'LACounty_Parcel',
  method: 'Shape.STArea()',
  spatialReference: 'EPSG:2229 (NAD83 California zone 5, US survey feet)',
  queriedOn: '2026-08-02',
};

describe('no area without a derivation', () => {
  it('returns null when the derivation is unknown', () => {
    // An unexplained figure is indistinguishable from a measured one once it
    // reaches a page, so it must not be produced at all.
    expect(buildEncumberedArea(1204, null)).toBeNull();
  });

  it('returns null when the area itself is unknown', () => {
    expect(buildEncumberedArea(null, published)).toBeNull();
  });

  it('rejects a non-positive area rather than emitting it', () => {
    expect(() => buildEncumberedArea(0, published)).toThrow(AreaDerivationError);
    expect(() => buildEncumberedArea(Number.NaN, published)).toThrow(AreaDerivationError);
  });
});

describe('spatial reference is carried, not assumed', () => {
  it('names the spatial reference in the derivation note', () => {
    // Reading a Web Mercator area as square feet understated a real easement
    // ~8x. The unit is the difference between a right answer and a plausible
    // wrong one, so it travels with the number.
    const s = buildEncumberedArea(9771, computed, 43560)!;
    expect(s.derivationNote).toMatch(/EPSG:2229/);
    expect(s.derivationNote).toMatch(/spatial reference/i);
  });

  it('cannot construct a geometry derivation without one', () => {
    // @ts-expect-error spatialReference is required on geometry-computed
    const bad: AreaDerivation = {
      kind: 'geometry-computed',
      layer: 'X',
      method: 'Shape.STArea()',
      queriedOn: '2026-08-02',
    };
    expect(bad.kind).toBe('geometry-computed');
  });
});

describe('every derivation states its own weakness', () => {
  it('says a published field is the publisher figure, not a measurement', () => {
    expect(describeAreaDerivation(published)).toMatch(/publisher/);
  });

  it('says stated dimensions assume a rectangle', () => {
    const note = describeAreaDerivation({
      kind: 'dimensions-stated',
      widthFt: 22.5,
      lengthFt: 352,
      documentRef: 'Plat Book 11, Page 7',
    });
    expect(note).toMatch(/rectangular/);
    expect(note).toMatch(/Plat Book 11, Page 7/);
  });

  it('says a user-asserted area is unverified', () => {
    expect(describeAreaDerivation({ kind: 'user-asserted' })).toMatch(/not verified/);
  });
});

describe('share of parcel', () => {
  it('computes the ratio when parcel area is known', () => {
    const s = buildEncumberedArea(1204, published, 14474)!;
    expect(s.shareOfParcel).toBeCloseTo(1204 / 14474, 6);
  });

  it('is null rather than guessed when parcel area is unknown', () => {
    expect(buildEncumberedArea(1204, published)!.shareOfParcel).toBeNull();
    expect(buildEncumberedArea(1204, published, 0)!.shareOfParcel).toBeNull();
  });
});

describe('stated dimensions', () => {
  it('rejects a zero dimension', () => {
    expect(() =>
      buildEncumberedArea(100, {
        kind: 'dimensions-stated',
        widthFt: 0,
        lengthFt: 352,
        documentRef: 'x',
      }),
    ).toThrow(/positive/);
  });
});
