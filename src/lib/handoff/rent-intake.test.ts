import { describe, expect, it } from 'vitest';
import {
  applyObservedRent,
  buildAppraiserRentRequest,
  RENT_REQUEST_CONSTRAINT,
  type HandoffRentRate,
  type RentTerms,
} from './rent-intake';
import { buildReferralPackage, type ParcelIdentity } from './referral-package';
import { buildEncumberedArea } from './area-derivation';
import { FLOOR_KEYS } from './not-determined';
import { renderJson, renderMarkdown, renderPlainText, ILLUSTRATIVE_BANNER } from './render';
import { assessEvidenceTier } from '@/lib/easements/evidence-tier';
import { NASS_AGRICULTURAL_RENT, TemporaryEasementError } from '@/lib/valuation/temporary-easement';

function parcel(landClass: string | null): ParcelIdentity {
  return {
    parcelId: '104-27-013',
    county: 'Berks County',
    state: 'PA',
    fipsCode: '42011',
    routingTier: 'standard',
    situsAddress: null,
    ownerName: null,
    geometrySource: 'Berks/Parcels/FeatureServer/0',
    sourceVerifiedOn: '2026-08-10',
    landClass,
    landClassSource: landClass === null ? null : 'Berks County parcel layer, LANDUSE field',
  };
}

/** A package with an established area — the precondition for any rent. */
function pkgWithArea(landClass: string | null) {
  return buildReferralPackage({
    parcel: parcel(landClass),
    findings: [assessEvidenceTier(0)],
    evidenceSummary: 'A TCE recorded against the frontage.',
    fromRecordedEasements: true,
    provenance: { kind: 'recorded-document', instrumentNo: 'DB 1234 PG 567' },
    encumberedArea: buildEncumberedArea(
      1204,
      { kind: 'published-field', layer: 'FDOT_ROW', field: 'AREA_SF', queriedOn: '2026-08-12' },
      43_560,
    ),
    landValue: null,
    generatedAt: '2026-08-17T00:00:00.000Z',
    known: { isTemporary: true },
  });
}

const OBSERVED: HandoffRentRate = {
  perSqFtPerYear: 0.25,
  source: 'Three comparable ground leases on the same corridor, market study of 2026-06',
  observedOn: '2026-06-30',
  landClass: 'residential',
  landClassSource: 'Appraiser classification of the subject and the comparables',
};

const TERMS: RentTerms = { termYears: 2, durationBasis: 'term-limited' };

describe('a perpetual easement rejects a rent outright', () => {
  it('throws rather than valuing it', () => {
    // §4.6.5.1.2 is a temporary-acquisition measure. Running it on a perpetual
    // easement manufactures exactly the number §6 says does not exist — and it
    // would look like a measurement, because the arithmetic is real.
    expect(() =>
      applyObservedRent(pkgWithArea('residential'), OBSERVED, {
        ...TERMS,
        durationBasis: 'perpetual-express',
      }),
    ).toThrow(TemporaryEasementError);
    expect(() =>
      applyObservedRent(pkgWithArea('residential'), OBSERVED, {
        ...TERMS,
        durationBasis: 'perpetual-express',
      }),
    ).toThrow(/no term to rent/);
  });

  it('refuses when duration was never established', () => {
    expect(() =>
      applyObservedRent(pkgWithArea('residential'), OBSERVED, {
        ...TERMS,
        durationBasis: 'unknown',
      }),
    ).toThrow(/assumes the answer/);
  });
});

describe('a fee-derived rate is refused, not warned about', () => {
  it('propagates TemporaryEasementError rather than downgrading it', () => {
    // The throw is the feature. Catching it and rendering a warning would put
    // the §4.7 method into the package wearing the costume of a measurement.
    const feeDerived: HandoffRentRate = {
      ...OBSERVED,
      source: 'Capitalised land value at 8% of assessed fee',
    };
    expect(() => applyObservedRent(pkgWithArea('residential'), feeDerived, TERMS)).toThrow(
      TemporaryEasementError,
    );
    expect(() => applyObservedRent(pkgWithArea('residential'), feeDerived, TERMS)).toThrow(
      /improper to develop an opinion of the market rental value/,
    );
  });

  it('refuses a rate with no usable provenance', () => {
    expect(() =>
      applyObservedRent(pkgWithArea('residential'), { ...OBSERVED, source: 'est.' }, TERMS),
    ).toThrow(/provenance/);
  });
});

