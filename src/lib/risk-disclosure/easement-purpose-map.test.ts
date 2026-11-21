import { describe, expect, it } from 'vitest';
import {
  conservativelyRestrictedTypes,
  mapEasementTypeToPurpose,
  PURPOSE_BY_EASEMENT_TYPE,
  unreviewedEasementTypes,
} from './easement-purpose-map';
import { buildRestrictionChecklist } from './restriction-checklist';
import { buildRiskDisclosureReport } from './build-risk-disclosure-report';
import { EASEMENT_TYPES, type EasementType } from '@/lib/easements/easement-types';

describe('every easement type is covered, not just the five the UI had', () => {
  it('maps all twelve', () => {
    // Seven of these were previously unreachable from the interface and had no
    // defined behavior anywhere else. A gap that reads as coverage.
    expect(EASEMENT_TYPES).toHaveLength(12);
    for (const type of EASEMENT_TYPES) {
      expect(Object.keys(PURPOSE_BY_EASEMENT_TYPE)).toContain(type);
    }
  });

  it('has no mapping for a type that does not exist', () => {
    // The reverse direction: a stale row left behind after a type is renamed
    // would be dead code that still looks like coverage.
    for (const key of Object.keys(PURPOSE_BY_EASEMENT_TYPE)) {
      expect(EASEMENT_TYPES).toContain(key as EasementType);
    }
  });

  it('gives every type a usable label and a non-trivial note', () => {
    for (const type of EASEMENT_TYPES) {
      const m = mapEasementTypeToPurpose(type);
      expect(m.label.length).toBeGreaterThan(3);
      expect(m.note.length).toBeGreaterThan(40);
    }
  });
});

describe('a full checklist is produced for every type', () => {
  // The user-facing case: pick any easement type, get four activities with a
  // reason attached to each. No type may produce an empty or partial answer.
  for (const type of EASEMENT_TYPES) {
    it(`${type} produces four activities, each with a rationale`, () => {
      const checklist = buildRestrictionChecklist(mapEasementTypeToPurpose(type).purpose);
      expect(checklist).toHaveLength(4);
      expect(checklist.map((c) => c.activity).sort()).toEqual([
        'additions',
        'fencing',
        'landscaping',
        'pool',
      ]);
      for (const item of checklist) {
        expect(item.rationale.length).toBeGreaterThan(20);
        expect(typeof item.restricted).toBe('boolean');
      }
    });
  }

  for (const type of EASEMENT_TYPES) {
    it(`${type} produces a complete report end to end`, () => {
      const report = buildRiskDisclosureReport({
        easementPurpose: mapEasementTypeToPurpose(type).purpose,
        lotAreaSqFt: 8000,
        easementAreaSqFt: 800,
        isLaCounty: false,
        state: 'CA',
      });
      expect(report.restrictionChecklist).toHaveLength(4);
      expect(report.economicImpact.lostBuildableAreaSqFt).toBe(800);
    });
  }
});

describe('the dangerous mappings are the ones to get right', () => {
  it('does NOT treat a pipeline as an ordinary utility', () => {
    // The utility row reports landscaping as generally permitted. Returning
    // that over a high-pressure gas or petroleum transmission line would be
    // the most consequential wrong answer this tool could give.
    const m = mapEasementTypeToPurpose('pipeline');
    expect(m.purpose).not.toBe('utility');
    expect(m.purpose).toBe('unknown');

    const checklist = buildRestrictionChecklist(m.purpose);
    expect(checklist.every((c) => c.restricted)).toBe(true);
    expect(m.note).toMatch(/811/);
    expect(m.note).toMatch(/operator/i);
  });

  it('keeps sewer stricter than generic utility on landscaping', () => {
    // Roots damage the line itself, not merely access to it. Collapsing sewer
    // into utility would tell someone to plant a tree over their lateral.
    const sewer = buildRestrictionChecklist(mapEasementTypeToPurpose('sewer').purpose);
    const utility = buildRestrictionChecklist(mapEasementTypeToPurpose('utility-overhead').purpose);
    const landscapingOf = (c: typeof sewer) => c.find((i) => i.activity === 'landscaping')!.restricted;
    expect(landscapingOf(sewer)).toBe(true);
    expect(landscapingOf(utility)).toBe(false);
  });

  it('routes conservation and prescriptive to the conservative row', () => {
    // A conservation easement restricts the whole parcel by its own terms, and
    // a prescriptive easement has no instrument to read at all. Neither is a
    // strip with a footprint, so the footprint answer would misdescribe them.
    for (const type of ['conservation', 'prescriptive', 'slope'] as const) {
      expect(mapEasementTypeToPurpose(type).purpose).toBe('unknown');
      expect(buildRestrictionChecklist('unknown').every((c) => c.restricted)).toBe(true);
    }
    expect(mapEasementTypeToPurpose('conservation').note).toMatch(/WHOLE parcel/i);
    expect(mapEasementTypeToPurpose('prescriptive').note).toMatch(/no recorded instrument/i);
  });

  it('never silently downgrades an unknown-purpose type to permissive', () => {
    for (const type of conservativelyRestrictedTypes()) {
      const checklist = buildRestrictionChecklist(mapEasementTypeToPurpose(type).purpose);
      expect(checklist.some((c) => !c.restricted)).toBe(false);
    }
  });
});

