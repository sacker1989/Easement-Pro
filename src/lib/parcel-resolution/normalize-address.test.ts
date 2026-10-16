import { describe, expect, it } from 'vitest';
import { InvalidAddressError, normalizeAddress } from './normalize-address';

describe('normalizeAddress', () => {
  it('trims fields and uppercases the state', () => {
    const result = normalizeAddress({
      street: '  100 Main St  ',
      city: ' Los Angeles ',
      state: ' ca ',
      zip: ' 90012 ',
    });
    expect(result).toEqual({
      street: '100 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90012',
      zipPlus4: null,
    });
  });

  it('splits a ZIP+4 code', () => {
    const result = normalizeAddress({
      street: '100 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90012-1234',
    });
    expect(result.zip).toBe('90012');
    expect(result.zipPlus4).toBe('1234');
  });

  it('carries an explicit county through when provided', () => {
    const result = normalizeAddress({
      street: '100 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90012',
      county: ' Los Angeles ',
    });
    expect(result.county).toBe('Los Angeles');
  });

  it('rejects an empty street', () => {
    expect(() =>
      normalizeAddress({ street: '  ', city: 'LA', state: 'CA', zip: '90012' }),
    ).toThrow(InvalidAddressError);
  });

  it('rejects an unrecognized state code', () => {
    expect(() =>
      normalizeAddress({ street: '100 Main St', city: 'LA', state: 'ZZ', zip: '90012' }),
    ).toThrow(InvalidAddressError);
  });

  it('rejects a malformed ZIP code', () => {
    expect(() =>
      normalizeAddress({ street: '100 Main St', city: 'LA', state: 'CA', zip: '9001' }),
    ).toThrow(InvalidAddressError);
  });
});

describe('the validation messages are written for the reader', () => {
  /*
   * THESE ARE RENDERED VERBATIM. app/report/page.tsx catches
   * InvalidAddressError and puts `err.message` straight into a role="alert",
   * so whatever is written here is what a homeowner reads. They used to say
   * "street is required" and "city is required": lower case, no guidance,
   * written as internal assertions. Every other sentence on that page is
   * written for the reader, and nothing in the type system marked which of
   * these two audiences a message belonged to.
   *
   * These assertions are deliberately about SHAPE rather than exact wording,
   * so the copy can be improved without a test edit, while a regression to
   * an internal assertion fails.
   */
  const messageFor = (over: Record<string, string>) => {
    try {
      normalizeAddress({ street: '1 Main St', city: 'Anaheim', state: 'CA', zip: '92801', ...over });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  for (const [label, over] of [
    ['missing street', { street: '  ' }],
    ['missing city', { city: '' }],
  ] as const) {
    describe(label, () => {
      it('does not read as an internal assertion', () => {
        const m = messageFor(over) ?? '';
        expect(m).not.toMatch(/^\w+ is required$/);
        expect(m).not.toMatch(/\b(field|input|param|validation)\b/i);
      });

      it('is a sentence', () => {
        const m = messageFor(over) ?? '';
        expect(m.length).toBeGreaterThan(30);
        expect(m[0]).toBe(m[0]?.toUpperCase());
        expect(m.trimEnd().endsWith('.')).toBe(true);
      });

      it('says what is missing', () => {
        const m = (messageFor(over) ?? '').toLowerCase();
        expect(m).toMatch(label === 'missing street' ? /street/ : /city/);
      });
    });
  }

  it('explains why the city matters, since a reader may think it redundant', () => {
    expect(messageFor({ city: '' })).toMatch(/repeats across/i);
  });

  it('still throws InvalidAddressError, so callers can branch', () => {
    expect(() => normalizeAddress({ street: '1 Main St', city: '', state: 'CA', zip: '92801' })).toThrow(
      InvalidAddressError,
    );
  });
});
