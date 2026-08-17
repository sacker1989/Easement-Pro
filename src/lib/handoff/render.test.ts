import { describe, expect, it } from 'vitest';
import {
  buildSections,
  renderJson,
  renderMarkdown,
  renderPlainText,
  ILLUSTRATIVE_BANNER,
  NOT_DETERMINED_HEADING,
} from './render';
import {
  buildLandValueSection,
  buildReferralPackage,
  ReferralPackageError,
  type ReferralPackage,
} from './referral-package';
import { buildEncumberedArea } from './area-derivation';
import { REQUIRED_DISCLAIMER_PHRASE, scanForAppraisalClaims } from './appraisal-claim-scan';
import { assessEvidenceTier } from '@/lib/easements/evidence-tier';
import { calibratedRange, describeCalibration } from '@/lib/valuation/calibrated-range';
import { reconcilePaths } from '@/lib/valuation/reconcile-paths';

const PARCEL = {
  parcelId: '2483004013',
  county: 'Los Angeles County',
  state: 'CA',
  fipsCode: '06037',
  routingTier: 'immediate' as const,
  situsAddress: '428 N CALIFORNIA ST BURBANK CA 91505',
  ownerName: null,
  geometrySource: 'LACounty_Parcel/MapServer/0',
  sourceVerifiedOn: '2026-07-30',
};

function build(overrides: Partial<Parameters<typeof buildReferralPackage>[0]> = {}) {
  return buildReferralPackage({
    parcel: PARCEL,
    findings: [assessEvidenceTier(0)],
    evidenceSummary: 'One feature crossing the parcel.',
    fromRecordedEasements: false,
    provenance: { kind: 'proximity-inference', distanceFt: 0, layer: 'HIFLD' },
    encumberedArea: null,
    landValue: null,
    generatedAt: '2026-08-17T00:00:00.000Z',
    ...overrides,
  });
}

/** A package carrying a figure: bounded band at 90% coverage. */
function withLandValue(coverage: 90 | 95 = 90) {
  const range = calibratedRange(1_000_000, coverage, 'zip-comparable');
  const rec = reconcilePaths({ landValue: 1_000_000, source: 'zip' }, null);
  return {
    pkg: build({
      landValue: buildLandValueSection(rec, range),
      encumberedArea: buildEncumberedArea(
        1204,
        { kind: 'published-field', layer: 'Easements', field: 'AREA_SQFT', queriedOn: '2026-08-17' },
        43_560,
      ),
    }),
    range,
  };
}

const ALL_RENDERERS = [
  ['plain text', renderPlainText],
  ['markdown', renderMarkdown],
  ['json', renderJson],
] as const;

/** The fixture set §12.2 asks the scanner to be clean across. */
const FIXTURES: readonly [string, ReferralPackage][] = [
  ['minimal', build()],
  ['with land value band', withLandValue(90).pkg],
  ['with unbounded band', withLandValue(95).pkg],
  ['illustrative', build({ illustrative: true })],
];

describe('every renderer carries the not-determined section', () => {
  for (const [name, render] of ALL_RENDERERS) {
    it(`${name}: contains the heading and every floor item's text`, () => {
      const out = render(build());
      // JSON carries the heading as the field name rather than the prose
      // heading; what must survive in all three is the item text itself.
      if (name !== 'json') expect(out).toContain(NOT_DETERMINED_HEADING);
      for (const item of build().notDetermined) {
        expect(out).toContain(item.what);
      }
    });
  }

  for (const [name, render] of ALL_RENDERERS) {
    it(`${name}: throws rather than rendering a package with the section stripped`, () => {
      const stripped = { ...build(), notDetermined: [] } as unknown as ReferralPackage;
      expect(() => render(stripped)).toThrow(ReferralPackageError);
    });
  }
});

describe('ordering: the limits come before the numbers', () => {
  // Asserted by index rather than by reading the template, so it survives an
  // edit to the section list. A reader who stops early has read the caveats;
  // a copy truncated for an email keeps them.
  for (const [name, render] of [
    ['plain text', renderPlainText],
    ['markdown', renderMarkdown],
  ] as const) {
    it(`${name}: the heading precedes the first dollar figure`, () => {
      const out = render(withLandValue().pkg);
      const headingAt = out.indexOf(NOT_DETERMINED_HEADING);
      const firstDollarAt = out.indexOf('$');
      expect(headingAt).toBeGreaterThanOrEqual(0);
      expect(firstDollarAt).toBeGreaterThanOrEqual(0);
      expect(headingAt).toBeLessThan(firstDollarAt);
    });
  }

  it('places it third, after parcel identity', () => {
    const order = buildSections(build()).map((s) => s.heading);
    expect(order.indexOf(NOT_DETERMINED_HEADING)).toBe(2);
    expect(order.indexOf('LAND VALUE')).toBeGreaterThan(order.indexOf(NOT_DETERMINED_HEADING));
  });
});

