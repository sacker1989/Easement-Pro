import { describe, expect, it } from 'vitest';
import { COMMERCE_ENABLED } from '@/lib/compliance/commerce-mode';
import { DEFAULT_SCAN_RADIUS_FT } from '@/lib/proximity/infrastructure';
import { codeOf } from '@/lib/test-support/source-text';
import {
  currentEntitlements,
  currentSearchTier,
  resolveEntitlements,
  type SearchTier,
} from './search-entitlements';

const CODE = codeOf(new URL('./search-entitlements.ts', import.meta.url));

describe('nothing is gated while nothing can be bought', () => {
  it('resolves to the free tier, because no payment is possible', () => {
    /*
     * COMMERCE_ENABLED is false in code. There is no session, no account and
     * no payment record, so returning anything but 'free' would be claiming a
     * transaction that cannot have happened.
     */
    expect(COMMERCE_ENABLED).toBe(false);
    expect(currentSearchTier()).toBe('free');
    expect(currentEntitlements().apnSearch).toBe(false);
  });

  it('takes no argument and offers no override', () => {
    /*
     * The reasoning assertCommerceEnabled already gives in commerce-mode.ts:
     * a guard with a bypass parameter is a guard that gets bypassed. A
     * `currentSearchTier(override)` would be the first thing reached for in a
     * hurry, and it would grant paid capability to anyone who found the query
     * parameter behind it.
     */
    expect(currentSearchTier.length).toBe(0);
    expect(CODE).not.toMatch(/currentSearchTier\([^)]+\)/);
  });

  it('does not pretend to read a session that does not exist', () => {
    // A plausible-looking lookup against storage nobody built would be
    // inventing a mechanism rather than leaving the seam visible.
    for (const invented of ['cookies()', 'headers()', 'localStorage', 'jwt', 'stripe']) {
      expect(CODE.toLowerCase(), `invents a mechanism: ${invented}`).not.toContain(
        invented.toLowerCase(),
      );
    }
  });
});

describe('what the tiers differ on', () => {
  const free = resolveEntitlements('free');
  const paid = resolveEntitlements('paid');

  it('leaves the homeowner report whole on the free tier', () => {
    /*
     * A PRODUCT CONSTRAINT, NOT A NICETY. Address-to-report stays unlimited
     * and complete; the paid capabilities are additions for people working
     * across several properties or handing a file to a professional. Nothing
     * a homeowner has today moves behind a tier.
     */
    expect(free.scanRadiusFt).toBe(DEFAULT_SCAN_RADIUS_FT);
    expect(free.scanRadiusFt).toBeGreaterThan(0);
  });

  it('adds depth per property rather than a quota', () => {
    /*
     * The choice between two different products. A quota needs to count what
     * a visitor has already done, which needs identity, which needs storage —
     * and this product deliberately stores nothing, with a privacy page that
     * now says so precisely. Capability was the half that does not break it.
     */
    expect(paid.apnSearch).toBe(true);
    expect(paid.multiPropertyComparison).toBe(true);
    expect(paid.titleReadyExport).toBe(true);
    for (const quotaish of ['perMonth', 'remaining', 'quota', 'limit', 'usage', 'count']) {
      expect(Object.keys(free).join(' '), `quota concept leaked in: ${quotaish}`).not.toContain(
        quotaish,
      );
    }
  });

  it('widens the scan radius without hiding anything material', () => {
    /*
     * The evidence tier grades anything past the boundary strip as context
     * only, so a wider radius returns more context — it cannot reveal an
     * encumbrance on the reader's own parcel that the narrower one hid. If
     * that ever stops being true, this gate becomes a paywall on the truth
     * and has to go.
     */
    expect(paid.scanRadiusFt).toBeGreaterThan(free.scanRadiusFt);
  });

  it('covers every tier exhaustively', () => {
    // `satisfies Record<SearchTier, …>` means a new tier cannot be added
    // without deciding its entitlements. This asserts the map is reachable.
    const tiers: SearchTier[] = ['free', 'paid'];
    for (const tier of tiers) {
      expect(resolveEntitlements(tier)).toBeDefined();
    }
  });
});
