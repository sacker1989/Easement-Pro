import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * EVALUATED PER REQUEST.
 *
 * Without this Next prerenders both files and bakes in whatever SITE_URL was
 * set when the BUILD ran — which silently defeats the point of dropping the
 * NEXT_PUBLIC_ prefix, since the whole reason for that was to let the value
 * change without a redeploy. Verified: before this line, starting the server
 * with SITE_URL set still served the build-time value.
 *
 * The cost is a function invocation for a response of a few hundred bytes,
 * which is not a cost.
 */
export const dynamic = 'force-dynamic';

/**
 * The sitemap.
 *
 * THE TWO PAGES THAT CARRY NO USER INPUT, and no others. Every remaining
 * route either has a homeowner's address in its query string or is a developer
 * harness — see robots.ts. Listing one here would contradict the thing
 * robots.ts exists to prevent, and that kind of inconsistency gets resolved in
 * the crawler's favour.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl(),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${siteUrl()}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
