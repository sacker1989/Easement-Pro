import { describe, it, expect } from 'vitest';
import {
  CONCORDANCE_RATIO,
  hasReportablePointEstimate,
  MEASURED_AB_RATIO_BY_VINTAGE,
  MEASURED_AB_RATIO_SAN_DIEGO,
  MEASURED_CONCORDANCE_RATE,
  MEASURED_CONCORDANCE_RATE_SAN_DIEGO,
  reconcilePaths,
  SAN_DIEGO_USABLE_VINTAGE_RATE,
  type PathEstimate,
} from './reconcile-paths';

const A = (v: number): PathEstimate => ({ landValue: v, source: 'market-indexed assessment' });
const B = (v: number): PathEstimate => ({ landValue: v, source: 'ZIP comparables' });

describe('measured constants', () => {
  it('records Path A running systematically higher in every vintage bucket', () => {
    // The disagreement is a bias, not noise around parity. Every measured
    // bucket sits above 1.0.
    for (const v of Object.values(MEASURED_AB_RATIO_BY_VINTAGE)) {
      expect(v).toBeGreaterThan(1.0);
    }
  });

  it('records that agreement is far from universal', () => {
    // 57-71%. If a future change makes this look like near-total agreement,
    // the measurement has been overwritten rather than improved.
    for (const v of Object.values(MEASURED_CONCORDANCE_RATE)) {
      expect(v).toBeGreaterThanOrEqual(0.55);
      expect(v).toBeLessThanOrEqual(0.75);
    }
  });

  it('shows agreement improving for recent vintages in LA', () => {
    // Where the base year is recent, Path A is nearly a no-op and both paths
    // approximate the same fresh-market quantity.
    expect(MEASURED_CONCORDANCE_RATE['2020-23']!).toBeGreaterThan(
      MEASURED_CONCORDANCE_RATE['1990s']!,
    );
  });
});

describe('San Diego measurement — the inverted trend', () => {
  it('agrees worse than LA in every comparable bucket', () => {
    for (const b of ['2000s', '2010s', '2020-23']) {
      expect(MEASURED_CONCORDANCE_RATE_SAN_DIEGO[b]!).toBeLessThan(MEASURED_CONCORDANCE_RATE[b]!);
    }
  });

  it('DEGRADES toward recent vintages, the opposite of LA', () => {
    // This is the diagnostic finding. A recent full-transfer DOCDATE should
    // make Path A a near no-op and agreement should peak there, as it does in
    // LA. It bottoms out instead, which says DOCDATE is a weak parcel-level
    // vintage even though its aggregate gradient is real.
    expect(MEASURED_CONCORDANCE_RATE_SAN_DIEGO['2020-23']!).toBeLessThan(
      MEASURED_CONCORDANCE_RATE_SAN_DIEGO['pre-1990']!,
    );
    expect(MEASURED_CONCORDANCE_RATE['2020-23']!).toBeGreaterThan(
      MEASURED_CONCORDANCE_RATE['pre-1990']!,
    );
  });

  it('still shows Path A running high, as in LA', () => {
    for (const v of Object.values(MEASURED_AB_RATIO_SAN_DIEGO)) {
      expect(v).toBeGreaterThan(1.0);
    }
  });

  it('records that Path A is unavailable for a large minority of parcels', () => {
    // 40% of San Diego parcels fail the four DOCDATE conditions, so they reach
    // reconciliation as single-path or unavailable.
    expect(SAN_DIEGO_USABLE_VINTAGE_RATE).toBeLessThan(0.65);
    expect(SAN_DIEGO_USABLE_VINTAGE_RATE).toBeGreaterThan(0.5);
  });
});

describe('neither path available', () => {
  it('offers no number at all', () => {
    const r = reconcilePaths(null, null);
    expect(r.status).toBe('unavailable');
    expect(r.pointEstimate).toBeNull();
    expect(r.low).toBeNull();
    expect(r.confidence).toBe('flagged');
    expect(hasReportablePointEstimate(r)).toBe(false);
  });
});

describe('one path available', () => {
  it('uses it with its own calibrated range', () => {
    const r = reconcilePaths(A(500_000), null);
    expect(r.status).toBe('single-path');
    expect(r.pointEstimate).toBe(500_000);
    expect(r.low!).toBeLessThan(500_000);
    expect(r.ratio).toBeNull();
  });

  it('works from either side', () => {
    expect(reconcilePaths(null, B(400_000)).pointEstimate).toBe(400_000);
  });

  it('says plainly that nothing corroborates it', () => {
    expect(reconcilePaths(null, B(400_000)).explanation).toMatch(/no second, independent estimate/i);
  });
});

describe('both paths, concordant', () => {
  it('treats agreement within the measured band as corroboration', () => {
    const r = reconcilePaths(A(550_000), B(500_000));
    expect(r.status).toBe('concordant');
    expect(r.ratio).toBeCloseTo(1.1, 6);
    expect(r.pointEstimate).toBe(525_000);
    expect(hasReportablePointEstimate(r)).toBe(true);
  });

  it('spans both estimates as well as the calibrated range', () => {
    const r = reconcilePaths(A(550_000), B(500_000));
    expect(r.low!).toBeLessThanOrEqual(500_000);
    expect(r.high!).toBeGreaterThanOrEqual(550_000);
  });

  it('explains why agreement is meaningful rather than circular', () => {
    // Different failure modes: one parcel-specific, one ZIP-generic.
    expect(reconcilePaths(A(550_000), B(500_000)).explanation).toMatch(/fail in\s+different ways/);
  });

  it('never claims to be an appraisal', () => {
    expect(reconcilePaths(A(550_000), B(500_000)).explanation).toMatch(/not an appraisal/);
  });
});

describe('both paths, discordant', () => {
  it('refuses to produce a point estimate', () => {
    // The whole point of the module. Averaging two figures 2x apart yields a
    // number neither method supports.
    const r = reconcilePaths(A(1_000_000), B(400_000));
    expect(r.status).toBe('discordant');
    expect(r.pointEstimate).toBeNull();
    expect(hasReportablePointEstimate(r)).toBe(false);
  });

  it('bounds the range by the two estimates themselves', () => {
    const r = reconcilePaths(A(1_000_000), B(400_000));
    expect(r.low).toBe(400_000);
    expect(r.high).toBe(1_000_000);
  });

  it('flags rather than merely caveats', () => {
    expect(reconcilePaths(A(1_000_000), B(400_000)).confidence).toBe('flagged');
  });

  it('detects disagreement in either direction', () => {
    expect(reconcilePaths(A(400_000), B(1_000_000)).status).toBe('discordant');
    // And reports the magnitude the same way regardless of direction.
    expect(reconcilePaths(A(400_000), B(1_000_000)).explanation).toMatch(/disagree by 2\.50x/);
  });

  it('states that neither method is known to be correct', () => {
    const e = reconcilePaths(A(1_000_000), B(400_000)).explanation;
    expect(e).toMatch(/19\.3% median error/);
    expect(e).toMatch(/has never been measured/);
  });

  it('is exclusive at the concordance boundary', () => {
    const base = 400_000;
    expect(reconcilePaths(A(base * CONCORDANCE_RATIO), B(base)).status).toBe('concordant');
    expect(reconcilePaths(A(base * (CONCORDANCE_RATIO + 0.01)), B(base)).status).toBe('discordant');
  });
});
