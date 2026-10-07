import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES, type EasementType } from '@/lib/easements/easement-types';
import { GUIDE_BY_TYPE, guideFor, isGuideType } from '@/lib/easements/guide-content';
import { RESPONSIBILITIES_BY_TYPE } from '@/lib/easements/responsibilities';

/**
 * The /learn guides are asserted like everything else.
 *
 * Source-text for page structure (the convention home-page.test.ts gives:
 * server components, so structure is asserted on source), direct module
 * import for the pure-data guide content — guide-content.ts reaches no live
 * services, so importing it is the stronger check.
 */

const INDEX_SRC = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const TYPE_SRC = readFileSync(new URL('./[type]/page.tsx', import.meta.url), 'utf8');
const DIAGRAMS_SRC = readFileSync(new URL('./diagrams.tsx', import.meta.url), 'utf8');
const LAYOUT_SRC = readFileSync(new URL('../layout.tsx', import.meta.url), 'utf8');
const FOOTER_SRC = readFileSync(
  new URL('../../components/site-footer.tsx', import.meta.url),
  'utf8',
);

describe('every easement type has a guide', () => {
  it('covers all twelve types, keyed by the canonical list', () => {
    // Driven off EASEMENT_TYPES so a thirteenth type cannot ship without a guide.
    for (const t of EASEMENT_TYPES) {
      expect(GUIDE_BY_TYPE[t], `no guide for ${t}`).toBeDefined();
      expect(isGuideType(t)).toBe(true);
    }
    expect(Object.keys(GUIDE_BY_TYPE)).toHaveLength(EASEMENT_TYPES.length);
  });

  it('rejects unknown slugs', () => {
    expect(isGuideType('sewer')).toBe(true);
    expect(isGuideType('not-a-type')).toBe(false);
    expect(isGuideType('')).toBe(false);
  });

  it('each guide has complete content', () => {
    for (const t of EASEMENT_TYPES) {
      const g = guideFor(t);
      expect(g.oneLiner.length, `${t}: oneLiner`).toBeGreaterThan(10);
      expect(g.whatItIs.length, `${t}: whatItIs`).toBeGreaterThan(0);
      expect(g.howToCheck.length, `${t}: howToCheck`).toBeGreaterThan(1);
      expect(g.howToRequestMaintenance.length, `${t}: howToRequestMaintenance`).toBeGreaterThan(1);
    }
  });

  it('the index links to all twelve guides', () => {
    // Template literal over EASEMENT_TYPES — one link per type by construction.
    expect(INDEX_SRC).toContain('EASEMENT_TYPES.map');
    expect(INDEX_SRC).toContain('`/learn/${type}`');
  });

  it('all twelve slugs are statically generated', () => {
    expect(TYPE_SRC).toContain('generateStaticParams');
    expect(TYPE_SRC).toContain('EASEMENT_TYPES.map');
    expect(TYPE_SRC).toContain('notFound()');
  });
});

describe('each guide page has the required sections', () => {
  const SECTIONS = [
    '<h2>What it is</h2>',
    '<h2>How to check for it</h2>',
    '<h2>How to request maintenance</h2>',
    '<h2>How it affects home value</h2>',
    '<h2>When this goes wrong</h2>',
  ];

  it('renders all four required sections plus the incident section', () => {
    for (const s of SECTIONS) {
      expect(TYPE_SRC, `missing section ${s}`).toContain(s);
    }
  });

  it('the incident section follows the three-part structure', () => {
    for (const h of [
      '<h4>What happened</h4>',
      '<h4>Why it happened</h4>',
      '<h4>Could this happen at your property?</h4>',
    ]) {
      expect(TYPE_SRC, `missing incident subheading ${h}`).toContain(h);
    }
  });

  it('carries the disclosure posture on every page', () => {
    expect(TYPE_SRC).toContain('RESPONSIBILITIES_DISCLOSURE');
  });

  it('renders the value section from the curated record, not invented copy', () => {
    expect(TYPE_SRC).toContain('record.valueAndProtection');
  });

  it('every guide has a diagram', () => {
    for (const t of EASEMENT_TYPES) {
      // Keys are quoted only when the slug is not a valid identifier.
      expect(DIAGRAMS_SRC, `no diagram for ${t}`).toMatch(new RegExp(`['"]?${t}['"]?\\s*:`));
    }
  });
});

