import { describe, expect, it } from 'vitest';
import { siteUrl } from './site';

describe('siteUrl', () => {
  it('prefers an explicit SITE_URL', () => {
    expect(siteUrl({ SITE_URL: 'https://easement.example.com' })).toBe(
      'https://easement.example.com',
    );
  });

  it('strips a trailing slash', () => {
    // Otherwise robots.txt advertises `https://host//sitemap.xml`, which is a
    // different URL and resolves to nothing useful.
    expect(siteUrl({ SITE_URL: 'https://easement.example.com/' })).toBe(
      'https://easement.example.com',
    );
    expect(siteUrl({ SITE_URL: 'https://easement.example.com///' })).toBe(
      'https://easement.example.com',
    );
  });

  it('falls back to the Vercel production URL, with a scheme added', () => {
    // Vercel supplies a bare hostname, so a deploy is correct with nothing set.
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'easement-pro.vercel.app' })).toBe(
      'https://easement-pro.vercel.app',
    );
  });

  it('lets an explicit value override Vercel, for a custom domain', () => {
    expect(
      siteUrl({
        SITE_URL: 'https://easements.co',
        VERCEL_PROJECT_PRODUCTION_URL: 'easement-pro.vercel.app',
      }),
    ).toBe('https://easements.co');
  });

  it('ignores a blank or whitespace value rather than emitting an empty origin', () => {
    expect(siteUrl({ SITE_URL: '   ' })).toBe('http://localhost:3000');
    expect(siteUrl({ SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' })).toBe(
      'https://x.vercel.app',
    );
  });

  it('falls back to localhost rather than guessing a domain', () => {
    // A wrong absolute URL in a canonical tag points crawlers at somebody
    // else's site and asks them to treat it as authoritative. Localhost is
    // obviously wrong to anyone who looks, which is the right failure mode.
    expect(siteUrl({})).toBe('http://localhost:3000');
  });

  it('does not use VERCEL_URL, which is per-deployment', () => {
    /*
     * THE ONE WORTH PINNING. VERCEL_URL is unique to each build, so a preview
     * deploy using it would publish a sitemap and canonical tags advertising
     * ITSELF as the authoritative copy — every preview competing with
     * production for the same URLs. The production URL is the right canonical
     * from every environment, including previews.
     */
    expect(siteUrl({ VERCEL_URL: 'easement-pro-git-abc123.vercel.app' })).toBe(
      'http://localhost:3000',
    );
  });

  it('produces a value that parses as a URL', () => {
    // metadataBase does `new URL(siteUrl())` and a malformed origin throws at
    // render rather than at the boundary.
    for (const env of [
      {},
      { SITE_URL: 'https://easements.co/' },
      { VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' },
    ]) {
      expect(() => new URL(siteUrl(env))).not.toThrow();
    }
  });
});

describe('nothing reads the build-inlined variable any more', () => {
  it('no source file references NEXT_PUBLIC_SITE_URL', async () => {
    // A NEXT_PUBLIC_ variable is inlined at build time, so setting it on a
    // live project changed nothing until a redeploy — and the failure was
    // silent: the sitemap kept advertising localhost with no reason to suspect
    // the prefix. Nothing here is read client-side, so the prefix bought only
    // that trap.
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        // TESTS EXCLUDED, and this file is why. It names the forbidden string
        // in its own assertion and in the comment explaining the assertion —
        // the tenth time in this codebase that a guard has fired on its own
        // explanation. Source files are what the rule is about.
        else if (
          /\.tsx?$/.test(name) &&
          !/\.test\.tsx?$/.test(name) &&
          readFileSync(full, 'utf8').includes('NEXT_PUBLIC_SITE_URL')
        )
          offenders.push(full);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe('the routes that read siteUrl stay dynamic', () => {
  it('robots.ts and sitemap.ts declare force-dynamic', async () => {
    /*
     * NOT TESTABLE ANY OTHER WAY FROM HERE. Whether Next prerenders a route is
     * a property of the build output, which vitest cannot see — but removing
     * this line silently reverts both files to static and bakes in the
     * build-time origin, which is exactly the trap dropping NEXT_PUBLIC_ was
     * meant to remove. Confirmed by mutation: without it, `next build` reports
     * `○ /robots.txt` instead of `ƒ`.
     *
     * A source-text assertion is the weak form and it is the one that runs.
     */
    const { readFileSync } = await import('node:fs');
    const appDir = new URL('../app/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    for (const file of ['robots.ts', 'sitemap.ts']) {
      const source = readFileSync(`${appDir}${file}`, 'utf8');
      expect(source, `${file} must stay dynamic to read SITE_URL per request`).toContain(
        "export const dynamic = 'force-dynamic'",
      );
      expect(source).toContain('siteUrl()');
    }
  });
});
