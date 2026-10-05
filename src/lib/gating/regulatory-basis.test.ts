import { describe, expect, it } from 'vitest';
import { getStateCompliance, STATE_COMPLIANCE_MATRIX } from '@/config/state-tiers';
import { COMMERCE_ENABLED } from '@/lib/compliance/commerce-mode';
import {
  basisFullyLapsed,
  basisSummary,
  lapsedBases,
  operativeBases,
  stillReaches,
  type RegulatoryBasis,
} from './regulatory-basis';

const withCompensation: RegulatoryBasis = {
  citation: 'Test Code §1',
  regime: 'document-assistant',
  compensationIsAnElement: true,
  hasCompliancePath: true,
  note: 'fixture',
};

const withoutCompensation: RegulatoryBasis = {
  citation: 'Test Code §2',
  regime: 'unauthorized-practice',
  compensationIsAnElement: false,
  hasCompliancePath: false,
  note: 'fixture',
};

describe('stillReaches', () => {
  it('drops a compensation-element statute only when nothing is charged', () => {
    expect(stillReaches(withCompensation, false)).toBe(false);
    expect(stillReaches(withCompensation, true)).toBe(true);
  });

  it('keeps a statute with no compensation element either way', () => {
    // The whole asymmetry free mode turns on. If this ever returns false for
    // commerceEnabled=false, going free would read as closing a UPL question,
    // which is exactly the misreading regulatory-basis.ts exists to prevent.
    expect(stillReaches(withoutCompensation, false)).toBe(true);
    expect(stillReaches(withoutCompensation, true)).toBe(true);
  });
});

describe('partitioning bases by what still governs', () => {
  const bases = [withCompensation, withoutCompensation];

  it('splits them on commerce mode', () => {
    expect(operativeBases(bases, false)).toEqual([withoutCompensation]);
    expect(lapsedBases(bases, false)).toEqual([withCompensation]);
    expect(operativeBases(bases, true)).toEqual(bases);
    expect(lapsedBases(bases, true)).toEqual([]);
  });

  it('reports fully-lapsed only when nothing is left', () => {
    expect(basisFullyLapsed(bases, false)).toBe(false);
    expect(basisFullyLapsed([withCompensation], false)).toBe(true);
    // Null and empty are "no basis stated", which is a different condition
    // from "every stated basis lapsed" and must not report as the latter.
    expect(basisFullyLapsed(null, false)).toBe(false);
    expect(basisFullyLapsed([], false)).toBe(false);
  });
});

describe('basisSummary, which is what lands in the audit record', () => {
  it('names each statute and whether it was operative at the time', () => {
    const s = basisSummary([withCompensation, withoutCompensation], false);
    expect(s).toContain('Test Code §1');
    expect(s).toContain('Test Code §2');
    // The record must distinguish them. A summary listing both citations
    // without saying which one governed would be worse than the old string.
    expect(s).toContain('not operative');
    expect(s).toContain('; operative]');
  });

  it('returns null when no basis is stated', () => {
    expect(basisSummary(null, false)).toBeNull();
    expect(basisSummary([], false)).toBeNull();
  });
});

describe('the real California entry', () => {
  const ca = STATE_COMPLIANCE_MATRIX.CA!;

  it('records both regimes, not just the one it was written against', () => {
    // The original entry named §6400 alone. That was the defect: a reader
    // concluded California's Track 1 question was an LDA-registration
    // question, and it never only was.
    const citations = (ca.basis ?? []).map((b) => b.citation);
    expect(citations.some((c) => c.includes('§6400'))).toBe(true);
    expect(citations.some((c) => c.includes('§6125'))).toBe(true);
  });

  it('models §6400 as having a compensation element and §6125 as not', () => {
    const lda = ca.basis!.find((b) => b.citation.includes('§6400'))!;
    const upl = ca.basis!.find((b) => b.citation.includes('§6125'))!;
    expect(lda.compensationIsAnElement).toBe(true);
    expect(upl.compensationIsAnElement).toBe(false);
    // The field that matters more than it looks: the lapsed regime is the one
    // you could comply with. Losing this would make "exposure went down" read
    // as "the hard part is handled".
    expect(lda.hasCompliancePath).toBe(true);
    expect(upl.hasCompliancePath).toBe(false);
  });

  it('leaves exactly the UPL basis operative while the product is free', () => {
    expect(COMMERCE_ENABLED).toBe(false);
    const operative = operativeBases(ca.basis!, COMMERCE_ENABLED);
    expect(operative.map((b) => b.citation)).toEqual(['Cal. Bus. & Prof. Code §6125']);
    // NOT fully lapsed. California's tier still has a stated reason; it is
    // just no longer the reason that was written down first.
    expect(basisFullyLapsed(ca.basis, COMMERCE_ENABLED)).toBe(false);
  });

  it('would bring §6400 back the moment commerce is re-enabled', () => {
    // No edit to this entry required, which is the point of modelling the
    // element rather than hand-marking a basis as lapsed.
    expect(operativeBases(ca.basis!, true)).toHaveLength(2);
  });

  it('gives an unclassified state no basis at all', () => {
    const entry = getStateCompliance('WY');
    expect(entry.basis).toBeNull();
    // Absence of a basis is not a lapsed basis. A state nobody has looked at
    // and a state whose statute stopped applying are different facts.
    expect(basisFullyLapsed(entry.basis, COMMERCE_ENABLED)).toBe(false);
  });
});
