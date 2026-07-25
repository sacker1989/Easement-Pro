import { describe, expect, it } from 'vitest';
import { buildGeneralFallback } from './general-fallback';

describe('buildGeneralFallback', () => {
  it('names the county in the reason when one was determined', () => {
    const result = buildGeneralFallback('San Francisco', 'CA');
    expect(result.reason).toContain('San Francisco');
    expect(result.reason).toContain('CA');
  });

  it('falls back to an unknown-county reason when county is null', () => {
    const result = buildGeneralFallback(null, 'TX');
    expect(result.reason).toMatch(/could not be determined/i);
  });

  it('always routes to Track 3', () => {
    expect(buildGeneralFallback('Travis', 'TX').guidance.routeTo).toBe('track-3');
  });

  it('gives at least one actionable step', () => {
    expect(buildGeneralFallback(null, 'TX').guidance.steps.length).toBeGreaterThan(0);
  });
});
