import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertCommerceEnabled,
  COMMERCE_DISABLED_MESSAGE,
  COMMERCE_ENABLED,
  COMMERCE_REENABLE_CONDITIONS,
  CommerceDisabledError,
  mayOfferPaidTier,
} from './commerce-mode';
import { buildCheckoutSession } from '@/lib/checkout/build-checkout-session';

/**
 * Source text with comment markers and whitespace stripped.
 *
 * These assert PROSE inside wrapped comments, so matching raw source fails on a
 * reflow that changed nothing. Collapsing whitespace alone is not enough: a
 * sentence spanning two comment lines comes back as "not a // safe middle
 * position", with the marker sitting mid-sentence. Both have to go for the
 * assertion to be about the words rather than about the formatting.
 */
function sourceOf(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/^\s*(\/\/|\*\/|\/\*\*?|\*)/gm, ' ')
    .replace(/\s+/g, ' ');
}

describe('the product takes no money', () => {
  it('is disabled', () => {
    expect(COMMERCE_ENABLED).toBe(false);
  });

  it('refuses a checkout session at the library level', async () => {
    // The page guard is the one users meet. This is the one that holds when a
    // route is added, a fixture calls in directly, or a new surface is wired
    // and someone forgets — and the failure mode it prevents is charging a
    // card during the period when not charging is the entire point.
    await expect(
      buildCheckoutSession(
        {
          requiredFlow: 'licensed-pathway',
          attorneyReviewChoice: 'declined',
          disclaimerAccepted: true,
          successUrl: 'https://example.com/s',
          cancelUrl: 'https://example.com/c',
        },
        { createCheckoutSession: async () => ({ id: 'x', url: 'https://example.com' }) },
      ),
    ).rejects.toThrow(CommerceDisabledError);
  });

  it('refuses BEFORE the disclaimer check, so no other precondition can mask it', async () => {
    // disclaimerAccepted: false would otherwise throw DisclaimerNotAcceptedError
    // first, which would make the commerce refusal invisible in that path.
    await expect(
      buildCheckoutSession(
        {
          requiredFlow: 'licensed-pathway',
          attorneyReviewChoice: 'declined',
          disclaimerAccepted: false,
          successUrl: 'https://example.com/s',
          cancelUrl: 'https://example.com/c',
        },
        { createCheckoutSession: async () => ({ id: 'x', url: 'https://example.com' }) },
      ),
    ).rejects.toThrow(CommerceDisabledError);
  });

  it('has no override parameter', () => {
    expect(assertCommerceEnabled.length).toBe(1);
    expect(String(assertCommerceEnabled)).not.toMatch(/force|override|allow|bypass/i);
  });

  it('the checkout page refuses before validating anything', () => {
    // Asking for an address first would imply a transaction is coming.
    const src = readFileSync(new URL('../../app/checkout/page.tsx', import.meta.url), 'utf8');
    const gateAt = src.indexOf('if (!COMMERCE_ENABLED)');
    const validateAt = src.indexOf('normalizeAddress({');
    expect(gateAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(validateAt);
  });
});

describe('free means free, including no pitch for the paid thing', () => {
  it('will not offer a paid tier either', () => {
    // "offers to provide ... for compensation" is in the §6400(c) definition.
    // Advertising a coming paid tier while free is not a safe middle position;
    // it is the offer the definition names.
    expect(mayOfferPaidTier()).toBe(false);
  });

  it('ties the offer surface to the same flag rather than a second one', () => {
    const src = sourceOf('./commerce-mode.ts');
    expect(src).toMatch(/return COMMERCE_ENABLED;/);
    expect(src).toMatch(/not a\s+safe middle position/);
  });

  it('tells the user it is free and collects nothing', () => {
    expect(COMMERCE_DISABLED_MESSAGE).toMatch(/free while it is under legal review/);
    expect(COMMERCE_DISABLED_MESSAGE).toMatch(/No\s+payment details are collected/);
    expect(COMMERCE_DISABLED_MESSAGE).toMatch(/available to you at no cost/);
  });
});

describe('the reasoning is recorded where it is acted on', () => {
  it('states what free mode closes — the LDA compensation element', () => {
    const src = sourceOf('./commerce-mode.ts');
    expect(src).toMatch(/§6400\(c\)/);
    expect(src).toMatch(/Compensation is an element of the definition/);
  });

  it('states what free mode does NOT close — UPL under §6125', () => {
    // The caveat that stops this being misread as a clean bill of health.
    // §6125 has no compensation element, so going free narrows the question
    // rather than answering it.
    const src = sourceOf('./commerce-mode.ts');
    expect(src).toMatch(/§6125/);
    expect(src).toMatch(/No person shall practice law in California/);
    expect(src).toMatch(/Nothing there turns on\s+payment/);
    expect(src).toMatch(/misdemeanour/);
  });

  it('lists what must be true before commerce resumes', () => {
    expect(COMMERCE_REENABLE_CONDITIONS.length).toBeGreaterThanOrEqual(3);
    const joined = COMMERCE_REENABLE_CONDITIONS.join(' ');
    expect(joined).toMatch(/practice of law under §6125/);
    expect(joined).toMatch(/disclaimer/);
    expect(joined).toMatch(/durable audit store/);
  });

  it('is a code change rather than an environment variable', () => {
    // An env var can be set wrong in one environment by someone who never read
    // any of this, and that failure would be silent and billable.
    const src = sourceOf('./commerce-mode.ts');
    expect(src).not.toMatch(/process\.env/);
    expect(src).toMatch(/can be set\s+wrong in one environment/);
  });
});
