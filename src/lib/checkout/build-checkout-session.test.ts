import { describe, expect, it, vi } from 'vitest';
import type { PaymentProvider } from './payment-provider';
import { buildCheckoutSession, DisclaimerNotAcceptedError } from './build-checkout-session';

function mockProvider(): PaymentProvider {
  return {
    createCheckoutSession: vi.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/cs_test_123' }),
  };
}

const baseInput = {
  requiredFlow: 'licensed-pathway' as const,
  attorneyReviewChoice: 'declined' as const,
  disclaimerAccepted: true,
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
};

describe('buildCheckoutSession', () => {
  it('rejects checkout when the disclaimer has not been accepted', async () => {
    await expect(
      buildCheckoutSession({ ...baseInput, disclaimerAccepted: false }, mockProvider()),
    ).rejects.toThrow(DisclaimerNotAcceptedError);
  });

  it('passes the resolved line items and currency to the payment provider', async () => {
    const provider = mockProvider();
    await buildCheckoutSession(baseInput, provider);
    expect(provider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'usd',
        successUrl: baseInput.successUrl,
        cancelUrl: baseInput.cancelUrl,
        lineItems: expect.arrayContaining([expect.objectContaining({ description: expect.any(String) })]),
      }),
    );
  });

  it('returns the attorney review decision alongside the session', async () => {
    const result = await buildCheckoutSession(baseInput, mockProvider());
    expect(result.attorneyReviewDecision).toEqual({
      requiredFlow: 'licensed-pathway',
      choice: 'declined',
      status: 'not-required',
    });
    expect(result.session.id).toBe('cs_test_123');
  });

  it('forces mandatory-review and includes the add-on line item', async () => {
    const result = await buildCheckoutSession(
      { ...baseInput, requiredFlow: 'mandatory-review', attorneyReviewChoice: 'declined' },
      mockProvider(),
    );
    expect(result.attorneyReviewDecision.choice).toBe('added');
    expect(result.lineItems).toHaveLength(2);
  });
});