describe('no renderer can be asked for a subset', () => {
  it('each takes exactly one parameter', () => {
    // A `sections` argument is precisely how the not-determined section would
    // get dropped from a "short" view, so none of them has one.
    for (const [, render] of ALL_RENDERERS) {
      expect(render.length).toBe(1);
    }
  });
});

describe('no rendered form claims to be an appraisal', () => {
  for (const [fixtureName, pkg] of FIXTURES) {
    for (const [name, render] of ALL_RENDERERS) {
      it(`${fixtureName} / ${name}: clean, and carries the required disclaimer`, () => {
        const out = render(pkg);
        const scan = scanForAppraisalClaims(out);
        expect(scan.violations).toEqual([]);
        expect(out.toLowerCase()).toContain(REQUIRED_DISCLAIMER_PHRASE);
      });
    }
  }

  it('positive control: a doctored free-text field IS caught', () => {
    // Without this the scanner could be dead and every test above would still
    // pass, because they only assert the absence of a match.
    const doctored = build({
      evidenceSummary: 'This report is an appraisal of the easement.',
    });
    expect(() => renderPlainText(doctored)).toThrow(ReferralPackageError);
    expect(() => renderPlainText(doctored)).toThrow(/claim scan/);
  });
});

describe('the unbounded top is stated, never numbered', () => {
  it('says UNBOUNDED at 95% coverage and prints no upper figure', () => {
    const { pkg, range } = withLandValue(95);
    expect(range.highUnbounded).toBe(true);
    const out = renderPlainText(pkg);
    expect(out).toContain('Upper bound: UNBOUNDED');
    expect(out).not.toMatch(/Upper bound: \$/);
  });

  it('prints a figure at 90% coverage, where one exists', () => {
    const { pkg, range } = withLandValue(90);
    expect(range.highUnbounded).toBe(false);
    expect(renderPlainText(pkg)).toMatch(/Upper bound: \$/);
  });

  it('reproduces describeCalibration verbatim, both limitation sentences', () => {
    const { pkg, range } = withLandValue(90);
    expect(renderPlainText(pkg)).toContain(describeCalibration(range));
  });

  it('labels the figure as parcel land value, not an easement value', () => {
    const out = renderPlainText(withLandValue().pkg);
    expect(out).toContain('not the value of any easement');
    expect(out).toContain('strip valuation');
  });
});

describe('no figure is the normal case, and it says so', () => {
  it('explains the absence rather than leaving a blank', () => {
    const out = renderPlainText(build());
    expect(out).toContain('No land-value figure is reported');
    expect(out).toContain('no number is better than a number');
    expect(out).not.toContain('$0');
  });

  it('states nothing rather than assuming a width when area is unknown', () => {
    expect(renderPlainText(build())).toContain('applying a default width');
  });
});

describe('the illustrative banner reaches all three forms', () => {
  it('appears in plain text and markdown', () => {
    expect(renderPlainText(build({ illustrative: true }))).toContain(ILLUSTRATIVE_BANNER);
    expect(renderMarkdown(build({ illustrative: true }))).toContain(ILLUSTRATIVE_BANNER);
  });

  it('travels as a field in JSON', () => {
    // JSON has no prose banner; the flag the banners are rendered from is the
    // thing that must survive, so a consumer can render its own.
    expect(JSON.parse(renderJson(build({ illustrative: true }))).illustrative).toBe(true);
    expect(JSON.parse(renderJson(build())).illustrative).toBe(false);
  });

  it('is absent when nothing is hypothetical', () => {
    expect(renderPlainText(build())).not.toContain(ILLUSTRATIVE_BANNER);
  });
});

describe('provenance is reported next to the tier', () => {
  it('shows flagged provenance for a tier A proximity finding', () => {
    const out = renderPlainText(build());
    expect(out).toContain('Tier A at 0 ft');
    expect(out).toContain('Provenance confidence: flagged');
  });
});

describe('the three forms do not diverge', () => {
  it('all render from the same section list', () => {
    // buildSections is the single source; the formatters only add punctuation.
    const pkg = withLandValue().pkg;
    const headings = buildSections(pkg).map((s) => s.heading);
    const plain = renderPlainText(pkg);
    const md = renderMarkdown(pkg);
    for (const h of headings) {
      expect(plain).toContain(h);
      expect(md).toContain(h);
    }
  });
});
