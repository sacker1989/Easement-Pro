import { describe, expect, it } from 'vitest';
import { InvalidAddressError } from './normalize-address';
import type { ParcelLookupProvider } from './parcel-lookup-provider';
import { resolveAddress } from './resolve-address';

describe('resolveAddress', () => {
  it('routes an LA County CA address to the LA County fallback', async () => {
    const result = await resolveAddress({
      street: '100 Main St',
      city: 'Beverly Hills',
      state: 'CA',
      zip: '90210',
    });

    expect(result.kind).toBe('la-county-fallback');
    if (result.kind === 'la-county-fallback') {
      expect(result.county).toBe('Los Angeles');
      expect(result.fallback.copyFeeSchedule.certifiedFirstPage).toBe(6);
    }
    expect(result.stateCompliance.tier).toBe('A');
  });

  it('routes a non-LA CA address to the general fallback, routed to Track 3', async () => {
    const result = await resolveAddress({
      street: '1 Market St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94103',
    });

    expect(result.kind).toBe('general-fallback');
    if (result.kind === 'general-fallback') {
      expect(result.guidance.routeTo).toBe('track-3');
    }
    expect(result.stateCompliance.tier).toBe('A');
  });

  it('routes an out-of-state address to general fallback with Track 1 unavailable', async () => {
    const result = await resolveAddress({
      street: '500 Congress Ave',
      city: 'Austin',
      state: 'TX',
      zip: '75201',
    });

    expect(result.kind).toBe('general-fallback');
    expect(result.stateCompliance.tier).toBe('UNCLASSIFIED');
    expect(result.stateCompliance.track1RequiredFlow).toBe('unavailable');
  });

  it('returns document-found when a parcel provider produces a hit', async () => {
    const mockProvider: ParcelLookupProvider = {
      name: 'mock-vendor',
      async lookup(address) {
        return {
          apn: '1234-567-890',
          county: 'Los Angeles',
          state: address.state,
          source: 'mock-vendor',
        };
      },
    };

    const result = await resolveAddress(
      { street: '100 Main St', city: 'Beverly Hills', state: 'CA', zip: '90210' },
      { parcelLookupProvider: mockProvider },
    );

    expect(result.kind).toBe('document-found');
    if (result.kind === 'document-found') {
      expect(result.parcel.apn).toBe('1234-567-890');
      expect(result.parcel.source).toBe('mock-vendor');
    }
  });

  it('propagates InvalidAddressError for malformed input', async () => {
    await expect(
      resolveAddress({ street: '', city: 'LA', state: 'CA', zip: '90012' }),
    ).rejects.toThrow(InvalidAddressError);
  });
});
