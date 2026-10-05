/**
 * Where this instance is deployed.
 *
 * NOT IN layout.tsx, where it started. Next's App Router allows only a known
 * set of exports from a route file and rejects anything else at type-check
 * time — a useful constraint that is easy to trip over, since a layout looks
 * like an ordinary module.
 *
 * FALLS BACK TO LOCALHOST RATHER THAN GUESSING A DOMAIN. A wrong absolute URL
 * in a canonical tag or a sitemap is worse than a useless one: it points
 * crawlers at somebody else's site and asks them to treat it as authoritative.
 * Localhost is obviously wrong to anyone who looks, which is the right failure
 * mode for a value nobody set.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
