
import { readSource, stringLiterals, stripComments } from '@/lib/test-support/source-text';
import { describe, expect, it } from 'vitest';
import {
  buildEconomicImpactEstimate,
  classifyDataCoverage,
  fractionalAssessmentCaveat,
  type DollarRange,
  type EconomicImpactEstimate,
} from './economic-impact';
import type { AssessorParcelValuation } from './la-county-assessor-provider';

/** Mirrors a real record: AIN 2004001003, verified live 2026-07-25. */
const ASSESSOR_RECORD: AssessorParcelValuation = {
  ain: '2004001003',
  apn: '2004-001-003',
  situsFullAddress: '8321 FAUST AVE LOS ANGELES CA 91304',
  lotAreaSqFt: 9685.58,
  landValue: 740440,
  improvementValue: 313342,
  rollYear: '2026',
  landBaseYear: '2006',
  landValuePerSqFt: 740440 / 9685.58,
};

describe('classifyDataCoverage', () => {
  it('labels an estimate backed by assessor data as clear/verified', () => {
    const result = classifyDataCoverage({ isLaCounty: true, assessorValuation: ASSESSOR_RECORD });
    expect(result.tier).toBe('clear');
    if (result.tier === 'clear') {
      expect(result.value.label).toContain('2026 assessment roll');
      expect(result.value.label).toContain('2004001003');
    }
  });

  it('does not claim verification for an LA County address with no assessor record', () => {
    // Regression: this previously returned tier 'clear' labeled "Verified
    // against LA County reference data" while every figure came from the
    // national placeholder — asserting verification that never happened.
    const result = classifyDataCoverage({ isLaCounty: true });
    expect(result.tier).toBe('likely-with-caveat');
    if (result.tier === 'likely-with-caveat') {
      expect(result.value.label).not.toContain('Verified');
      expect(result.caveat).toContain('not verified against county data');
    }
  });

  it('labels non-LA-County addresses as likely-with-caveat/national estimate', () => {
    const result = classifyDataCoverage({ isLaCounty: false });
    expect(result.tier).toBe('likely-with-caveat');
    if (result.tier === 'likely-with-caveat') {
      expect(result.value.label).toBe('Based on national estimates, not locally verified');
      expect(result.caveat).toBeTruthy();
    }
  });
});

/**
 * Unwraps a value-at-risk that the test expects to exist.
 *
 * Throws rather than returning a default, so a path that silently stops
 * producing a figure fails loudly here instead of comparing undefined.
 */
