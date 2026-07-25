import { resolveAttorneyReviewDecision, type AttorneyReviewChoice, type AttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import type { PaymentProvider, CheckoutSessionResult } from './payment-provider';
import { buildCheckoutLineItems, TRACK_ONE_PRICING, type CheckoutLineItem } from './pricing';

export class DisclaimerNotAcceptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisclaimerNotAcceptedError';
  }
}

export interface BuildCheckoutSessionInput {
  requiredFlow: 'licensed-pathway' | 'mandatory-review';
  attorneyReviewChoice?: AttorneyReviewChoice;
  /** Must be true — the checkout checkbox (see compliance/disclaimer-copy.ts) is not optional. */
  disclaimerAccepted: boolean;
  successUrl: string;
  cancelUrl: string;
}

export interface BuildCheckoutSessionResult {
  session: CheckoutSessionResult;
  attorneyReviewDecision: AttorneyReviewDecision;
  lineItems: CheckoutLineItem[];
}

/**
 * Track 1 checkout orchestrator. Checkout only exists in the Track 1 flow —
 * per docs/development-strategy-v2.md, Track 2 and Track 3 have no checkout
 * entry point anywhere in the product, by design. This module is never
 * imported from those tracks.
 */
export async function buildCheckoutSession(
  input: BuildCheckoutSessionInput,
  paymentProvider: PaymentProvider,
): Promise<BuildCheckoutSessionResult> {
  if (!input.disclaimerAccepted) {
    throw new DisclaimerNotAcceptedError(
      'The disclaimer checkbox must be accepted before checkout can proceed.',
    );
  }

  const attorneyReviewDecision = resolveAttorneyReviewDecision(input.requiredFlow, input.attorneyReviewChoice);
  const lineItems = buildCheckoutLineItems(attorneyReviewDecision);

  const session = await paymentProvider.createCheckoutSession({
    lineItems,
    currency: TRACK_ONE_PRICING.currency,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });

  return { session, attorneyReviewDecision, lineItems };
}
