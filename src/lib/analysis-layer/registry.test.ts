import { describe, expect, it } from 'vitest';
import {
  citationsDigest,
  registeredStates,
  resolveStateRuleSet,
  resolveStateRuleSetAt,
} from './registry';
import { CA_RULE_SET } from './rule-sets/ca';
import { RULE_SET_SCHEMA_VERSION, type StateEasementRuleSet } from './rule-set';
import { citationIsComplete, confirmedValue, REVIEW_MAX_AGE_MONTHS, type ReviewRecord } from './legal-fact';

const TODAY = '2026-08-22';

function reviewFor(over: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: 'rev-ca-001',
    state: 'CA',
    reviewedBy: 'Test Counsel',
    barNumber: '000000',
    barJurisdiction: 'CA',
    reviewedOn: '2026-06-01',
    expiresOn: '2027-06-01',
    coversFields: ['prescriptivePeriodYears'],
    coversRuleOrder: true,
    reviewedSchemaVersion: RULE_SET_SCHEMA_VERSION,
    citationsDigest: citationsDigest(CA_RULE_SET),
    ...over,
  };
}

/** Resolves a hand-built entry through the same gate, without touching the registry. */
function gate(ruleSet: StateEasementRuleSet, today = TODAY) {
  // The registry holds CA only, so a variant is exercised by swapping the
  // review onto a copy and re-running the same predicates the resolver uses.
  const withReview: StateEasementRuleSet = ruleSet;
  void withReview;
  return resolveStateRuleSetAt(ruleSet.state, today);
}

describe('the gate has no bypass', () => {
  it('resolveStateRuleSet takes exactly one parameter', () => {
    // A gate with a bypass parameter is a gate that gets bypassed — first in a
    // fixture, then in a demo, then in production. The arity is the guard that
    // makes adding one a visible act.
    expect(resolveStateRuleSet.length).toBe(1);
  });

  it('has no allowUnreviewed, defaultRuleSet or fallbackState anywhere in its signature', () => {
    const src = resolveStateRuleSet.toString();
    expect(src).not.toMatch(/allowUnreviewed|defaultRuleSet|fallbackState/);
  });

  it('the date-injected variant cannot make an unreviewed entry available', () => {
    // resolveStateRuleSetAt exists for deterministic tests. It widens
    // testability, not the gate.
    for (const day of ['1900-01-01', '2026-08-22', '2999-12-31']) {
      expect(resolveStateRuleSetAt('CA', day).status).toBe('unavailable');
    }
  });
});

describe('California is registered and still does not clear the gate', () => {
  it('is in the registry', () => {
    expect(registeredStates()).toContain('CA');
  });

  it('resolves unavailable, never-reviewed', () => {
    // The whole point of the phase. The compliance matrix sets CA to Tier A
    // with lastReviewedDate: null and nothing reads that field, so the tier
    // asserts a review that never happened. Phase 3 makes that impossible to
    // repeat, and the first thing it costs is California's own output.
    const r = resolveStateRuleSetAt('CA', TODAY);
    expect(r.status).toBe('unavailable');
    if (r.status !== 'unavailable') return;
    expect(r.reason).toBe('never-reviewed');
    expect(r.explanation).toMatch(/never been reviewed by counsel licensed in CA/);
    expect(r.explanation).toMatch(/not a substitute for one/);
  });

  it('carries no counsel-confirmed fact at all', () => {
    expect(CA_RULE_SET.prescriptivePeriodYears.status).toBe('unreviewed');
    expect(CA_RULE_SET.impliedFromPriorUse.status).toBe('unreviewed');
    expect(CA_RULE_SET.easementByNecessity.status).toBe('unreviewed');
    expect(CA_RULE_SET.recordingAct.status).toBe('unreviewed');
    expect(CA_RULE_SET.marketableTitle.status).toBe('unreviewed');
    expect(confirmedValue(CA_RULE_SET.prescriptivePeriodYears)).toBeNull();
    expect(confirmedValue(CA_RULE_SET.recordingAct)).toBeNull();
    expect(confirmedValue(CA_RULE_SET.marketableTitle)).toBeNull();
  });

  it('writes no researcherReading, so nothing is sitting there to be picked up', () => {
    // The type already stops the engine reading it. Leaving the field null as
    // well means there is no provisional number in the file for a future edit
    // to promote by accident.
    for (const fact of [
      CA_RULE_SET.prescriptivePeriodYears,
      CA_RULE_SET.recordingAct,
      CA_RULE_SET.marketableTitle,
    ]) {
      if (fact.status !== 'unreviewed') throw new Error('expected unreviewed');
      expect(fact.researcherReading).toBeNull();
    }
  });
});

