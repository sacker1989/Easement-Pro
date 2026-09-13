import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';
import { buildMaintenanceRequestLetter } from '@/lib/letters/maintenance-request';
import { buildRequestForClarificationLetter } from '@/lib/letters/request-for-clarification';
import { buildReferralPackage, renderPlainText } from '@/lib/handoff';
import { assessEvidenceTier } from '@/lib/easements/evidence-tier';
import { normalizeAddress } from '@/lib/parcel-resolution';
import { gateWizardField } from '@/lib/advocacy-wizard';
import { resolveAttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import type { DurationDetermination } from '@/lib/analysis-layer/duration-basis';

const propertyAddress = normalizeAddress({
  street: '100 Main St',
  city: 'Beverly Hills',
  state: 'CA',
  zip: '90210',
});

const durationGate = gateWizardField<DurationDetermination>('Easement duration', {
  tier: 'clear',
  ruleId: 'ca-express-perpetual',
  value: { basis: 'perpetual-express', summary: 'The document expressly states perpetual.' },
});

/**
 * Every communication provided to the homeowner states it is not legal counsel.
 *
 * The product direction of 2026-08-22 was "any letter OR COMMUNICATION provided
 * to the homeowner". That word is the reason this file exists: the letter is
 * the surface everyone remembers, and the report, the recommendations and the
 * referral package are the ones that get missed. Asserting per-surface is what
 * makes "we put it on the letter" insufficient.
 */

const PARCEL = {
  parcelId: '2004-001-003',
  county: 'Los Angeles County',
  state: 'CA',
  fipsCode: '06037',
  routingTier: 'immediate' as const,
  situsAddress: '8321 FAUST AVE LOS ANGELES CA 91304',
  ownerName: null,
  geometrySource: 'LACounty_Parcel/MapServer/0',
  sourceVerifiedOn: '2026-08-22',
  landClass: null,
  landClassSource: null,
};

function pkg() {
  return buildReferralPackage({
    parcel: PARCEL,
    findings: [assessEvidenceTier(0)],
    evidenceSummary: 'One feature crossing the parcel.',
    fromRecordedEasements: false,
    provenance: { kind: 'user-asserted' },
    encumberedArea: null,
    landValue: null,
    generatedAt: '2026-08-22T00:00:00.000Z',
  });
}

describe('the universal line is carried by every surface', () => {
  it('the maintenance request letter', () => {
    const letter = buildMaintenanceRequestLetter({
      state: 'CA',
      recipientName: 'Acme Utility Co.',
      senderName: 'John Homeowner',
      propertyAddress,
      durationGate,
      attorneyReviewDecision: resolveAttorneyReviewDecision('licensed-pathway', 'declined'),
      maintenanceDescription: 'clear vegetation encroaching on the utility easement',
    });
    expect(letter.footerDisclaimer).toContain(CURRENT_DISCLAIMER.notLegalCounselText);
    expect(letter.footerDisclaimer).toContain(CURRENT_DISCLAIMER.notFromAttorneyText);
  });

  it('the request for clarification letter', () => {
    const letter = buildRequestForClarificationLetter({
      recipientName: 'Jane Neighbor',
      senderName: 'John Homeowner',
      propertyAddress,
      clarificationPoints: [
        { topic: 'Easement duration', question: 'Is this perpetual?', context: 'unclear from the document' },
      ],
    });
    expect(letter.footerDisclaimer).toContain(CURRENT_DISCLAIMER.notLegalCounselText);
    expect(letter.footerDisclaimer).toContain(CURRENT_DISCLAIMER.notFromAttorneyText);
  });

  it('the referral package, in every rendered form', () => {
    const rendered = renderPlainText(pkg());
    expect(rendered).toContain(CURRENT_DISCLAIMER.notLegalCounselText);
    expect(pkg().caveats.map((c) => c.text)).toContain(CURRENT_DISCLAIMER.notLegalCounselText);
  });

  it('the report page — recommendations and the universal line', () => {
    // Source-text, because the page is an async server component that reaches
    // live county services. Weaker technique, honestly the one that runs in CI.
    const page = readFileSync(
      new URL('../../app/report/page.tsx', import.meta.url),
      'utf8',
    );
    expect(page).toContain('CURRENT_DISCLAIMER.notLegalCounselText');
    expect(page).toContain('CURRENT_DISCLAIMER.recommendationsNotOpinionText');
  });
});

describe('the wording says what it needs to say', () => {
  it('names the full set of communications, not just letters', () => {
    const t = CURRENT_DISCLAIMER.notLegalCounselText;
    for (const surface of ['letter', 'report', 'recommendation', 'message']) {
      expect(t.toLowerCase()).toContain(surface);
    }
  });

  it('states no attorney-client relationship is created', () => {
    expect(CURRENT_DISCLAIMER.notLegalCounselText).toMatch(/attorney-client relationship/);
  });

  it('says who CAN advise, not only who cannot', () => {
    // A disclaimer that only closes doors leaves the reader stuck. This one
    // names the next step.
    expect(CURRENT_DISCLAIMER.notLegalCounselText).toMatch(/attorney licensed in your state/);
  });

  it('keeps the letter honest about authorship and authorship alone', () => {
    expect(CURRENT_DISCLAIMER.authorshipText).toMatch(/sent by the property owner/);
    expect(CURRENT_DISCLAIMER.authorshipText).toMatch(/does not represent them/);
  });

  it('frames paid output as recommendations rather than an opinion', () => {
    const t = CURRENT_DISCLAIMER.recommendationsNotOpinionText;
    expect(t).toMatch(/NOT A LEGAL OPINION/);
    expect(t).toMatch(/does not tell you what your rights are/);
  });
});

describe('the version moved, and the gate did not', () => {
  it('is v2 and still unsigned', () => {
    // New wording is not review. needsComplianceSignOff stays true, and the
    // type pins it to the literal `true` so it cannot be flipped casually.
    expect(CURRENT_DISCLAIMER.version).toBe('placeholder-v2');
    expect(CURRENT_DISCLAIMER.needsComplianceSignOff).toBe(true);
  });

  it('records the LDA finding where someone will meet it', () => {
    const src = readFileSync(new URL('./disclaimer-copy.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/6400\(c\)/);
    expect(src).toMatch(/REGISTRATION AND A BOND/);
    expect(src).toMatch(/disclaiming it is what an LDA does/i);
  });
});
