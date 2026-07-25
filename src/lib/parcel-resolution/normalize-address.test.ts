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
