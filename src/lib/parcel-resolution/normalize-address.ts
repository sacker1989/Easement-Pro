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

  if (!street) {
    throw new InvalidAddressError('street is required');
  }
  if (!city) {
    throw new InvalidAddressError('city is required');
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
