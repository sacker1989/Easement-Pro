import { describe, expect, it } from 'vitest';
import {
  explainClaimScan,
  FORBIDDEN_CLAIM_PATTERNS,
  REQUIRED_DISCLAIMER_PHRASE,
  scanForAppraisalClaims,
} from './appraisal-claim-scan';
import { YELLOW_BOOK_4_6_5 } from '@/lib/valuation/encumbrance-factors';
import { BEFORE_AND_AFTER_METHODOLOGY_NOTE } from '@/lib/valuation/encumbrance-factors';

const CLEAN = `This package is a screening summary and is not an appraisal.
It cites the ${YELLOW_BOOK_4_6_5.citation}
A licensed appraiser is required for a before and after appraisal of this property.`;

describe('positive control — injected claims ARE caught', () => {
  it('catches an assertion that the document is an appraisal', () => {
    const r = scanForAppraisalClaims(`${CLEAN}\nThis report is an appraisal of the parcel.`);
    expect(r.ok).toBe(false);
    expect(r.violations).toContain('asserts the document is an appraisal');
  });

  it('catches appraised value, certified appraisal and USPAP claims', () => {
    for (const bad of [
      'The appraised value is $50,000.',
      'A certified appraisal is enclosed.',
      'This is a USPAP-compliant document.',
    ]) {
      expect(scanForAppraisalClaims(`${CLEAN}\n${bad}`).ok).toBe(false);
    }
  });

  it('catches an asserted easement value', () => {
    expect(scanForAppraisalClaims(`${CLEAN}\nThe market value of the easement is $3,775.`).ok).toBe(
      false,
    );
    expect(scanForAppraisalClaims(`${CLEAN}\nThe easement is worth $3,775.`).ok).toBe(false);
  });

  it('catches compensation stated as owed', () => {
    // The package may say an owner MAY be owed compensation. It may not say
    // they ARE.
    expect(scanForAppraisalClaims(`${CLEAN}\nYou are owed $3,775 for this easement.`).ok).toBe(
      false,
    );
  });

  it('catches an offered opinion of value', () => {
    expect(scanForAppraisalClaims(`${CLEAN}\nOur opinion of market value follows.`).ok).toBe(false);
  });
});

describe('false-positive control — the citations must NOT trip it', () => {
  it('permits the standard by name', () => {
    // A word ban on "appraisal" would fire here and pressure someone into
    // deleting the citation, which is the opposite of the goal.
    expect(scanForAppraisalClaims(CLEAN).ok).toBe(true);
  });

  it('permits the repo methodology note verbatim', () => {
    const text = `${BEFORE_AND_AFTER_METHODOLOGY_NOTE}\nThis package is not an appraisal.`;
    expect(scanForAppraisalClaims(text).ok).toBe(true);
  });

  it('permits saying a licensed appraiser is required', () => {
    const text = 'A licensed appraiser must perform this. This document is not an appraisal.';
    expect(scanForAppraisalClaims(text).ok).toBe(true);
  });

  it('permits the phrase "before and after appraisal method"', () => {
    const text =
      'The correct measure is the accepted before and after appraisal method. ' +
      'This summary is not an appraisal.';
    expect(scanForAppraisalClaims(text).ok).toBe(true);
  });
});

describe('the required affirmative', () => {
  it('fails a package that merely avoids claiming, without disclaiming', () => {
    // Silence is not neutral: a reader not told otherwise will assume.
    const r = scanForAppraisalClaims('Encumbered area is 1,204 square feet.');
    expect(r.ok).toBe(false);
    expect(r.hasRequiredDisclaimer).toBe(false);
    expect(r.violations).toHaveLength(0);
  });

  it('explains what to do about it', () => {
    const r = scanForAppraisalClaims('Nothing here.');
    expect(explainClaimScan(r)).toMatch(REQUIRED_DISCLAIMER_PHRASE);
    expect(explainClaimScan(r)).toMatch(/Saying nothing is not neutral/);
  });
});

describe('pattern hygiene', () => {
  it('names every pattern so a failure is actionable', () => {
    for (const p of FORBIDDEN_CLAIM_PATTERNS) {
      expect(p.name.length).toBeGreaterThan(10);
      expect(p.pattern).toBeInstanceOf(RegExp);
    }
  });

  it('no pattern matches the bare word appraisal', () => {
    // The guard against the guard: if any pattern degenerates into a word ban,
    // this fails.
    for (const p of FORBIDDEN_CLAIM_PATTERNS) {
      expect(p.pattern.test('appraisal')).toBe(false);
      expect(p.pattern.test('Uniform Appraisal Standards')).toBe(false);
    }
  });
});