describe('headlines stay jargon-free', () => {
  it('the index headline never leads with the word "easement"', () => {
    const h1 = INDEX_SRC.match(/<h1>([^<]*)<\/h1>/)?.[1] ?? '';
    expect(h1.length).toBeGreaterThan(0);
    expect(h1).not.toMatch(/^\s*easement/i);
  });

  it('no type headline leads with the word "easement"', () => {
    for (const t of EASEMENT_TYPES) {
      const heading = RESPONSIBILITIES_BY_TYPE[t as EasementType].heading;
      expect(heading, `${t} headline`).not.toMatch(/^\s*easement/i);
    }
  });
});

describe('incidents are sourced or labeled illustrative', () => {
  it('every incident has the three parts', () => {
    for (const t of EASEMENT_TYPES) {
      const inc = guideFor(t).incident;
      expect(inc.whatHappened.length, `${t}: whatHappened`).toBeGreaterThan(20);
      expect(inc.whyItHappened.length, `${t}: whyItHappened`).toBeGreaterThan(20);
      expect(inc.couldItHappenToYou.length, `${t}: couldItHappenToYou`).toBeGreaterThan(20);
    }
  });

  it('non-illustrative incidents carry sources; illustrative ones are labeled', () => {
    // An illustrative pattern may still cite supporting data (e.g. published cost
    // figures) — the rule is that nothing specific goes unsourced, not that
    // illustrative sections must be source-free.
    for (const t of EASEMENT_TYPES) {
      const inc = guideFor(t).incident;
      if (!inc.illustrative) {
        expect(inc.sources.length, `${t}: sourced incident needs at least one source`).toBeGreaterThan(0);
      }
      for (const s of inc.sources) {
        expect(s.label.length, `${t}: source label`).toBeGreaterThan(0);
        expect(s.url, `${t}: source url`).toMatch(/^https?:\/\//);
      }
    }
    // The page renders the illustrative label.
    expect(TYPE_SRC).toContain('Illustrative example');
  });

  it('photos carry attribution', () => {
    for (const t of EASEMENT_TYPES) {
      const photo = guideFor(t).photo;
      if (!photo) continue;
      expect(photo.src).toMatch(/^\/learn\/.+\.jpg$/);
      expect(photo.alt.length).toBeGreaterThan(0);
      expect(photo.credit).toMatch(/(CC|public domain)/i);
    }
  });
});

describe('the footer links to Learn', () => {
  it('sits next to the Privacy link', () => {
    // The footer is one component rendered from the root layout, so the link
    // lives in site-footer.tsx and the layout must render it.
    expect(FOOTER_SRC).toContain('href="/learn"');
    expect(FOOTER_SRC).toContain('>Learn<');
    expect(LAYOUT_SRC).toContain('<SiteFooter />');
  });
});

describe('learn pages stay indexable and input-free', () => {
  it('neither page takes query input', () => {
    // The indexing guard in indexing.test.ts matches a literal token; these
    // assertions pin the same property directly so a regression names itself.
    for (const [name, src] of [
      ['index', INDEX_SRC],
      ['[type]', TYPE_SRC],
    ] as const) {
      expect(src, `${name} must not read query input`).not.toContain('search' + 'Params');
    }
  });

  it('both pages set metadata and declare no noindex', () => {
    expect(INDEX_SRC).toContain('export const metadata');
    expect(TYPE_SRC).toContain('export function generateMetadata');
    for (const src of [INDEX_SRC, TYPE_SRC]) {
      expect(src).not.toMatch(/index:\s*false/);
    }
  });
});
