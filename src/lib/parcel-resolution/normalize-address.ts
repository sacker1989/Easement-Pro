import { US_STATE_CODES } from './us-states';
import type { AddressInput, NormalizedAddress } from './types';

export class InvalidAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAddressError';
  }
}

const ZIP_PATTERN = /^(\d{5})(?:-(\d{4}))?$/;

export function normalizeAddress(input: AddressInput): NormalizedAddress {
  const street = input.street.trim();
  const city = input.city.trim();
  const state = input.state.trim().toUpperCase();
  const zipMatch = ZIP_PATTERN.exec(input.zip.trim());

  /*
   * THESE MESSAGES ARE SHOWN TO READERS VERBATIM. The report page renders
   * `err.message` from this error straight into a role="alert", so "city is
   * required" — lower case, no guidance, written as an internal assertion —
   * was what a homeowner saw. Every other sentence on that page is written
   * for them; these were not, and nothing marked the difference.
   *
   * Each one now says what is missing and what to do, and nothing about
   * validation, fields or input. Kept short, because it appears above the
   * form the reader is about to correct.
   */
  if (!street) {
    throw new InvalidAddressError(
      'This needs a street address to look anything up — house number and street name.',
    );
  }
  if (!city) {
    throw new InvalidAddressError(
      'This needs the city as well as the street, because the same street name repeats across ' +
        'a county. Add it and generate the report again.',
    );
  }
  if (!US_STATE_CODES.has(state)) {
    throw new InvalidAddressError(`"${input.state}" is not a recognized US state or DC code`);
  }
  if (!zipMatch) {
    throw new InvalidAddressError(`"${input.zip}" is not a valid US ZIP code`);
  }

  const county = input.county?.trim();

  return {
    street,
    city,
    state,
    zip: zipMatch[1]!,
    zipPlus4: zipMatch[2] ?? null,
    ...(county ? { county } : {}),
  };
}
