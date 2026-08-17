/**
 * The three rendered forms of a referral package: plain text, markdown, JSON.
 *
 * ONE SECTION MODEL, THREE FORMATTERS. `buildSections()` produces the ordered
 * content once and the formatters only decide punctuation. The spec asks for
 * "no divergent content" across the three forms; doing it this way makes
 * divergence impossible rather than merely discouraged, and it means the
 * ordering rule below is enforced in one place instead of three templates.
 *
 * THE ORDERING RULE IS LOAD-BEARING. "What was not determined" renders
 * immediately after parcel identity and before any dollar figure. A reader who
 * stops early has read the limits rather than only the numbers, and a copy
 * truncated for an email keeps them. The suite asserts this by index
 * comparison — the heading must appear before the first `$` in the document —
 * so it survives an edit to the section list.
 *
 * NO `sections` SELECTOR. None of these functions takes a parameter naming
 * which sections to emit. That is the same reason `buildReferralPackage` has
 * no `notDetermined` parameter: a filter argument is exactly how the
 * not-determined section would get dropped from a "short" view.
 *
 * SECTIONS 7 AND 8 OF THE SPEC ARE ABSENT ON PURPOSE. The temporary-easement
 * addendum and the records-request drafts are not yet fields of
 * `ReferralPackage`. They are omitted rather than stubbed, so nothing renders
 * an empty heading implying a check was performed. `rent-intake.ts` and
 * `records-request/` add them.
 */

import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import {
  assertPackageIntegrity,
  type LandValueSection,
  type ReferralPackage,
} from './referral-package';

/**
 * The exact heading text, exported so the ordering test can locate it rather
 * than re-typing a string that could drift out of sync with the renderer.
 */
export const NOT_DETERMINED_HEADING = 'WHAT WAS NOT DETERMINED';

/** Shown whenever any figure rests on a hypothetical input. */
export const ILLUSTRATIVE_BANNER =
  'ILLUSTRATIVE ONLY — one or more inputs below is hypothetical rather than observed. ' +
  'No figure in this package should be relied on or quoted.';

/** Rendered while the disclaimer language still awaits compliance sign-off. */
export const NOT_REVIEWED_BY_COUNSEL_LINE =
  'The language in this package has not been reviewed by counsel.';

