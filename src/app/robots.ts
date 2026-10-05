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
 * What crawlers may index.
 *
 * THE REASON THIS EXISTS IS PRIVACY, NOT SEO, and the SEO benefit is
 * incidental.
 *
 * `/report` is reached by a GET form, so a report URL carries the homeowner's
 * street address, city and ZIP in the query string. That is fine while it is a
 * link in their own browser history. It is not fine indexed: anybody who posts
 * a report link on a forum asking for help would, without this, hand a crawler
 * a real residential address attached to a page about a dispute over their
 * land. Search engines would then serve it to anyone who looked.
 *
 * Nothing about that is hypothetical — asking strangers for help with a
 * property problem by pasting a link is exactly what a person with this
 * problem does.
 *
 * SO EVERY PARAMETERISED ROUTE IS DISALLOWED, and the landing page is the only
 * thing offered to crawlers. It is also the only page that would rank for
 * anything useful: a report about one stranger's parcel answers no search
 * query, while the front page answers the query the whole product is for.
 *
 * ROBOTS.TXT IS A REQUEST, NOT A CONTROL. Well-behaved crawlers honour it and
 * nothing else does. The parameterised pages therefore ALSO carry
 * `robots: { index: false }` in their own metadata, which emits a noindex
 * header that is harder to ignore. Neither is a substitute for the other.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Carries the user's address in the URL.
          '/report',
          // Developer harnesses. Raw JSON, no value to a searcher, and they
          // would compete with the landing page for the same queries.
          '/analyze',
          '/search',
          // Artefact surfaces. Parameterised with names and addresses.
          '/advocacy',
          '/inquiry',
          '/checkout',
          // 404s in production anyway; listed so the intent survives a change
          // to that gate.
          '/readiness',
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