function rangeOf(result: EconomicImpactEstimate): DollarRange {
  if (result.valueAtRisk.status !== 'range') {
    throw new Error('expected a value-at-risk range, got: ' + result.valueAtRisk.status);
  }
  return result.valueAtRisk.range;
}
describe('buildEconomicImpactEstimate', () => {
  it('sets lost buildable area equal to the easement footprint', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: true,
    });
    expect(result.lostBuildableAreaSqFt).toBe(1000);
  });

  it('refuses a value at risk when there is no land value, rather than inventing one', () => {
    /*
     * THIS TEST ASSERTED THE DEFECT. It read "uses the national median price
     * per sq ft by default" and locked in a constant whose own comment called
     * it "an unsourced placeholder". Most visitors are outside the four
     * covered counties, so the default was the common path, and the report
     * attributed it to "national FHFA/NAHB-style benchmarks" — a citation for
     * a number with no source. Ten lines away on the same page,
     * screening-estimate.ts was already refusing this exact case.
     */
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: false,
    });
    expect(result.valueAtRisk.status).toBe('unavailable');
    if (result.valueAtRisk.status !== 'unavailable') throw new Error('expected unavailable');
    expect(result.valueAtRisk.reason).toMatch(/does not substitute a national average/);
    expect(result.methodology).toMatch(/No value at risk is given/);
    expect(result.methodology).not.toMatch(/multiplies that area by/);
  });

  it('still gives the figures that do not need a land value', () => {
    // Lost area is arithmetic on the inputs, and rework is a real regional
    // median from the Census Survey of Construction. Neither needed land,
    // so neither is withheld.
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: false,
      state: 'TX',
    });
    expect(result.lostBuildableAreaSqFt).toBe(1000);
    expect(result.reworkCostRange.low).toBeGreaterThan(0);
    expect(result.constructionCost.costPerSqFt).toBeGreaterThan(0);
  });

  it('uses a supplied local price override instead of the national default', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: true,
      pricePerSqFtOverride: 500,
    });
    expect(rangeOf(result).low).toBe(Math.round(1000 * 500 * 0.8));
    expect(result.methodology).toContain('supplied local price');
  });

  it('indexes the assessed value forward to market by default', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
    });
    // 2006 base year, so the raw figure reflects a 20-year-old market.
    expect(result.marketAdjustment).toBeDefined();
    expect(result.marketAdjustment!.indexed.baseYear).toBe(2006);
    expect(result.marketAdjustment!.indexed.indexRatio).toBeGreaterThan(1);
    expect(rangeOf(result).low).toBeGreaterThan(
      Math.round(500 * ASSESSOR_RECORD.landValuePerSqFt * 0.8),
    );
    expect(result.methodology).toContain('market-indexed');
  });

  it('grades a modeled price as likely-with-caveat, never clear', () => {
    // 'clear' gates direct assertion in a paid letter; an indexed figure is a
    // model output and must not be asserted that way.
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
    });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    if (result.dataCoverage.tier === 'likely-with-caveat') {
      expect(result.dataCoverage.caveat).toContain('Proposition 13');
    }
  });

  it('prices from the raw assessor roll when indexing is disabled', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
      applyMarketIndex: false,
    });
    // ~$76.45/sq ft from the roll, not the $220 national placeholder.
    const expectedCenter = 500 * ASSESSOR_RECORD.landValuePerSqFt;
    expect(rangeOf(result).low).toBe(Math.round(expectedCenter * 0.8));
    expect(result.dataCoverage.tier).toBe('clear');
    expect(result.methodology).toContain('assessed land value');
  });

  it('falls back to the raw assessed value when no base year is recorded', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: { ...ASSESSOR_RECORD, landBaseYear: null },
    });
    expect(result.marketAdjustment).toBeUndefined();
    expect(rangeOf(result).low).toBe(
      Math.round(500 * ASSESSOR_RECORD.landValuePerSqFt * 0.8),
    );
  });

  it('lets an explicit override win over assessor data', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
      pricePerSqFtOverride: 900,
    });
    expect(rangeOf(result).low).toBe(Math.round(500 * 900 * 0.8));
    expect(result.methodology).toContain('supplied local price');
  });

  it('refuses the figure for an LA County lot whose assessor record was not retrieved', () => {
    /*
     * An LA address that the assessor lookup missed is the case most likely to
     * mislead: the reader is inside a covered county and the report otherwise
     * looks fully backed. It used to fall through to the national median like
     * anywhere else. The coverage tier stays likely-with-caveat, because the
     * rework figure is still a real regional median — but no land value means
     * no value at risk.
     */
    const result = buildEconomicImpactEstimate({ lotAreaSqFt: 5000, easementAreaSqFt: 500, isLaCounty: true });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    expect(result.valueAtRisk.status).toBe('unavailable');
    expect(result.methodology).not.toContain('national median estimate');
    expect(result.methodology).not.toContain('Verified');
  });

  it('carries the national-estimate coverage label through to the estimate', () => {
    const result = buildEconomicImpactEstimate({ lotAreaSqFt: 5000, easementAreaSqFt: 500, isLaCounty: false });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    expect(result.methodology).toContain('Based on national estimates');
  });
});

describe('no unsourced land value, and no citation for one', () => {
  const SOURCE = readSource(new URL('./economic-impact.ts', import.meta.url)).replace(
    /\r\n/g,
    '\n',
  );

  // Comments here discuss the deleted figure by name; the guard is on code.
  const CODE = stripComments(SOURCE);

  /**
   * Moved to test-support/source-text.ts as `stringLiterals`, with the
   * reasoning. It was written here first, which is how it ended up as the
   * fourth private copy of a shared idea.
   */

  it('has no national land-value constant left to pick up again', () => {
    /*
     * DELETED, NOT MERELY UNUSED. `medianPricePerSqFt: 220` was described in
     * its own comment as an unsourced placeholder and was multiplied by the
     * easement area for every visitor outside the four covered counties. An
     * unused constant is an invitation; the point is that there is no longer a
     * number here for a later edit to reach for.
     */
    expect(CODE).not.toContain('medianPricePerSqFt');
    expect(CODE).not.toMatch(/\b220\b/);
  });

  it('cites no agency for a figure it does not have', () => {
    /*
     * The coverage caveat read "national FHFA/NAHB-style benchmarks". Neither
     * agency publishes a national median land value per square foot, and
     * "-style" does not make two federal and industry acronyms behind an
     * invented number into an attribution. This repo cites FHFA properly
     * elsewhere — la-county-hpi-data.ts is careful to distinguish its derived
     * series from FHFA's official county index — which is exactly why a loose
     * one here would have been believed.
     */
    /*
     * ON CODE, NOT PROSE. The comments in that module quote the removed string
     * to explain why it went, and a guard that fires on its own explanation is
     * noise. What can mislead a reader is a string literal that reaches the
     * page, and codeOf keeps those while dropping comments.
     */
    expect(CODE).not.toContain('FHFA');

    /*
     * NAHB IS ALLOWED, BUT ONLY WHERE IT IS TRUE. The rework figure really is
     * an NAHB analysis of the Census Survey of Construction, with a year and a
     * region — see construction-cost.ts. So the rule is not "never say NAHB",
     * which would forbid an honest citation; it is that every mention sits in
     * copy about rework or construction. The original defect was precisely a
     * true-sounding source attached to the wrong quantity.
     *
     * THE UNIT IS THE STRING LITERAL, which is what reaches the page. An
     * earlier version of this split the source into "sentences", which source
     * code does not have — the chunk ran to the end of the file and would have
     * passed on the word "constructionCost" four hundred lines later.
     */
    for (const literal of stringLiterals(CODE)) {
      if (!literal.includes('NAHB')) continue;
      expect(
        /rework|construction/i.test(literal),
        `NAHB cited outside a construction context: ${literal}`,
      ).toBe(true);
    }
  });

  it('cannot resolve a price from nothing: the type has no such source', () => {
    expect(CODE).not.toContain("'national-benchmark'");
    expect(CODE).toMatch(/function resolvePricePerSqFt\([^)]*\): ResolvedPrice \| null/);
  });

  it('agrees with the screening estimate, which already refused', () => {
    /*
     * THE TWO RENDERED ON THE SAME PAGE, one refusing and one substituting.
     * screening-estimate.ts says it "does not assume a default width or a
     * default land value"; this module quietly did. If that module's refusal
     * is ever softened, this assertion is the reminder that two sections have
     * to make the same promise.
     */
    const screening = readSource(new URL('../valuation/screening-estimate.ts', import.meta.url));
    expect(screening).toMatch(/does not assume a default/);
    expect(NO_LAND_VALUE_SENTINEL.test(SOURCE)).toBe(true);
  });
});