describe('land class is the whole magnitude, so a mismatch is refused', () => {
  const pasture: HandoffRentRate = {
    perSqFtPerYear: 0.00069,
    source: 'USDA NASS Berks County pasture cash rent, county estimate release',
    observedOn: '2025-09-01',
    landClass: 'pasture',
    landClassSource: 'NASS land class for the published rent',
  };

  it('refuses an agricultural rate on a residential parcel', () => {
    // The 360x trap: over 1,204 sq ft for two years the pasture rate yields
    // $1.66 against roughly $602 at a suburban rate. Not a rounding error.
    expect(() => applyObservedRent(pkgWithArea('residential'), pasture, TERMS)).toThrow(
      TemporaryEasementError,
    );
    expect(() => applyObservedRent(pkgWithArea('residential'), pasture, TERMS)).toThrow(/360x/);
    expect(NASS_AGRICULTURAL_RENT.invalidFor).toMatch(/360x/);
  });

  it('refuses when the parcel class is unknown, rather than assuming a match', () => {
    // Unknown is where the trap actually springs — an unclassified parcel is
    // exactly the one an agricultural rate slips onto.
    expect(() => applyObservedRent(pkgWithArea(null), pasture, TERMS)).toThrow(
      /land class is not recorded/,
    );
  });

  it('proceeds on an acknowledged mismatch, and says so prominently', () => {
    const applied = applyObservedRent(pkgWithArea('residential'), pasture, {
      ...TERMS,
      landClassMismatchAcknowledgement:
        'Subject frontage is unimproved and grazed; appraiser advised the pasture rate applies.',
    });
    expect(applied.temporary!.landClassMatch).toBe('acknowledged-mismatch');
    expect(applied.temporary!.mismatchNotice).toMatch(/LAND CLASS MISMATCH/);
    expect(applied.temporary!.mismatchNotice).toMatch(/360x/);
    // Leads the section, ahead of the figure a reader would otherwise anchor on.
    const out = renderPlainText(applied);
    expect(out.indexOf('LAND CLASS MISMATCH')).toBeLessThan(out.indexOf('Compensation:'));
  });

  it('passes silently on an exact match', () => {
    const applied = applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS);
    expect(applied.temporary!.landClassMatch).toBe('exact');
    expect(applied.temporary!.mismatchNotice).toBeNull();
  });

  it('rejects a token acknowledgement', () => {
    expect(() =>
      applyObservedRent(pkgWithArea('residential'), pasture, {
        ...TERMS,
        landClassMismatchAcknowledgement: 'ok',
      }),
    ).toThrow(TemporaryEasementError);
  });
});

describe('area must be established first', () => {
  it('refuses rather than assuming a width', () => {
    const noArea = buildReferralPackage({
      parcel: parcel('residential'),
      findings: [assessEvidenceTier(0)],
      evidenceSummary: 'A TCE recorded against the frontage.',
      fromRecordedEasements: true,
      provenance: { kind: 'recorded-document', instrumentNo: 'DB 1234 PG 567' },
      encumberedArea: null,
      landValue: null,
    });
    expect(() => applyObservedRent(noArea, OBSERVED, TERMS)).toThrow(/default width/);
  });
});

describe('a valued temporary easement removes nothing from the floor', () => {
  it('keeps all four floor items', () => {
    // A valued TCE says nothing about a perpetual encumbrance on the same
    // parcel. valueTemporaryEasement's own note says it "does not address any
    // permanent easement or damage to the remainder", so dropping the items
    // would contradict the note the package prints.
    const applied = applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS);
    const keys = applied.notDetermined.map((i) => i.key);
    for (const floor of FLOOR_KEYS) {
      expect(keys).toContain(floor);
    }
  });

  it('answers only the two items this call actually answers', () => {
    const before = pkgWithArea('residential').notDetermined.map((i) => i.key);
    const after = applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS).notDetermined.map(
      (i) => i.key,
    );
    const removed = before.filter((k) => !after.includes(k));
    expect(removed.sort()).toEqual(['observed-market-rent', 'temporary-term']);
  });

  it('computes the compensation from area and term alone', () => {
    // 1,204 sq ft x $0.25 x 2 years, no retained use, undiscounted.
    const applied = applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS);
    expect(applied.temporary!.valuation.compensation).toBeCloseTo(602, 2);
  });

  it('states what the figure does not cover', () => {
    const applied = applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS);
    expect(applied.temporary!.scopeNote).toMatch(/says nothing about any permanent easement/);
  });
});