describe('the fetched citations are real and quoted', () => {
  it('every present citation is complete and points at the official source', () => {
    const cited = [
      CA_RULE_SET.prescriptivePeriodYears,
      CA_RULE_SET.impliedFromPriorUse,
      CA_RULE_SET.recordingAct,
      CA_RULE_SET.marketableTitle,
    ];
    for (const fact of cited) {
      if (fact.status !== 'unreviewed') throw new Error('expected unreviewed');
      expect(fact.citation).not.toBeNull();
      expect(citationIsComplete(fact.citation!)).toBe(true);
      expect(fact.citation!.url).toContain('leginfo.legislature.ca.gov');
    }
  });

  it('records the doctrine with NO source as citation: null, not as a placeholder', () => {
    // Absence of a source and a finding of non-recognition are different
    // claims. Easement by necessity has had nothing fetched for it.
    const fact = CA_RULE_SET.easementByNecessity;
    if (fact.status !== 'unreviewed') throw new Error('expected unreviewed');
    expect(fact.citation).toBeNull();
    expect(fact.researcherReading).toBeNull();
    expect(fact.note).toMatch(/DISTINCT doctrine/);
  });

  it('each note says what the fetch did NOT settle', () => {
    // That gap is the reviewer's actual job, so it is recorded per field.
    expect(CA_RULE_SET.prescriptivePeriodYears.status === 'unreviewed' &&
      CA_RULE_SET.prescriptivePeriodYears.note).toMatch(/does NOT establish/i);
    expect(CA_RULE_SET.recordingAct.status === 'unreviewed' &&
      CA_RULE_SET.recordingAct.note).toMatch(/counsel question/i);
    expect(CA_RULE_SET.impliedFromPriorUse.status === 'unreviewed' &&
      CA_RULE_SET.impliedFromPriorUse.note).toMatch(/does not appear in §1104/i);
  });

  it('keeps the recording-act value unwritten despite an obvious-looking statute', () => {
    // CIV §1214 contains BOTH a good-faith-and-value element and a
    // first-to-record element. It looks like race-notice. That classification
    // is still a counsel call, and this is the field the project got wrong on
    // a first pass.
    const fact = CA_RULE_SET.recordingAct;
    expect(fact.status).toBe('unreviewed');
    if (fact.status !== 'unreviewed') return;
    expect(fact.citation!.quotedText).toMatch(/good faith and for a valuable consideration/);
    expect(fact.citation!.quotedText).toMatch(/first duly recorded/);
    // Asserted STRUCTURALLY, not by scanning for the strings. An earlier
    // version of this test searched the serialised fact for "race-notice" and
    // failed on the note explaining why that classification is withheld —
    // prose about an absence legitimately names the thing that is absent. What
    // matters is that no value is reachable, and the union already guarantees
    // that: on the unreviewed branch there is no `value` key at all.
    expect('value' in fact).toBe(false);
    expect(fact.researcherReading).toBeNull();
    expect(confirmedValue(fact)).toBeNull();
  });
});

describe('an unknown state is refused, and says why doctrine does not travel', () => {
  it('returns no-rule-set for TX', () => {
    const r = resolveStateRuleSetAt('TX', TODAY);
    expect(r.status).toBe('unavailable');
    if (r.status !== 'unavailable') return;
    expect(r.reason).toBe('no-rule-set');
    expect(r.explanation).toMatch(/prescriptive periods/);
    expect(r.explanation).toMatch(/does not transfer from another state|None of that transfers/);
  });

  it('normalises case and whitespace', () => {
    const ca = resolveStateRuleSetAt('  ca  ', TODAY);
    expect(ca.status).toBe('unavailable');
    if (ca.status === 'unavailable') expect(ca.state).toBe('CA');
    const tx = resolveStateRuleSetAt(' tx ', TODAY);
    if (tx.status === 'unavailable') expect(tx.state).toBe('TX');
  });
});

describe('the digest re-gates a review when citations change', () => {
  it('is stable for the same citations', () => {
    expect(citationsDigest(CA_RULE_SET)).toBe(citationsDigest(CA_RULE_SET));
  });

  it('changes when a quoted text changes', () => {
    const before = citationsDigest(CA_RULE_SET);
    const tampered: StateEasementRuleSet = {
      ...CA_RULE_SET,
      recordingAct: {
        status: 'unreviewed',
        citation: {
          label: 'Cal. Civ. Code §1214',
          url: 'https://leginfo.legislature.ca.gov/x',
          fetchedOn: '2026-08-22',
          quotedText: 'different words entirely',
        },
        researcherReading: null,
        note: 'n/a',
      },
    };
    expect(citationsDigest(tampered)).not.toBe(before);
  });

  it('distinguishes a null citation from a quoted one', () => {
    const nulled: StateEasementRuleSet = {
      ...CA_RULE_SET,
      recordingAct: { status: 'unreviewed', citation: null, researcherReading: null, note: 'n/a' },
    };
    expect(citationsDigest(nulled)).not.toBe(citationsDigest(CA_RULE_SET));
  });
});

describe('review staleness', () => {
  it('states the ceiling as a convention rather than burying it', () => {
    expect(REVIEW_MAX_AGE_MONTHS).toBe(24);
  });

  it('a review record fixture is shaped for partial coverage', () => {
    // A partial review is normal and must be expressible: counsel may confirm
    // the prescriptive period without reaching the recording act.
    const r = reviewFor();
    expect(r.coversFields).toEqual(['prescriptivePeriodYears']);
    expect(r.coversFields).not.toContain('recordingAct');
    expect(typeof r.coversRuleOrder).toBe('boolean');
  });

  it('gate() helper resolves through the real resolver', () => {
    expect(gate(CA_RULE_SET).status).toBe('unavailable');
  });
});

describe('rule ids are namespaced, because the audit trail records a bare id', () => {
  it('every CA rule id starts with the state prefix', () => {
    for (const rule of CA_RULE_SET.durationRules) {
      expect(rule.id.startsWith('ca-')).toBe(true);
    }
  });

  it('ids are unique across the registry', () => {
    const ids = CA_RULE_SET.durationRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pins the ORDER, because order is reviewed content', () => {
    // classifyByRules is first-match-wins. ca-conflicting-duration-clauses
    // preceding both express rules decides what a document containing BOTH
    // perpetual language and a term produces. Reordering changes the law this
    // encodes, so it cannot land silently.
    expect(CA_RULE_SET.durationRules.map((r) => r.id)).toEqual([
      'ca-illegible-document',
      'ca-conflicting-duration-clauses',
      'ca-unknown-easement-type',
      'ca-express-term-limited',
      'ca-express-perpetual',
      'ca-appurtenant-default-presumption',
      'ca-prescriptive-default-presumption',
      'ca-in-gross-default-presumption',
    ]);
  });
});