/** The same promise, in this module's words. */
const NO_LAND_VALUE_SENTINEL = /does not substitute a national average/;

describe('the variance band does not claim to be a measurement', () => {
  const SOURCE = readSource(new URL('./economic-impact.ts', import.meta.url));

  it('describes the band as a refusal to state a point figure', () => {
    /*
     * The methodology used to call it a range "to reflect estimate
     * uncertainty", which asserts that the uncertainty was estimated. It is a
     * round 20% nobody calibrated. Widening a figure is a fine way to refuse
     * a point estimate; describing the width as measured is the same move as
     * the $220 — a number reading as analysis.
     */
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: true,
      pricePerSqFtOverride: 300,
    });
    expect(result.methodology).toContain('not a calculated margin of error');
    expect(result.methodology).not.toContain('to reflect estimate uncertainty');
  });

  it('still produces the band, which is doing real work', () => {
    // The point is the labeling, not removing the range: a band invites less
    // reliance than a single number, which is why it is there.
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: true,
      pricePerSqFtOverride: 300,
    });
    const range = rangeOf(result);
    expect(range.low).toBe(Math.round(1000 * 300 * 0.8));
    expect(range.high).toBe(Math.round(1000 * 300 * 1.2));
  });

  it('says in the source that it is not a confidence interval', () => {
    expect(SOURCE).toMatch(/NOT a confidence interval|not a measured one/i);
  });
});

describe('the counties that are not LA still have a land value', () => {
  /*
   * THE REGRESSION THIS EXISTS FOR, found by a production sweep hours after
   * shipping the refusal.
   *
   * assessorValuation is the LA-shaped record — it carries an AIN and a
   * Proposition 13 base year. Orange, San Diego and Cook publish neither, so
   * their land value arrives on the unified county shape instead, and the
   * report page was reading it, rendering it in the parcel panel, and never
   * passing it here.
   *
   * While an invented national $220 stood in, that looked like a working
   * report. Once the $220 was deleted it became "No land value is published
   * for this address" printed directly under a panel displaying the
   * published land value — self-contradictory on one screen, which is how it
   * was finally caught.
   */
  const ORANGE = { county: 'Orange County', perSqFt: 84.65 } as const;

  it('prices the easement off the county roll rather than refusing', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 6279,
      easementAreaSqFt: 500,
      isLaCounty: false,
      countyLandValue: ORANGE,
    });
    expect(result.valueAtRisk.status).toBe('range');
    expect(rangeOf(result).low).toBe(Math.round(500 * ORANGE.perSqFt * 0.8));
    expect(result.methodology).toContain('Orange County assessed land value');
  });

  it('labels the coverage as the county roll, not a national estimate', () => {
    // The page rendered a real county figure under "Based on national
    // estimates, not locally verified", because the rules only knew about LA.
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 6279,
      easementAreaSqFt: 500,
      isLaCounty: false,
      countyLandValue: ORANGE,
    });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    const label = result.dataCoverage.tier === 'flagged-ambiguous' ? '' : result.dataCoverage.value.label;
    expect(label).toContain('Orange County assessment roll');
    expect(label).not.toContain('national');
  });

  it('is likely-with-caveat rather than clear, because the vintage is unknown', () => {
    /*
     * 'clear' gates direct assertion in a paid letter. These counties publish
     * no base year, so the roll cannot say whether a figure is current or
     * decades stale — the per-county staleness caveats exist for exactly
     * this. An unknown vintage is not a verified price.
     */
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 6279,
      easementAreaSqFt: 500,
      isLaCounty: false,
      countyLandValue: ORANGE,
    });
    expect(result.dataCoverage.tier).not.toBe('clear');
  });

  it('still refuses where no county published anything', () => {
    // The fix must not reopen the hole it was built beside.
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: false,
    });
    expect(result.valueAtRisk.status).toBe('unavailable');
  });

  it('lets LA keep precedence, since its record carries a base year', () => {
    // If both arrive, the indexed LA figure is the better one: it is the only
    // path that can correct for Proposition 13.
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
      countyLandValue: ORANGE,
    });
    expect(result.methodology).toContain('market-indexed');
    expect(result.methodology).not.toContain('Orange County');
  });
});