describe('unreviewed mappings are marked, not hidden', () => {
  it('names exactly the mappings that have not been reviewed', () => {
    // Same posture as CA_DURATION_RULE_SET and compliance-gaps.ts: an
    // engineering judgement is labeled as one.
    expect([...unreviewedEasementTypes()].sort()).toEqual([
      'conservation',
      'pipeline',
      'prescriptive',
      'public-right-of-way',
      'slope',
      // water-line left this list on 2026-11-21, closed against LADWP, San
      // Diego and LVVWD published standards rather than an opinion.
    ]);
  });

  it('says what is still open in every unreviewed note', () => {
    // Broadened from the original phrasing. A note may now record a position
    // that has been taken without yet being qualified review — water-line is
    // the case — so the invariant is that the note names what remains open,
    // not that it uses one particular warning phrase.
    for (const type of unreviewedEasementTypes()) {
      const note = mapEasementTypeToPurpose(type).note;
      expect(note).toMatch(
        /NOT REVIEWED|STILL OPEN|restricted|no .*rules have been researched|contested/i,
      );
    }
  });

  it('marks water-line reviewed, against published utility standards', () => {
    /*
     * FLIPPED 2026-11-21, and the old reasoning was right at the time: a
     * product-owner position is not domain review, and flipping the flag on
     * one would have silenced the user-facing marker on the wrong kind of
     * confirmation.
     *
     * What closed it was published standards rather than an opinion — LADWP's
     * 2025 Design Standards, San Diego's Water Facility Design Guidelines and
     * the Las Vegas Valley Water District easement form all restrict
     * structures, fencing and planting over a main, which is the utility row.
     *
     * The same reading showed the mapping was INCOMPLETE rather than wrong:
     * all three also bar changing grade or depth of cover, which the generic
     * utility row has no cell for. See WATER_LINE_COVER_CONDITION.
     */
    const m = mapEasementTypeToPurpose('water-line');
    expect(m.reviewed).toBe(true);
    expect(m.purpose).toBe('utility');
    expect(m.note).toMatch(/LADWP/);
    expect(m.note).toMatch(/depth of soil over the pipe|depth of cover|grade/i);
    // It must still say the reader's own document can be stricter.
    expect(m.note).toMatch(/control|stricter/i);
  });

  it('keeps reviewed and conservatively-restricted as separate ideas', () => {
    // water-line is unreviewed but still maps to a real row; pipeline maps to
    // `unknown` on purpose because conservative IS the correct answer there.
    // Collapsing the two would lose the distinction between "we have not
    // checked" and "we checked and the answer is: refuse to guess".
    // water-line is now REVIEWED and still maps to a real row, which keeps
    // it a useful contrast: reviewed-and-mapped vs unreviewed-and-refused.
    expect(unreviewedEasementTypes()).not.toContain('water-line');
    expect(conservativelyRestrictedTypes()).not.toContain('water-line');
    expect(unreviewedEasementTypes()).toContain('pipeline');
    expect(conservativelyRestrictedTypes()).toContain('pipeline');
  });
});