/** A rendered section: one heading, a list of lines beneath it. */
export interface RenderedSection {
  readonly heading: string;
  readonly lines: readonly string[];
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function orUnknown(value: string | null): string {
  return value === null || value.trim() === '' ? 'not available' : value;
}

/**
 * Land value lines, or the reason there are none.
 *
 * `high === null` renders as an explicit unbounded top and never as a number.
 * At 95% coverage the measured error exceeds 100%, so there is no finite upper
 * bound to print; substituting a large number would read as a bound that the
 * measurement does not support.
 */
function landValueLines(section: LandValueSection | null): string[] {
  if (section === null) {
    return [
      'No land-value figure is reported for this parcel.',
      'This is a normal outcome rather than an error: a figure is emitted only where the ' +
        'ZIP-comparable path applies, the ZIP passes its fitness gate, and the two valuation ' +
        'paths agree. Where any of those fails, no number is better than a number.',
      'See the not-determined section above.',
    ];
  }

  const { reconciliation: r } = section;
  const lines: string[] = [];

  if (r.pointEstimate === null) {
    lines.push(
      'Lead figure: none. The available paths do not agree closely enough for a single number ' +
        'to be reported; presenting one would assert a resolution the evidence does not support.',
    );
  } else {
    lines.push(`Lead figure: ${money(r.pointEstimate)}`);
  }

  if (r.low !== null) lines.push(`Lower bound: ${money(r.low)}`);

  if (section.upperBoundUnbounded || r.high === null) {
    lines.push(
      'Upper bound: UNBOUNDED. At this coverage level the measured error exceeds 100%, so no ' +
        'finite upper bound exists. No upper number is shown because there is not one to show.',
    );
  } else {
    lines.push(`Upper bound: ${money(r.high)}`);
  }

  lines.push(`Confidence: ${r.confidence}`);
  lines.push(r.explanation);
  lines.push(section.whatThisFigureIs);
  lines.push(section.calibrationNote);
  return lines;
}

/**
 * The ordered content of every rendered form.
 *
 * Exported so a test can assert the ORDER directly, rather than inferring it
 * from formatted output.
 */
export function buildSections(pkg: ReferralPackage): readonly RenderedSection[] {
  const sections: RenderedSection[] = [];

  sections.push({
    heading: 'WHAT THIS IS',
    lines: [pkg.whatThisIs],
  });

  sections.push({
    heading: 'PARCEL',
    lines: [
      `Parcel ID: ${pkg.parcel.parcelId}`,
      `County: ${pkg.parcel.county}, ${pkg.parcel.state}`,
      `FIPS: ${orUnknown(pkg.parcel.fipsCode)}`,
      `Situs address: ${orUnknown(pkg.parcel.situsAddress)}`,
      `Owner of record: ${orUnknown(pkg.parcel.ownerName)}`,
      `Geometry source: ${orUnknown(pkg.parcel.geometrySource)}`,
      `Source last verified: ${orUnknown(pkg.parcel.sourceVerifiedOn)}`,
    ],
  });

  // Third by rule, before any dollar figure. See the module comment.
  sections.push({
    heading: NOT_DETERMINED_HEADING,
    lines: [
      'Each item below is a question this package does not answer, why it cannot, and what ' +
        'would answer it. The list is part of the finding, not a disclaimer appended to it.',
      ...pkg.notDetermined.flatMap((item) => [
        `- ${item.what}`,
        `    Why not: ${item.why}`,
        `    Who resolves it: ${item.whoResolves}`,
        `    What would resolve it: ${item.whatWouldResolveIt}`,
      ]),
    ],
  });

  sections.push({
    heading: 'EVIDENCE',
    lines: [
      pkg.evidence.summary,
      `Derived from recorded easements: ${pkg.evidence.fromRecordedEasements ? 'yes' : 'no'}`,
      // Stated alongside the tier on purpose: a tier A finding whose provenance
      // is proximity inference is still `flagged`, and reporting the tier alone
      // would overstate it.
      `Provenance confidence: ${pkg.evidence.provenanceConfidence}`,
      ...pkg.evidence.findings.flatMap((f) => [
        `- Tier ${f.tier} at ${f.distanceFt} ft`,
        `    Basis: ${f.basis}`,
        `    Implication: ${f.implication}`,
        `    Valuation may be attempted: ${f.mayValue ? 'yes, under the stated assumptions' : 'no'}`,
      ]),
      pkg.evidence.negativeResultCaveat,
    ],
  });

  sections.push({
    heading: 'ENCUMBERED AREA',
    lines:
      pkg.encumberedArea === null
        ? [
            'No encumbered area is reported. Where the width of an easement is not established ' +
              'by an instrument or a measurement, this package states nothing rather than ' +
              'applying a default width.',
          ]
        : [
            `Area: ${pkg.encumberedArea.areaSqFt.toLocaleString('en-US')} sq ft`,
            pkg.encumberedArea.shareOfParcel === null
              ? 'Share of parcel: not available (parcel area unknown)'
              : `Share of parcel: ${(pkg.encumberedArea.shareOfParcel * 100).toFixed(1)}%`,
            pkg.encumberedArea.derivationNote,
          ],
  });

  sections.push({ heading: 'LAND VALUE', lines: landValueLines(pkg.landValue) });

  sections.push({
    heading: 'CAVEATS AND METHODOLOGY',
    lines: pkg.caveats.flatMap((c) => [c.text, `    [source: ${c.sourceSymbol}]`]),
  });

  const audit: string[] = [
    `Package version: ${pkg.packageVersion}`,
    `Generated: ${pkg.generatedAt}`,
    `Disclaimer version: ${pkg.disclaimerVersion}`,
    `Routing tier: ${pkg.parcel.routingTier}`,
  ];
  if (pkg.attorneyReview !== null) {
    audit.push(
      `Attorney review: ${pkg.attorneyReview.requiredFlow}, status ${pkg.attorneyReview.status}`,
    );
  }
  if (pkg.disclaimerNeedsSignOff) audit.push(NOT_REVIEWED_BY_COUNSEL_LINE);
  audit.push(CURRENT_DISCLAIMER.letterFooterText);
  sections.push({ heading: 'PROVENANCE AND AUDIT', lines: audit });

  return sections;
}

function bannerLines(pkg: ReferralPackage): string[] {
  return pkg.illustrative ? [ILLUSTRATIVE_BANNER, ''] : [];
}

/**
 * Plain text — the canonical form. Pasteable into an email body without
 * markup, following the `letters/letter.ts` precedent of one shape rendered
 * once.
 */
export function renderPlainText(pkg: ReferralPackage): string {
  const body = buildSections(pkg)
    .map((s) => [s.heading, '-'.repeat(s.heading.length), ...s.lines].join('\n'))
    .join('\n\n');
  const text = [...bannerLines(pkg), body].join('\n');
  // Every renderer re-runs the invariant, now with the rendered text so the
  // claim scan applies to what a reader actually sees. A package can arrive
  // here deserialised from a store, where build-time validation never ran.
  assertPackageIntegrity(pkg, text);
  return text;
}

/** Markdown — for printing or attaching. Same sections, same order. */
export function renderMarkdown(pkg: ReferralPackage): string {
  const body = buildSections(pkg)
    .map((s) => `## ${s.heading}\n\n${s.lines.join('\n\n')}`)
    .join('\n\n');
  const banner = pkg.illustrative ? `> **${ILLUSTRATIVE_BANNER}**\n\n` : '';
  const text = `${banner}# Referral package\n\n${body}\n`;
  assertPackageIntegrity(pkg, text);
  return text;
}

/**
 * JSON — the package itself, so a consumer reads the same object the renderers
 * read. `illustrative` is the field the two prose banners are rendered from,
 * so the flag travels with the data rather than only with the presentation.
 */
export function renderJson(pkg: ReferralPackage): string {
  const text = JSON.stringify(pkg, null, 2);
  assertPackageIntegrity(pkg, text);
  return text;
}
