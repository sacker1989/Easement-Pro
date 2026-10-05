import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { codeOf } from '@/lib/test-support/source-text';

/**
 * THE PRODUCT HANDS THE USER A DOCUMENT. IT DOES NOT SEND ONE.
 *
 * Product direction, 2026-10-05: "The Track 1 letter should be given to the
 * user, not sent on behalf of the user to any public entities."
 *
 * This was already true and was asserted nowhere for the letters — only the
 * records-request builder carried a guard. Being accidentally true is not the
 * same as being guaranteed, and the gap is one plausible feature away: a
 * "send it for me" button is an obvious thing to want and would quietly
 * convert every disclaimer in the product into a false statement. The letters
 * say the homeowner is the author and sender. That has to stay a fact about
 * the code and not only a sentence in the copy.
 *
 * IT IS ALSO THE LOAD-BEARING FACT UNDER THE §6125 POSTURE. A tool that
 * drafts a document for someone to review, edit and send themselves is in a
 * materially different position from one that corresponds with a utility or
 * an agency on their behalf. The second is an act performed for another
 * person; the first is a document handed over. Which of those the product
 * does should not depend on anybody remembering.
 */

const LETTERS_DIR = join(process.cwd(), 'src', 'lib', 'letters');

const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bfetch\s*\(/, 'fetch('],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnodemailer\b/, 'nodemailer'],
  [/\bsendMail\b/, 'sendMail'],
  [/\baxios\b/, 'axios'],
  [/\bsmtp\b/i, 'smtp'],
  [/require\s*\(\s*['"]node:(http|https|net|dgram)['"]/, 'node network module'],
  [/from\s+['"]node:(http|https|net|dgram)['"]/, 'node network module'],
];

function sourceFiles(): string[] {
  return readdirSync(LETTERS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(LETTERS_DIR, f));
}

describe('nothing in src/lib/letters can transmit', () => {
  it('finds letter builders to check', () => {
    // A guard that silently checks nothing passes forever.
    expect(sourceFiles().length).toBeGreaterThan(1);
  });

  it('contains no network client of any kind', () => {
    for (const file of sourceFiles()) {
      // Comments stripped: this directory's prose discusses sending at length,
      // and a guard that fires on the explanation of the guard is a failure
      // mode this codebase has hit eight times.
      const code = codeOf(file);
      for (const [pattern, label] of FORBIDDEN) {
        expect(pattern.test(code), `${file} contains ${label}`).toBe(false);
      }
    }
  });

  it('exports nothing that reads as a send', () => {
    for (const file of sourceFiles()) {
      const code = codeOf(file);
      expect(code).not.toMatch(/export\s+(async\s+)?function\s+(send|transmit|deliver|mail)\w*/i);
    }
  });
});

describe('the letters say who sends them', () => {
  it('the Track 1 letter tells the recipient the homeowner wrote and sent it', async () => {
    const { buildMaintenanceRequestLetter } = await import('./maintenance-request');
    const { gateWizardField } = await import('@/lib/advocacy-wizard/gate-wizard-field');
    const { resolveAttorneyReviewDecision } = await import('@/lib/compliance/attorney-review');
    const { normalizeAddress } = await import('@/lib/parcel-resolution');

    const letter = buildMaintenanceRequestLetter({
      state: 'CA',
      recipientName: 'Acme Utility Co.',
      senderName: 'Jane Owner',
      propertyAddress: normalizeAddress({
        street: '100 Main St',
        city: 'Beverly Hills',
        state: 'CA',
        zip: '90210',
      }),
      durationGate: gateWizardField('Easement duration', {
        tier: 'clear',
        ruleId: 'ca-express-perpetual',
        value: { basis: 'perpetual-express', summary: 'Expressly perpetual.' },
      }),
      attorneyReviewDecision: resolveAttorneyReviewDecision('licensed-pathway', 'declined'),
      maintenanceDescription: 'clear vegetation',
    });

    const text = JSON.stringify(letter);
    // The sender is the homeowner, by name, and the disclaimer says so. If a
    // transmission feature ever lands, these sentences become untrue and this
    // test is the one that should have stopped it.
    expect(text).toContain('Jane Owner');
    expect(text).toMatch(/prepared by its sender/i);
    expect(text).toMatch(/not written by an attorney/i);
  });
});