describe('a roll that is a fraction of market value says so', () => {
  /*
   * FOUND BY experiments/report-sweep.mjs, which renders real addresses and
   * reads the result. A Sauk Village report said:
   *
   *   "800 sq ft x $0.35/sq ft = $280 of land under the easement"
   *   "Verified against the Cook County assessment roll (land value $0.35/sq ft)"
   *
   * Both are sourced and both mislead. Illinois assesses at a statutory
   * fraction of market value, in the current year, by design — so $0.35/sq ft
   * was never a land price and "Verified ... land value" invites reading it as
   * one. The existing caveat said only that an assessed value "may not track
   * current market value", which is the California story: Proposition 13
   * assesses at market as of the base year, so a CA figure was a market value
   * once. Telling an Illinois reader theirs might be stale describes the wrong
   * problem and understates it by about an order of magnitude.
   *
   * MEASURED FROM THE COUNTY'S OWN LAYER on 2026-10-15 — median published
   * CURRENTVALUE_TOTAL for residential parcels: Sauk Village $8,508, Chicago
   * $12,700, Evanston $42,001, Winnetka $250,584. $42,001 for an Evanston
   * house is not a market price.
   *
   * The product still does not scale the figure. That needs the Illinois
   * Department of Revenue's assessment/sales ratio study, and a ratio written
   * from memory into a number that prices property is what the deleted
   * national $220/sq ft was.
   */
  const cook = { county: 'Cook County', perSqFt: 0.35 };

  it('drops the word "Verified" where the quantity is a fraction', () => {
    const r = classifyDataCoverage({ isLaCounty: false, state: 'IL', countyLandValue: cook });
    expect(r.tier).not.toBe('flagged-ambiguous');
    if (r.tier === 'flagged-ambiguous') return;
    expect(r.value.label).not.toMatch(/Verified/);
    expect(r.value.label).toMatch(/an assessed figure/);
    expect(r.value.label).toMatch(/fraction of market value/);
  });

  it('keeps "Verified" for a state whose roll is a market figure', () => {
    const r = classifyDataCoverage({
      isLaCounty: false,
      state: 'CA',
      countyLandValue: { county: 'Orange County', perSqFt: 73.02 },
    });
    if (r.tier === 'flagged-ambiguous') throw new Error('expected a label');
    expect(r.value.label).toMatch(/Verified against the Orange County assessment roll/);
    expect(r.value.label).not.toMatch(/fraction of market value/);
  });

  it('adds the fractional sentence to the caveat, and only there', () => {
    expect(fractionalAssessmentCaveat('IL')).toMatch(/statutory fraction of market value/);
    expect(fractionalAssessmentCaveat('il')).not.toBeNull();
    expect(fractionalAssessmentCaveat('CA')).toBeNull();
    expect(fractionalAssessmentCaveat(undefined)).toBeNull();
  });

  it('does not invent a conversion', () => {
    const text = fractionalAssessmentCaveat('IL') ?? '';
    // No ratio, multiplier or scaled figure may appear.
    expect(text).not.toMatch(/\b10\s*%|\bmultiply\b|\bdivide by\b|\btimes ten\b/i);
    expect(text).toMatch(/does not scale the figure up/);
    // And it says what IS usable, rather than only what is not.
    expect(text).toMatch(/floor/);
    expect(text).toMatch(/percentage band/);
  });

  it('points the reader at evidence they can see rather than asserting a ratio', () => {
    expect(fractionalAssessmentCaveat('IL')).toMatch(/parcel panel above/);
  });
});
