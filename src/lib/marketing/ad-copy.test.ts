import { describe, expect, it } from 'vitest';
import {
  APPROVED_COPY,
  COPY_APPROVED_IN_STATES,
  copyApprovedIn,
  MARKETING_DISCLOSURE,
  PROHIBITED_COPY,
} from './ad-copy';
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

describe('the entitlement framing survives; the claim it was offered to rescue does not', () => {
  it('carries the substantiated version of "you are entitled to know"', () => {
    // The position offered on item 10 was that a disclaimer covers valuation
    // claims because the figures are assumptions the homeowner is entitled to
    // learn about. The entitlement half is true, appealing, and describes what
    // the product actually does, so it is approved copy.
    const joined = APPROVED_COPY.join(' ');
    expect(joined).toMatch(/right to see what the public record says/);
    expect(joined).toMatch(/assumptions built from public records/);
  });

  it('still refuses the valuation claim the disclaimer was offered to rescue', () => {
    // A disclaimer that contradicts the headline does not cure the headline,
    // the claim is unsubstantiated rather than under-disclaimed, and appraisal
    // is a licensed activity. Three separate reasons, each sufficient.
    const worth = PROHIBITED_COPY.find((c) => /what your easement is worth/i.test(c.text))!;
    expect(scanForAppraisalClaims(`${worth.text} ${MARKETING_DISCLOSURE}`).ok).toBe(false);
  });

  it('says in the disclosure that a figure is an assumption, not a fact', () => {
    expect(MARKETING_DISCLOSURE).toMatch(/assumption derived from published records/);
    expect(MARKETING_DISCLOSURE).toMatch(/not a statement of fact about the value of your easement/);
  });

  it('records approval per state, and no state has cleared', () => {
    // "Likely varies by state" is right, which is why this is a list rather
    // than a boolean. Empty is the honest state.
    expect(COPY_APPROVED_IN_STATES).toEqual([]);
    for (const s of ['CA', 'FL', 'TX', 'PA']) {
      expect(copyApprovedIn(s)).toBe(false);
    }
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
