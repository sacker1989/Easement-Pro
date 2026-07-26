import { describe, expect, it } from 'vitest';
import { dispatchToAgent } from '@/lib/jurisdiction';
import {
  mapJurisdictionToConfidence,
  suggestNextStepByJurisdiction,
  valuationConfidenceToTieredResult,
} from './jurisdiction-valuation-bridge';

const laCounty = dispatchToAgent({ county: 'Los Angeles County', state: 'CA' });
const cookCounty = dispatchToAgent({ county: 'Cook County', state: 'IL' });
// Santa Clara offers no online index — the in-person / records-request case.
const santaClaraCounty = dispatchToAgent({ county: 'Santa Clara County', state: 'CA' });
const unmappedCounty = dispatchToAgent({ county: 'Cuyahoga County', state: 'OH' });

describe('mapJurisdictionToConfidence', () => {
  it('maps an immediate-tier GIS county to verified confidence with no caveat', () => {
    const context = mapJurisdictionToConfidence(laCounty);
    expect(context.confidence).toBe('verified');
    expect(context.caveat).toBeUndefined();
    expect(context.dataSource).toContain('Los Angeles County');
    expect(context.dataSource).toContain('GIS');
  });

  it('maps a standard-tier index county to inferred confidence with a caveat', () => {
    const context = mapJurisdictionToConfidence(cookCounty);
    expect(context.confidence).toBe('inferred');
    expect(context.caveat).toBeDefined();
    expect(context.caveat).toContain('verify with the county assessor');
    expect(context.dataSource).toContain('county-built');
  });

  it('maps a fallback-tier records-request county to flagged confidence', () => {
    const context = mapJurisdictionToConfidence(santaClaraCounty);
    expect(context.confidence).toBe('flagged');
    expect(context.caveat).toContain('illustrative only');
    expect(context.dataSource).toContain('FOIA');
  });

  it('maps an unmapped county to flagged confidence', () => {
    const context = mapJurisdictionToConfidence(unmappedCounty);
    expect(context.confidence).toBe('flagged');
    expect(context.dataSource).toContain('no mapped record platform');
  });

  it('names the specific county in the fallback caveat', () => {
    const context = mapJurisdictionToConfidence(unmappedCounty);
    expect(context.caveat).toContain('Cuyahoga County');
    expect(context.caveat).toContain('OH');
  });
});

describe('valuationConfidenceToTieredResult', () => {
  it('emits a clear tier carrying the value for verified jurisdictions', () => {
    const context = mapJurisdictionToConfidence(laCounty);
    const result = valuationConfidenceToTieredResult(37500, context);

    expect(result.tier).toBe('clear');
    if (result.tier === 'clear') {
      expect(result.value).toBe(37500);
    }
  });

  it('emits likely-with-caveat carrying both value and caveat for inferred jurisdictions', () => {
    const context = mapJurisdictionToConfidence(cookCounty);
    const result = valuationConfidenceToTieredResult(37500, context);

    expect(result.tier).toBe('likely-with-caveat');
    if (result.tier === 'likely-with-caveat') {
      expect(result.value).toBe(37500);
      expect(result.caveat).toContain('county assessor');
    }
  });

  it('withholds the figure entirely when the jurisdiction is flagged', () => {
    const context = mapJurisdictionToConfidence(unmappedCounty);
    const result = valuationConfidenceToTieredResult(37500, context);

    // A dollar figure with no retrieved source behind it must not be surfaced
    // as an anchorable number — TieredResult's flagged variant has no `value`.
    expect(result.tier).toBe('flagged-ambiguous');
    expect(result).not.toHaveProperty('value');
    if (result.tier === 'flagged-ambiguous') {
      expect(result.flagReason).toContain('Cuyahoga County');
    }
  });

  it('stamps a stable default ruleId', () => {
    const context = mapJurisdictionToConfidence(laCounty);
    const result = valuationConfidenceToTieredResult(1, context);
    expect(result.ruleId).toBe('jurisdiction-valuation-confidence');
  });

  it('accepts a caller-supplied ruleId', () => {
    const context = mapJurisdictionToConfidence(laCounty);
    const result = valuationConfidenceToTieredResult(1, context, 'custom-rule');
    expect(result.ruleId).toBe('custom-rule');
  });
});

describe('suggestNextStepByJurisdiction', () => {
  it('recommends asserting figures directly for verified counties', () => {
    const suggestion = suggestNextStepByJurisdiction(laCounty);
    expect(suggestion).toContain('Track 1');
    expect(suggestion).toContain('verified');
  });

  it('offers Track 1 with a caveat for inferred counties', () => {
    const suggestion = suggestNextStepByJurisdiction(cookCounty);
    expect(suggestion).toContain('Track 1');
    expect(suggestion).toContain('Track 2');
    expect(suggestion).toContain('caveat');
  });

  it('steers to Track 2 for counties with no automated data', () => {
    const suggestion = suggestNextStepByJurisdiction(unmappedCounty);
    expect(suggestion).toContain('Track 2');
    expect(suggestion).toContain('Cuyahoga County');
    expect(suggestion).not.toContain('Track 1');
  });
});
