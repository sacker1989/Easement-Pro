import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

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
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
