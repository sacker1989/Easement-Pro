/**
 * CONTENT SECURITY POLICY LIVES HERE, NOT IN vercel.json, and that is a
 * deliberate choice rather than a filing decision.
 *
 * vercel.json headers apply only on Vercel. A policy defined there cannot be
 * exercised by `next start` locally, so the first time anyone finds out it
 * breaks hydration is in production. Defined here it applies to the local
 * production build too, which is where this one was tested before it shipped.
 *
 * The other security headers stay in vercel.json. They are static strings that
 * cannot break a page, and moving them would be churn.
 */

/**
 * The policy, built from what the pages were measured to load rather than
 * from a boilerplate.
 *
 * MEASURED ON THE LIVE SITE, every page: scripts, stylesheets and forms are
 * all same-origin, there are no iframes, no web fonts (the stack is
 * ui-serif/Georgia), no external images, and no `data:` URIs anywhere — the
 * lot diagram is an inline <svg> element, not an image source.
 *
 * WHAT THIS DOES NOT DO, stated plainly because a CSP with 'unsafe-inline' in
 * script-src is easy to mistake for more than it is: it does NOT stop an
 * injected inline <script> from executing. Blocking that needs a nonce, and a
 * nonce needs middleware and per-request rendering — which would force the
 * sixteen statically generated pages (/, /learn, the twelve guides, /privacy)
 * to render dynamically. Those are exactly the pages search traffic lands on,
 * and this is a free product paying for its own compute. The trade was made
 * knowingly; it is written down so the next person does not have to guess
 * whether it was.
 *
 * WHAT IT DOES DO is narrow the consequences of an injection rather than the
 * injection itself, which is still most of the value here:
 *
 *   script-src 'self'   an injected <script src> cannot load attacker code
 *   connect-src 'self'  nothing can be exfiltrated to another origin — and
 *                       this page carries a home address, so that is the one
 *                       that matters most
 *   form-action 'self'  a form cannot be re-pointed at someone else's server
 *   base-uri 'none'     a <base> tag cannot silently repoint every relative
 *                       URL on the page
 *   object-src 'none'   no plugins
 *   frame-ancestors     clickjacking, matching the X-Frame-Options already set
 *
 * style-src carries 'unsafe-inline' because the pages use 61 inline `style`
 * attributes, and a nonce would not help regardless: nonces do not apply to
 * style attributes at all. Injected CSS is a far smaller problem than
 * injected script.
 *
 * `data:` IS DELIBERATELY ABSENT from img-src. Nothing uses it today —
 * measured, not assumed — and this codebase has a habit of deleting what is
 * unused rather than keeping it against a possible future. If an inline icon
 * ever needs it, adding it is one word and should be a decision someone makes
 * rather than a permission that was always there.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Static generation defaults to one worker per core, which exhausts heap on
    // memory-constrained machines (observed: OutOfMemoryException at
    // "Generating static pages"). This app has 8 trivial routes — extra
    // parallelism buys nothing and costs a build failure.
    cpus: 1,
    workerThreads: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }],
      },
    ];
  },
};

export default nextConfig;
