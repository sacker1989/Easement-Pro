import { describe, it, expect } from 'vitest';
import {
  assessEvidenceTier,
  BOUNDARY_STRIP_FT,
  compareFindings,
  EvidenceTierError,
  summariseTiers,
  type TierAssessment,
} from './evidence-tier';
import { provenanceConfidence } from './easement-types';

describe('tier assignment', () => {
  it('treats an intersecting feature as tier A', () => {
    const t = assessEvidenceTier(0);
    expect(t.tier).toBe('A');
    expect(t.mayValue).toBe(true);
  });

  it('treats a feature inside the boundary strip as tier B', () => {
    expect(assessEvidenceTier(1).tier).toBe('B');
    expect(assessEvidenceTier(BOUNDARY_STRIP_FT).tier).toBe('B');
  });

  it('treats anything beyond the strip as tier C', () => {
    expect(assessEvidenceTier(BOUNDARY_STRIP_FT + 0.1).tier).toBe('C');
    expect(assessEvidenceTier(450).tier).toBe('C');
  });

  it('permits valuation ONLY for tier A', () => {
    // The whole point of the ordinal scheme: proximity alone never licenses a
    // dollar figure.
    expect(assessEvidenceTier(0).mayValue).toBe(true);
    expect(assessEvidenceTier(10).mayValue).toBe(false);
    expect(assessEvidenceTier(300).mayValue).toBe(false);
  });

  it('rejects a nonsensical distance rather than defaulting a tier', () => {
    expect(() => assessEvidenceTier(-1)).toThrow(EvidenceTierError);
    expect(() => assessEvidenceTier(Number.NaN)).toThrow(EvidenceTierError);
  });

  it('allows the boundary-strip convention to be overridden', () => {
    // It is a stated convention, not a measurement, so a jurisdiction with
    // real easement-width data must be able to replace it.
    expect(assessEvidenceTier(20, { boundaryStripFt: 25 }).tier).toBe('B');
    expect(assessEvidenceTier(20, { boundaryStripFt: 10 }).tier).toBe('C');
  });
});

describe('what each tier says', () => {
  it('states the direction is undetermined for tier A', () => {
    // Infrastructure on private land may mean the owner is burdened OR owed
    // compensation. Geometry cannot tell which.
    const t = assessEvidenceTier(0);
    expect(t.implication).toMatch(/may be owed\s+compensation/);
    expect(t.implication).toMatch(/cannot be determined from\s+geometry/);
  });

  it('tells tier B to investigate rather than conclude', () => {
    const t = assessEvidenceTier(10);
    expect(t.implication).toMatch(/investigating, not concluding/);
    expect(t.implication).toMatch(/public right of way/);
  });

  it('states plainly that tier C implies nothing', () => {
    const t = assessEvidenceTier(300);
    expect(t.implication).toMatch(/No encumbrance on this parcel is implied/);
    expect(t.implication).toMatch(/not an easement/);
  });

  it('always states the geometric basis', () => {
    for (const d of [0, 10, 300]) {
      expect(assessEvidenceTier(d).basis.length).toBeGreaterThan(30);
    }
  });
});

describe('summariseTiers — the replacement for the probability sentence', () => {
  const at = (d: number) => assessEvidenceTier(d);

  it('never states a likelihood', () => {
    const s = summariseTiers([at(0), at(8), at(300)]);
    expect(s).not.toMatch(/%|probability|likely|chance/i);
  });

  it('says an encumbrance is not established even at tier A', () => {
    expect(summariseTiers([at(0)])).toMatch(/does not establish that an easement exists/);
  });

  it('is explicit when nothing touches the parcel', () => {
    const s = summariseTiers([at(200), at(400)]);
    expect(s).toMatch(/No infrastructure touches this parcel/);
    expect(s).toMatch(/none of which implies an encumbrance/);
  });

  it('distinguishes an empty search from a clean result', () => {
    // "we found nothing" and "we could not check" are different claims.
    expect(summariseTiers([])).toMatch(/in the layers checked/);
  });

  it('counts tiers correctly', () => {
    const s = summariseTiers([at(0), at(0), at(5), at(900)]);
    expect(s).toMatch(/2 crossing the parcel/);
    expect(s).toMatch(/1 within 15 ft/);
    expect(s).toMatch(/A further 1 feature nearby/);
  });
});

describe('ordering', () => {
  it('sorts on-parcel first, then by distance', () => {
    const findings: TierAssessment[] = [
      assessEvidenceTier(400),
      assessEvidenceTier(0),
      assessEvidenceTier(12),
      assessEvidenceTier(100),
    ];
    const order = [...findings].sort(compareFindings).map((f) => f.tier + Math.round(f.distanceFt));
    expect(order).toEqual(['A0', 'B12', 'C100', 'C400']);
  });
});

describe('interaction with the confidence vocabulary', () => {
  it('leaves even tier A as flagged provenance', () => {
    // Tier A raises "worth valuing under stated assumptions". It does NOT
    // upgrade provenance — the finding is still a geometric inference, not a
    // recorded document.
    expect(assessEvidenceTier(0).mayValue).toBe(true);
    expect(
      provenanceConfidence({ kind: 'proximity-inference', distanceFt: 0, layer: 'OSM power' }),
    ).toBe('flagged');
  });
});
