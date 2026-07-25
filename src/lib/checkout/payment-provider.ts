import type { CheckoutLineItem } from './pricing';

export interface CheckoutSessionRequest {
  lineItems: CheckoutLineItem[];
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

/**
 * Payment provider boundary. Track 1's checkout depends on this interface,
 * not on Stripe directly, so the orchestrator (build-checkout-session.ts) is
 * testable without live credentials — see stripe-payment-provider.ts for the
 * real implementation.
 */
export interface PaymentProvider {
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
}
