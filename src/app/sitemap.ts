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
 * ONE ENTRY, AND THAT IS CORRECT RATHER THAN LAZY. Every other route either
 * carries a homeowner's address in its query string or is a developer harness
 * — see robots.ts. A sitemap listing them would contradict the thing robots.ts
 * exists to prevent, which is the sort of inconsistency that gets resolved in
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
  ];
}
