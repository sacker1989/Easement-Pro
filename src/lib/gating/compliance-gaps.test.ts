import { describe, expect, it } from 'vitest';
import { closedGaps, COMPLIANCE_GAPS, gapsAt, hasOpenComplianceGaps , acceptedGaps, unexaminedGaps } from './compliance-gaps';
import { getStateCompliance } from '@/config/state-tiers';
import { evaluateAdvocacyWizardAccess } from './advocacy-wizard-access';

describe('COMPLIANCE_GAPS', () => {
  it('records the CA Track 1 gap while it is open', () => {
    const gap = COMPLIANCE_GAPS.find((g) => g.id === 'CA-TRACK1-UNREVIEWED');
    expect(gap).toBeDefined();
    expect(gap!.owner).toBe('product-and-counsel');
  });

  it('every gap names what would close it and who decides', () => {
    // A marker that does not say how to clear it is a TODO, not a control.
    for (const g of COMPLIANCE_GAPS) {
      expect(g.closedBy.length).toBeGreaterThan(40);
      expect(['product', 'counsel', 'product-and-counsel']).toContain(g.owner);
      expect(g.markedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('ids are unique and greppable', () => {
    const ids = COMPLIANCE_GAPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z0-9-]+$/);
  });

  it('gapsAt finds by location', () => {
    expect(gapsAt('state-tiers.ts').length).toBeGreaterThan(0);
    expect(gapsAt('nowhere-real.ts')).toHaveLength(0);
  });
});

describe('the marked gaps describe reality, not a worry', () => {
  it('CA really is Tier A with no recorded review', () => {
    // If someone records a review, this test fails and the CA-TRACK1-UNREVIEWED
    // marker should be removed in the same change. That coupling is the point:
    // the marker cannot rot into a stale warning about a gap that was closed.
    const ca = getStateCompliance('CA');
    expect(ca.tier).toBe('A');
    expect(ca.lastReviewedDate).toBeNull();
  });

  it('Track 1 really is offered in CA despite that', () => {
    // The gap is that these two facts coexist. Asserting both together is what
    // makes the marker verifiable rather than an opinion.
    const decision = evaluateAdvocacyWizardAccess(getStateCompliance('CA'));
    expect(decision.available).toBe(true);
  });

  it('reports gaps as open', () => {
    expect(hasOpenComplianceGaps()).toBe(true);
  });
});

describe('accepted is a distinct state from closed', () => {
  it('records the screening-bands acceptance with an owner, a date and a trigger', () => {
    // Accepting a risk is an act someone performed on a date. Without those,
    // an accepted gap is indistinguishable from one nobody looked at.
    const gap = COMPLIANCE_GAPS.find((g) => g.id === 'SCREENING-BANDS-UNCITED');
    expect(gap).toBeDefined();
    expect(gap!.riskAccepted).toBeDefined();
    expect(gap!.riskAccepted!.by).toBe('product');
    expect(gap!.riskAccepted!.on).toBe('2026-08-22');
    expect(gap!.riskAccepted!.rationale.length).toBeGreaterThan(80);
  });

  it('revisits on an event rather than a date', () => {
    // A date gets forgotten. "Before any paid tier is sold against the figure"
    // does not.
    const gap = COMPLIANCE_GAPS.find((g) => g.id === 'SCREENING-BANDS-UNCITED')!;
    expect(gap.riskAccepted!.revisitWhen).toMatch(/Not a\s+date — an event/);
  });

  it('still counts an accepted gap as open', () => {
    // The product behaves identically whether a gap was examined or not. What
    // differs is whether anyone looked, which is what the audit trail needs.
    expect(hasOpenComplianceGaps()).toBe(true);
    expect(acceptedGaps().map((g) => g.id).sort()).toEqual([
      // Added 2026-10-04. Free mode lapsed the §6400 basis, so the flow value
      // "licensed-pathway" names a pathway nobody is required to take. The
      // value was retained because it is the conservative option and because
      // changing it is a counsel decision, not an engineering one.
      'CA-FLOW-DESCRIBES-LAPSED-REGIME',
      'LASTREVIEWEDDATE-NOT-ENFORCED',
      'SCREENING-BANDS-UNCITED',
    ]);
    // Three accepted, one closed, so the array is larger than the open set.
    expect(unexaminedGaps().length).toBe(COMPLIANCE_GAPS.length - 3 - closedGaps().length);
  });

  it('leaves the genuinely unexamined gaps unexamined', () => {
    // CA-TRACK1-UNREVIEWED is now the load-bearing one: item 16 accepted
    // operating without the review, which is this gap rather than the
    // date-enforcement one it was recorded against.
    const ids = unexaminedGaps().map((g) => g.id).sort();
    expect(ids).toEqual(['CA-DURATION-RULES-UNREVIEWED', 'CA-TRACK1-UNREVIEWED']);
    // LA-FALLBACK-UNVERIFIED left this list on 2026-10-05 by being ANSWERED,
    // not accepted — the figures were checked against lavote.gov and three of
    // them were wrong. It stays in the array as history.
    expect(closedGaps().map((g) => g.id)).toEqual(['LA-FALLBACK-UNVERIFIED']);
  });
});
