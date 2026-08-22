import { describe, expect, it } from 'vitest';
import { APPROVED_COPY, MARKETING_DISCLOSURE, PROHIBITED_COPY } from './ad-copy';
import {
  REQUIRED_DISCLAIMER_PHRASE,
  scanForAppraisalClaims,
} from '@/lib/handoff/appraisal-claim-scan';

describe('approved copy survives the same scan the product runs', () => {
  for (const line of APPROVED_COPY) {
    it(`clean: "${line.slice(0, 48)}…"`, () => {
      // Scanned with the disclosure appended, because that is how it ships —
      // the scan requires the affirmative, not merely the absence of a claim.
      const result = scanForAppraisalClaims(`${line} ${MARKETING_DISCLOSURE}`);
      expect(result.violations).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }
});

describe('prohibited copy is caught, every line', () => {
  for (const claim of PROHIBITED_COPY) {
    it(`caught: "${claim.text.slice(0, 48)}…"`, () => {
      // Appending the disclosure too. A prohibited claim must fail even when
      // the page also carries the disclaimer — "not an appraisal" at the
      // bottom does not license "find out what it's worth" at the top.
      const result = scanForAppraisalClaims(`${claim.text} ${MARKETING_DISCLOSURE}`);
      expect(result.ok).toBe(false);
    });
  }

  it('records why each one is prohibited, not just that it is', () => {
    // A bare blocklist gets relitigated by whoever finds a variant that "isn't
    // quite the same". The reason is what makes the variant obviously the same.
    for (const claim of PROHIBITED_COPY) {
      expect(claim.why.length).toBeGreaterThan(30);
    }
  });
});

describe('the disclosure does its job', () => {
  it('contains the required phrase verbatim', () => {
    expect(MARKETING_DISCLOSURE.toLowerCase()).toContain(REQUIRED_DISCLAIMER_PHRASE);
  });

  it('is itself clean', () => {
    // It says "does not estimate the market value" — close enough to a
    // forbidden pattern that it is worth asserting the negation guards hold.
    expect(scanForAppraisalClaims(MARKETING_DISCLOSURE).ok).toBe(true);
  });

  it('fails the scan when omitted, so silence is not an option', () => {
    // Copy that merely avoids claiming, without disclaiming, does not pass.
    expect(scanForAppraisalClaims(APPROVED_COPY[0]!).ok).toBe(false);
  });
});

describe('the highest-converting sentence is the one we may not use', () => {
  it('is prohibited, and stays prohibited', () => {
    // Recorded as a test because commercial pressure toward this exact
    // sentence is permanent. Deleting it from the list should require
    // deleting a test that says why.
    const worth = PROHIBITED_COPY.find((c) => /what your easement is worth/i.test(c.text));
    expect(worth).toBeDefined();
    expect(worth!.why).toMatch(/4\.6\.5/);
    expect(scanForAppraisalClaims(`${worth!.text} ${MARKETING_DISCLOSURE}`).ok).toBe(false);
  });
});
