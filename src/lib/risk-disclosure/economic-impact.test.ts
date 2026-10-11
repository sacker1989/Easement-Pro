import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildEconomicImpactEstimate,
  classifyDataCoverage,
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
    // Regression: this previously returned tier 'clear' labelled "Verified
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

  it('grades a modelled price as likely-with-caveat, never clear', () => {
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
  const SOURCE = readFileSync(new URL('./economic-impact.ts', import.meta.url), 'utf8').replace(
    /\r\n/g,
    '\n',
  );

  /** Comments here discuss the deleted figure by name; the guard is on code. */
  function codeOf(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  }
  const CODE = codeOf(SOURCE);

  /**
   * Every single-quoted literal, with concatenations joined first.
   *
   * These caveats are written as several quoted fragments joined by `+` across
   * source lines, so without the join a sentence gets cut wherever the author
   * happened to wrap, and a guard reading one half sees copy the reader never
   * meets as a unit.
   */
  function stringLiteralsOf(code: string): string[] {
    return code.replace(/'\s*\+\s*'/g, '').match(/'(?:[^'\\\n]|\\.)*'/g) ?? [];
  }

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
    for (const literal of stringLiteralsOf(CODE)) {
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
    const screening = readFileSync(
      new URL('../valuation/screening-estimate.ts', import.meta.url),
      'utf8',
    );
    expect(screening).toMatch(/does not assume a default/);
    expect(NO_LAND_VALUE_SENTINEL.test(SOURCE)).toBe(true);
  });
});

/** The same promise, in this module's words. */
const NO_LAND_VALUE_SENTINEL = /does not substitute a national average/;

describe('the variance band does not claim to be a measurement', () => {
  const SOURCE = readFileSync(new URL('./economic-impact.ts', import.meta.url), 'utf8');

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
    // The point is the labelling, not removing the range: a band invites less
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
