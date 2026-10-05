import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import robots from './robots';
import sitemap from './sitemap';
import { codeOf } from '@/lib/test-support/source-text';

const APP_DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Every page.tsx under src/app, as [routePath, source]. */
function routes(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string, route: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full, `${route}/${name}`);
      } else if (name === 'page.tsx') {
        out.push([route === '' ? '/' : route, readFileSync(full, 'utf8')]);
      }
    }
  };
  walk(APP_DIR, '');
  return out;
}

describe('routes that carry user input are never indexed', () => {
  it('finds the routes to check', () => {
    // A sweep that silently matches nothing passes forever.
    expect(routes().length).toBeGreaterThanOrEqual(6);
  });

  it('every page taking searchParams declares noindex', () => {
    /*
     * THE STRUCTURAL GUARD, AND THE REASON THIS FILE EXISTS.
     *
     * A page that reads searchParams is reached by a GET form, so its URL
     * carries whatever the user typed — for /report that is their street
     * address, city and ZIP. Indexed, that puts a real residential address in
     * a search engine, attached to a page about a dispute over their land.
     *
     * The failure mode is a NEW route added later by someone who has no
     * reason to think about crawlers. This catches that rather than relying on
     * them remembering.
     */
    for (const [route, source] of routes()) {
      if (!source.includes('searchParams')) continue;
      expect(
        source,
        `${route} reads searchParams but does not declare noindex — see robots.ts`,
      ).toMatch(/robots:\s*\{\s*index:\s*false/);
    }
  });

  it('the landing page is the one that IS indexed', () => {
    const home = routes().find(([r]) => r === '/')![1];
    expect(home).not.toContain('searchParams');
    expect(home).not.toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});

describe('robots.txt', () => {
  const rule = () => {
    const r = robots().rules;
    return Array.isArray(r) ? r[0]! : r;
  };

  it('disallows every route that reads searchParams', () => {
    // Derived from the filesystem rather than written out, so a new
    // parameterised route cannot be allowed by omission.
    const disallowed = rule().disallow;
    const list = Array.isArray(disallowed) ? disallowed : [disallowed];
    for (const [route, source] of routes()) {
      if (route === '/' || !source.includes('searchParams')) continue;
      expect(list, `${route} is not disallowed in robots.txt`).toContain(route);
    }
  });

  it('allows the landing page', () => {
    expect(rule().allow).toBe('/');
  });

  it('points at the sitemap', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe('sitemap', () => {
  it('lists only the landing page', () => {
    // A sitemap listing a parameterised route would contradict robots.ts, and
    // that kind of inconsistency gets resolved in the crawler's favour.
    const entries = sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.url).not.toContain('?');
    for (const forbidden of ['/report', '/analyze', '/advocacy', '/inquiry']) {
      expect(entries[0]!.url).not.toContain(forbidden);
    }
  });
});

describe('the site description', () => {
  // codeOf, not the raw file: this file's own prose quotes the old
  // description verbatim to explain why it changed, and a guard that fires on
  // the comment explaining the guard is a failure this codebase has now hit
  // nine times.
  const LAYOUT = codeOf(join(APP_DIR, 'layout.tsx'));

  it('no longer claims to be an LA County tool', () => {
    // It said "LA County Property Easement & Advocacy Tool" until the flood
    // lookup and the easement guidance went national. Every shared link and
    // every search result carried it.
    expect(LAYOUT).not.toContain('LA County');
  });

  it('does not use the internal project name as the title', () => {
    // "Easement MVP" is meaningless to anyone searching, and the title is the
    // product's front page for most people who will ever see it.
    expect(LAYOUT).not.toMatch(/title:\s*'Easement MVP'/);
  });

  it('says it is free and says it is not legal advice', () => {
    expect(LAYOUT).toMatch(/free\./i);
    expect(LAYOUT).toMatch(/not legal advice/i);
  });
});
