import type { AttorneyReviewDecision } from '@/lib/compliance/attorney-review';

/**
 * Placeholder Track 1 pricing. No business pricing decision has been made
 * yet — these are illustrative round numbers, not a pricing decision, and
 * must be replaced before this reaches real users. Track 1 is the only
 * feature with a payment path in MVP; Track 2 and Track 3 never reach this
 * module.
 */
export const TRACK_ONE_PRICING = {
  maintenanceRequestLetterCents: 4900,
  attorneyReviewAddOnCents: 9900,
  currency: 'usd' as const,
  needsBusinessPricingDecision: true as const,
};

export interface CheckoutLineItem {
  description: string;
  amountCents: number;
}

export function buildCheckoutLineItems(decision: AttorneyReviewDecision): CheckoutLineItem[] {
  const items: CheckoutLineItem[] = [
    { description: 'Maintenance Request Letter (Track 1)', amountCents: TRACK_ONE_PRICING.maintenanceRequestLetterCents },
  ];
  if (decision.choice === 'added') {
    items.push({ description: 'Attorney Review Add-on', amountCents: TRACK_ONE_PRICING.attorneyReviewAddOnCents });
  }
  return items;
}

export function totalLineItemsCents(items: CheckoutLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}
