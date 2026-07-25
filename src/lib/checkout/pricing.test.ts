import { describe, expect, it } from 'vitest';
import { resolveAttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import { buildCheckoutLineItems, totalLineItemsCents, TRACK_ONE_PRICING } from './pricing';

describe('buildCheckoutLineItems', () => {
  it('includes only the base letter fee when review is declined', () => {
    const items = buildCheckoutLineItems(resolveAttorneyReviewDecision('licensed-pathway', 'declined'));
    expect(items).toHaveLength(1);
    expect(items[0]?.amountCents).toBe(TRACK_ONE_PRICING.maintenanceRequestLetterCents);
  });

  it('adds the attorney review add-on when opted in', () => {
    const items = buildCheckoutLineItems(resolveAttorneyReviewDecision('licensed-pathway', 'added'));
    expect(items).toHaveLength(2);
    expect(items[1]?.amountCents).toBe(TRACK_ONE_PRICING.attorneyReviewAddOnCents);
  });

  it('always includes the add-on for mandatory-review', () => {
    const items = buildCheckoutLineItems(resolveAttorneyReviewDecision('mandatory-review'));
    expect(items).toHaveLength(2);
  });
});

describe('totalLineItemsCents', () => {
  it('sums all line item amounts', () => {
    const items = buildCheckoutLineItems(resolveAttorneyReviewDecision('mandatory-review'));
    expect(totalLineItemsCents(items)).toBe(
      TRACK_ONE_PRICING.maintenanceRequestLetterCents + TRACK_ONE_PRICING.attorneyReviewAddOnCents,
    );
  });
});
