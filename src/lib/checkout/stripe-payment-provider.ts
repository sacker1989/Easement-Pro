import Stripe from 'stripe';
import type { CheckoutSessionRequest, CheckoutSessionResult, PaymentProvider } from './payment-provider';

export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      'STRIPE_SECRET_KEY is not set. Add a Stripe test-mode secret key (sk_test_...) to ' +
        '.env.local to enable checkout.',
    );
    this.name = 'StripeNotConfiguredError';
  }
}

/**
 * Real Stripe implementation of PaymentProvider, using Stripe's hosted
 * Checkout page (redirect flow) — simplest integration for an MVP, and it
 * only needs the secret key server-side; no publishable key or Stripe.js
 * required.
 */
export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe;

  constructor(secretKey: string | undefined = process.env.STRIPE_SECRET_KEY) {
    if (!secretKey) {
      throw new StripeNotConfiguredError();
    }
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: request.lineItems.map((item) => ({
        price_data: {
          currency: request.currency,
          product_data: { name: item.description },
          unit_amount: item.amountCents,
        },
        quantity: 1,
      })),
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
    });

    if (!session.url) {
      throw new Error('Stripe did not return a Checkout Session URL.');
    }

    return { id: session.id, url: session.url };
  }
}
