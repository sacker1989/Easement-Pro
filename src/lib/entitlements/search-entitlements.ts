import { COMMERCE_ENABLED } from '@/lib/compliance/commerce-mode';
import { DEFAULT_SCAN_RADIUS_FT } from '@/lib/proximity/infrastructure';

/**
 * What each tier of the product is allowed to do.
 *
 * SCAFFOLDING FOR A FUTURE BUILD-OUT, and nothing more today. Commerce is
 * disabled in code, the paid track is blocked on counsel review, and
 * `currentSearchTier()` below returns 'free' unconditionally while that holds.
 * Nothing here is sellable, nothing is user-visible, and no checkout code is
 * touched. What it buys is a single place where the question "may this
 * reader do this?" is answered, so the answer is not scattered across call
 * sites the day it stops always being no.
 *
 * CAPABILITY, NOT QUOTA, which was a deliberate choice between two different
 * products. A quota — "five reports a month" — needs to count what a visitor
 * has already done, which needs identity or a durable per-visitor key, which
 * needs storage. This product deliberately stores nothing: no accounts, no
 * cookies, no datastore, and a privacy page that says so and is now precise
 * about it. A quota would have been the first thing to break that, and for a
 * free homeowner tool it is also the less useful half. Depth per property is
 * what a buyer comparing houses actually wants.
 *
 * THE FREE TIER IS NOT CRIPPLED, and that is a product constraint rather than
 * a nicety. Address-to-report stays unlimited and complete: restrictions,
 * maintenance duties, hazard data, the county's own figures where they exist.
 * The paid capabilities below are additions for people working across several
 * properties or handing a file to a professional — not the removal of
 * something a homeowner has today.
 */

export type SearchTier = 'free' | 'paid';

export interface SearchEntitlements {
  /**
   * Look a property up by assessor parcel number rather than by address.
   *
   * Free by address, because that is what a homeowner knows. An APN is what a
   * title officer, an agent or a buyer working from a listing sheet has, and
   * it is the one identifier that resolves a parcel unambiguously where an
   * address is shared between units.
   */
  readonly apnSearch: boolean;
  /**
   * Hold several properties side by side.
   *
   * The buyer case specifically: somebody choosing between three houses wants
   * the easement picture for all three at once, which is a different job from
   * understanding the one house they already own.
   */
  readonly multiPropertyComparison: boolean;
  /**
   * How far the infrastructure scan looks, in feet.
   *
   * A BUDGET RATHER THAN A PAYWALL ON THE TRUTH, and the distinction matters.
   * The evidence tier grades anything past the boundary strip as context only,
   * so a wider radius does not reveal an encumbrance a narrower one hides — it
   * returns more context, and costs more time on the slowest service the
   * report touches. Nothing material to a homeowner's own parcel sits behind
   * this number.
   */
  readonly scanRadiusFt: number;
  /**
   * The referral package as a file to hand to an appraiser or attorney.
   *
   * The package is already built for every address, free, and shown on the
   * page. This is the export, not the analysis.
   */
  readonly titleReadyExport: boolean;
}

const FREE: SearchEntitlements = {
  apnSearch: false,
  multiPropertyComparison: false,
  scanRadiusFt: DEFAULT_SCAN_RADIUS_FT,
  titleReadyExport: false,
};

const PAID: SearchEntitlements = {
  apnSearch: true,
  multiPropertyComparison: true,
  scanRadiusFt: 1_000,
  titleReadyExport: true,
};

const BY_TIER = { free: FREE, paid: PAID } satisfies Record<SearchTier, SearchEntitlements>;

export function resolveEntitlements(tier: SearchTier): SearchEntitlements {
  return BY_TIER[tier];
}

/**
 * The tier this request is actually operating at.
 *
 * TAKES NO ARGUMENT AND HAS NO OVERRIDE, for the reason assertCommerceEnabled
 * gives in commerce-mode.ts: a guard with a bypass parameter is a guard that
 * gets bypassed. While COMMERCE_ENABLED is false there is no mechanism by
 * which anyone could have paid, so returning anything but 'free' would be
 * claiming a transaction that cannot have happened.
 *
 * When the paid track is unblocked this is the one function that changes, and
 * whatever it grows — a session, a token, a signed entitlement — every call
 * site is already asking it rather than deciding for itself.
 */
export function currentSearchTier(): SearchTier {
  if (!COMMERCE_ENABLED) return 'free';
  /*
   * Unreachable today. Deliberately NOT a speculative implementation: there
   * is no session, no account and no payment record to read, and writing a
   * plausible-looking one would be inventing a mechanism rather than leaving
   * the seam visible.
   */
  return 'free';
}

/** The entitlements in force for this request. */
export function currentEntitlements(): SearchEntitlements {
  return resolveEntitlements(currentSearchTier());
}
