import { describe, expect, it } from 'vitest';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';

describe('CURRENT_DISCLAIMER', () => {
  it('flags itself as pending compliance sign-off', () => {
    expect(CURRENT_DISCLAIMER.needsComplianceSignOff).toBe(true);
  });

  it('provides non-empty copy for all three touchpoints', () => {
    expect(CURRENT_DISCLAIMER.checkoutCheckboxText.length).toBeGreaterThan(0);
    expect(CURRENT_DISCLAIMER.letterFooterText.length).toBeGreaterThan(0);
    expect(CURRENT_DISCLAIMER.sendScreenBannerText.length).toBeGreaterThan(0);
  });

  it('states the send-screen banner treats declining review as a valid, unshamed choice', () => {
    expect(CURRENT_DISCLAIMER.sendScreenBannerText).toContain('real, valid choice');
  });
});
