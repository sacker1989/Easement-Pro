import { describe, expect, it } from 'vitest';
import { analyzeEasementAt } from '../analyze-easement';
import { citationIsComplete, type StateLegalFact } from '../legal-fact';
import { registeredRuleSet, registeredStates, resolveStateRuleSetAt } from '../registry';
import { RULE_SET_SCHEMA_VERSION } from '../rule-set';
import { FL_RULE_SET } from './fl';

const TODAY = '2026-10-04';

const base = {
  easementType: 'appurtenant' as const,
  hasPerpetualLanguage: false,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

const FACTS: ReadonlyArray<readonly [string, StateLegalFact<unknown>]> = [
  ['prescriptivePeriodYears', FL_RULE_SET.prescriptivePeriodYears],
  ['impliedFromPriorUse', FL_RULE_SET.impliedFromPriorUse],
  ['easementByNecessity', FL_RULE_SET.easementByNecessity],
  ['recordingAct', FL_RULE_SET.recordingAct],
  ['marketableTitle', FL_RULE_SET.marketableTitle],
];

describe('FL_RULE_SET', () => {
  it('is registered and carries the current schema version', () => {
    expect(registeredStates()).toContain('FL');
    expect(registeredRuleSet('FL')).toBe(FL_RULE_SET);
    expect(FL_RULE_SET.schemaVersion).toBe(RULE_SET_SCHEMA_VERSION);
  });

  it('resolves unavailable because no Florida attorney has reviewed it', () => {
    const r = resolveStateRuleSetAt('FL', TODAY);
    expect(r.status).toBe('unavailable');
    if (r.status !== 'unavailable') return;
    // never-reviewed, NOT no-rule-set. The distinction is the whole value of
    // adding the entry: the observation rules and the citations exist.
    expect(r.reason).toBe('never-reviewed');
  });

  it('holds every legal fact on the unreviewed branch', () => {
    for (const [name, fact] of FACTS) {
      expect(fact.status, `${name} must stay unreviewed until counsel signs off`).toBe(
        'unreviewed',
      );
    }
  });

  it('quotes a real primary source wherever it claims one', () => {
    for (const [name, fact] of FACTS) {
      if (fact.citation === null) continue;
      expect(citationIsComplete(fact.citation), `${name} citation is incomplete`).toBe(true);
      expect(fact.citation.label, `${name} must cite Florida, not a neighbour`).toMatch(
        /^Fla\. Stat\./,
      );
    }
  });

  describe('the fields where Florida contradicts California', () => {
    it('offers no prescriptive period, because §95.18 is adverse possession', () => {
      // THE LOAD-BEARING ASSERTION IN THIS FILE. Fla. Stat. §95.18 states
      // "7 years" and sits one fetch away, so the tempting edit is to put 7
      // here. Do not. §95.18 conditions the claim on paying all outstanding
      // taxes within a year of entry and filing a return with the property
      // appraiser — the acts of someone claiming to OWN the land. A
      // prescriptive-easement claimant concedes the neighbour owns it and has
      // never paid those taxes, so importing the element set with the number
      // would make the doctrine unsatisfiable rather than merely mis-timed.
      // Only Florida counsel closes this, and the fix is a citation, not a 7.
      expect(FL_RULE_SET.prescriptivePeriodYears.status).toBe('unreviewed');
      if (FL_RULE_SET.prescriptivePeriodYears.status !== 'unreviewed') return;
      expect(FL_RULE_SET.prescriptivePeriodYears.researcherReading).toBeNull();
    });

    it('reads as notice, where California\'s §1214 carries a race-notice marker', () => {
      const fact = FL_RULE_SET.recordingAct;
      if (fact.status !== 'unreviewed') throw new Error('expected unreviewed');
      expect(fact.researcherReading).toBe('notice');
      // The structural difference, asserted against the fetched words rather
      // than against the conclusion: §695.01(1) has no "first duly recorded"
      // clause attaching to the subsequent purchaser. If that phrase ever
      // appears in this quote, the notice reading is no longer supportable.
      expect(fact.citation?.quotedText).toContain('without notice');
      expect(fact.citation?.quotedText).not.toContain('first duly recorded');
    });

    it('excepts easements from MRTA, the opposite of the California reading', () => {
      const fact = FL_RULE_SET.marketableTitle;
      if (fact.status !== 'unreviewed') throw new Error('expected unreviewed');
      expect(fact.researcherReading).toEqual({
        actExists: true,
        rootOfTitleYears: 30,
        easementsExcepted: true,
      });
      // The exception is conditional on use, and that condition is the case a
      // homeowner most often asks about. It must survive in the quoted text,
      // not only in the note.
      expect(fact.citation?.quotedText).toContain('so long as the same are used');
    });

    it('answers necessity from statute and prior use not at all', () => {
      // Exactly inverted from California, which codifies prior use (Civ. Code
      // §1104) and has no fetched source for necessity. Together the two
      // entries are the evidence that merging the fields would have produced
      // something that looked complete in both states and was half-answered in
      // each, from different halves.
      const necessity = FL_RULE_SET.easementByNecessity;
      const priorUse = FL_RULE_SET.impliedFromPriorUse;
      if (necessity.status !== 'unreviewed' || priorUse.status !== 'unreviewed') {
        throw new Error('expected unreviewed');
      }
      expect(necessity.citation?.label).toContain('704.01');
      expect(necessity.researcherReading).toEqual({
        recognised: true,
        necessityStandard: 'reasonable',
      });
      expect(priorUse.citation).toBeNull();
      expect(priorUse.researcherReading).toBeNull();
      // §704.01 must not be reused as the source for the quasi-easement. It is
      // the adjacent-subsection trap the rule-set header warns about, and in
      // Florida it is one line away.
      expect(JSON.stringify(priorUse)).not.toContain('704.01(1)');
    });
  });

  describe('duration rules', () => {
    it('ships observation rules only, deliberately', () => {
      // If this fails, a Florida doctrinal presumption has been added. That
      // may well be right — but it must arrive WITH a fetched Florida citation
      // on the fact it rests on, and whoever adds it should read the header of
      // this rule set first. California's three presumptions are not Florida's
      // and copying them across is the specific thing this guards.
      expect(FL_RULE_SET.durationRules.every((r) => r.claimType === 'observation')).toBe(true);
      expect(FL_RULE_SET.durationRules.map((r) => r.id)).toEqual([
        'fl-illegible-document',
        'fl-conflicting-duration-clauses',
        'fl-unknown-easement-type',
        'fl-express-term-limited',
        'fl-express-perpetual',
      ]);
    });

    it('answers a Florida homeowner whose document says perpetual', () => {
      const r = analyzeEasementAt(
        { state: 'FL', duration: { ...base, hasPerpetualLanguage: true } },
        TODAY,
      );
      expect(r.duration).toMatchObject({ tier: 'clear', ruleId: 'fl-express-perpetual' });
      expect(r.firedRule).toEqual({ id: 'fl-express-perpetual', claimType: 'observation' });
      // The rule ran even though the rule set is unavailable. That is the
      // point of the observation/doctrine split.
      expect(r.ruleSet.status).toBe('unavailable');
    });

    it('refuses the question when the answer depends on Florida doctrine', () => {
      const r = analyzeEasementAt({ state: 'FL', duration: base }, TODAY);
      expect(r.duration.tier).toBe('flagged-ambiguous');
      expect(r.firedRule).toBeNull();
      if (r.duration.tier !== 'flagged-ambiguous') return;
      expect(r.duration.flagReason).toContain('absence of');
    });
  });
});

describe('every registered state, not just Florida', () => {
  it('never marks a fact counsel-confirmed without a review record behind it', () => {
    // CURRENTLY VACUOUS — no state has a confirmed fact, so this passes
    // without exercising anything. It is here for the day one does, which is
    // the day the mistake becomes possible and the day nobody will be looking
    // for it.
    for (const state of registeredStates()) {
      const rs = registeredRuleSet(state);
      if (rs === undefined) throw new Error(`${state} is listed but not resolvable`);
      const facts: ReadonlyArray<StateLegalFact<unknown>> = [
        rs.prescriptivePeriodYears,
        rs.impliedFromPriorUse,
        rs.easementByNecessity,
        rs.recordingAct,
        rs.marketableTitle,
      ];
      for (const fact of facts) {
        if (fact.status !== 'counsel-confirmed') continue;
        expect(rs.review, `${state} has a confirmed fact and no review`).not.toBeNull();
        expect(fact.confirmedByReviewId).toBe(rs.review?.id);
        expect(citationIsComplete(fact.citation)).toBe(true);
      }
    }
  });

  it('gives each state its own rule ids', () => {
    const seen = new Map<string, string>();
    for (const state of registeredStates()) {
      for (const rule of registeredRuleSet(state)?.durationRules ?? []) {
        expect(seen.has(rule.id), `${rule.id} is claimed by ${seen.get(rule.id)} and ${state}`).toBe(
          false,
        );
        seen.set(rule.id, state);
      }
    }
  });
});
