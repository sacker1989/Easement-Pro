/**
 * Where this instance is deployed.
 *
 * NOT IN layout.tsx, where it started. Next's App Router allows only a known
 * set of exports from a route file and rejects anything else at type-check
 * time — a useful constraint that is easy to trip over, since a layout looks
 * like an ordinary module.
 *
 * NO `NEXT_PUBLIC_` PREFIX, AND THAT IS THE POINT OF THE CURRENT SHAPE. The
 * value is read only on the server — `metadataBase`, `robots.ts`,
 * `sitemap.ts`. Nothing client-side touches it. A `NEXT_PUBLIC_` variable is
 * INLINED AT BUILD TIME, so the prefix bought nothing except the requirement
 * to redeploy after changing it, and the failure mode was silent: set the
 * variable on a live project, see the sitemap still advertising localhost, and
 * have no reason to suspect the prefix.
 *
 * A FUNCTION RATHER THAN A CONST, so route handlers resolve it per request
 * instead of at module load.
 *
 * THE FUNCTION ALONE IS NOT ENOUGH, which I found by testing rather than by
 * reasoning. Next prerenders `robots.txt` and `sitemap.xml` by default, so
 * both baked in whatever the environment held when the BUILD ran — exactly the
 * trap that dropping `NEXT_PUBLIC_` was meant to remove, reintroduced one
 * layer down. They now carry `export const dynamic = 'force-dynamic'`, and
 * REMOVING THAT SILENTLY RESTORES THE OLD BEHAVIOUR. Verified against a real
 * production server: one build, three environments, three different origins.
 *
 * AND ON VERCEL, CHANGING THE VARIABLE STILL NEEDS A REDEPLOY. Environment
 * variables are bound to a deployment when it is created, so a running function
 * reads its own snapshot rather than live project settings. force-dynamic buys
 * per-request evaluation, not live settings reads — the two are easy to
 * conflate and the runbook got it wrong for two days.
 *
 * SET IT EXPLICITLY ON ANY DEPLOYMENT WHOSE CANONICAL HOST MATTERS. The
 * VERCEL_PROJECT_PRODUCTION_URL fallback below exists so a fresh deploy is
 * correct BY DEFAULT, not so a configured project can rely on it: it tracks a
 * Vercel-managed value that is invisible from here and moved under us once,
 * when the domains were reconfigured.
 *
 * `metadataBase` is still fixed at build, because it is read from a static
 * `metadata` export. Making it dynamic needs `generateMetadata`, which is not
 * worth it for a value that changes about once in a project's life — and on
 * Vercel the fallback below is present at build time anyway, so it is correct
 * there regardless.
 */

/** Trailing slash would produce `https://host//sitemap.xml`. */
function normalise(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/**
 * The public origin, e.g. `https://easement.example.com`.
 *
 * Takes `env` so the fallback chain is testable without mutating global state,
 * the same reason `resolveAuditStore` and `operatorPagesEnabled` take one.
 */
export function siteUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit !== undefined && explicit !== '') return normalise(explicit);

  /*
   * VERCEL SUPPLIES THIS, so a Vercel deploy is correct with nothing set.
   *
   * PROJECT_PRODUCTION_URL rather than VERCEL_URL, deliberately. VERCEL_URL is
   * the per-deployment hostname, unique to each build, and a preview deploy
   * using it would publish a sitemap and canonical tags advertising itself as
   * the authoritative copy of the site. Every preview would compete with
   * production for the same URLs. The production URL is the right canonical
   * from every environment.
   *
   * It is a hostname with no scheme, hence the prefix.
   */
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel !== undefined && vercel !== '') return `https://${normalise(vercel)}`;

  /*
   * LOCALHOST RATHER THAN A GUESSED DOMAIN. A wrong absolute URL in a
   * canonical tag or a sitemap is worse than a useless one: it points crawlers
   * at somebody else's site and asks them to treat it as authoritative.
   * Localhost is obviously wrong to anyone who looks, which is the right
   * failure mode for a value nobody set.
   */
  return 'http://localhost:3000';
}