describe('a hypothetical rate makes the whole package illustrative', () => {
  const hypothetical: HandoffRentRate = { ...OBSERVED, hypothetical: true };

  it('sets the flag and banners it in all three forms', () => {
    const applied = applyObservedRent(pkgWithArea('residential'), hypothetical, TERMS);
    expect(applied.illustrative).toBe(true);
    expect(renderPlainText(applied)).toContain(ILLUSTRATIVE_BANNER);
    expect(renderMarkdown(applied)).toContain(ILLUSTRATIVE_BANNER);
    expect(JSON.parse(renderJson(applied)).illustrative).toBe(true);
  });

  it('banners it before the figure, not as a footnote', () => {
    const out = renderPlainText(applyObservedRent(pkgWithArea('residential'), hypothetical, TERMS));
    expect(out.indexOf(ILLUSTRATIVE_BANNER)).toBeLessThan(out.indexOf('Compensation:'));
  });

  it('leaves the package non-illustrative for an observed rate', () => {
    expect(applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS).illustrative).toBe(false);
  });
});

describe('the rendered temporary section', () => {
  it('is absent entirely until a rent is applied', () => {
    // An empty heading would imply a temporary easement was checked for and
    // ruled out. Nothing checked.
    expect(pkgWithArea('residential').temporary).toBeNull();
    expect(renderPlainText(pkgWithArea('residential'))).not.toContain('TEMPORARY EASEMENT');
  });

  it('still passes the appraisal-claim scan with a figure present', () => {
    const applied = applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS);
    expect(() => renderPlainText(applied)).not.toThrow();
    expect(() => renderMarkdown(applied)).not.toThrow();
    expect(() => renderJson(applied)).not.toThrow();
  });

  it('keeps the not-determined section ahead of the compensation figure', () => {
    const out = renderPlainText(applyObservedRent(pkgWithArea('residential'), OBSERVED, TERMS));
    expect(out.indexOf('WHAT WAS NOT DETERMINED')).toBeLessThan(out.indexOf('$'));
  });
});

describe('the ask states the constraint before the request', () => {
  it('names the §4.7 prohibition and the courts-reject-it-anyway point', () => {
    // An appraiser who returns a capitalised land value has done work
    // assertObservedRate will throw on. Finding out afterwards is what makes
    // the next request go unanswered.
    expect(RENT_REQUEST_CONSTRAINT).toMatch(/improper to develop an opinion of the market rental/);
    expect(RENT_REQUEST_CONSTRAINT).toMatch(/EVEN WHERE COMPARABLE LEASES ARE UNAVAILABLE/);
  });

  it('arrives pre-filled rather than blank', () => {
    const ask = buildAppraiserRentRequest(pkgWithArea('residential'));
    expect(ask.parcelId).toBe('104-27-013');
    expect(ask.market).toBe('Berks County, PA');
    expect(ask.encumberedArea!.areaSqFt).toBe(1204);
    expect(ask.parcelLandClass).toBe('residential');
    expect(ask.parcelLandClassSource).toMatch(/LANDUSE/);
    expect(ask.whatIsNeeded.length).toBeGreaterThan(2);
  });

  it('points at the open term item when there is one', () => {
    expect(buildAppraiserRentRequest(pkgWithArea('residential')).termNote).not.toMatch(
      /^Term is established/,
    );
  });

  it('says so plainly when no area has been established', () => {
    const noArea = buildReferralPackage({
      parcel: parcel('residential'),
      findings: [assessEvidenceTier(0)],
      evidenceSummary: 'x',
      fromRecordedEasements: true,
      provenance: { kind: 'recorded-document', instrumentNo: 'DB 1234 PG 567' },
      encumberedArea: null,
      landValue: null,
    });
    expect(buildAppraiserRentRequest(noArea).areaNote).toMatch(/does not assume a width/);
  });
});
