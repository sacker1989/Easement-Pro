/**
 * Address to coordinates, via the US Census geocoder.
 *
 * WHY THIS ONE. It is free, needs no key, covers the whole country and is run
 * by the agency that maintains the address ranges it is built on. Every
 * commercial alternative needs a key, a billing relationship and a licence
 * that usually restricts caching — none of which a free product should take on
 * to answer one question.
 *
 * WHY THE PRODUCT NEEDS COORDINATES AT ALL. Everything geographic beyond the
 * county parcel services wants a point: the FEMA flood layer, and the
 * infrastructure proximity scan when its data problem is solved. County
 * lookups work from an address string and the county resolver works from a ZIP
 * heuristic, so nothing needed a point until now.
 *
 * HOW ACCURATE IT ACTUALLY IS, which matters more here than it usually does.
 * The Census geocoder INTERPOLATES along a street's address range. It is not a
 * rooftop geocoder: the point lands on the street segment at roughly the right
 * position, which can be tens of metres from the building and, on a long rural
 * parcel, considerably more. For a flood zone that is a real limitation — a
 * point near a zone boundary can fall on the wrong side — and it is disclosed
 * rather than buried, because the alternative is a homeowner treating an
 * interpolated point as a survey.
 */

import { createResilientFetch } from '@/lib/net/resilient-fetch';

export const CENSUS_GEOCODER =
  'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

/** The address-range vintage. Pinned so a result is reproducible. */
export const CENSUS_BENCHMARK = 'Public_AR_Current';

export interface GeocodeHit {
  readonly kind: 'matched';
  readonly lat: number;
  readonly lon: number;
  /** The address the geocoder believes it matched, for the user to sanity-check. */
  readonly matchedAddress: string;
  readonly source: string;
  readonly queriedOn: string;
}

export type GeocodeResult =
  | GeocodeHit
  | { readonly kind: 'no-match'; readonly source: string; readonly queriedOn: string }
  | {
      readonly kind: 'lookup-failed';
      readonly reason: string;
      readonly source: string;
      readonly queriedOn: string;
    };

export interface GeocodeQuery {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

let sharedFetch: typeof fetch | null = null;
function defaultFetch(): typeof fetch {
  if (sharedFetch === null) sharedFetch = createResilientFetch() as unknown as typeof fetch;
  return sharedFetch;
}

/**
 * Geocodes a street address.
 *
 * NEVER THROWS FOR AN UPSTREAM PROBLEM, for the reason `lookupFloodZone` does
 * not: the sections that depend on this are additive, and a Census outage must
 * not take down a report that is otherwise complete.
 */
export async function geocodeAddress(query: GeocodeQuery): Promise<GeocodeResult> {
  const now = query.now ?? (() => new Date());
  const queriedOn = now().toISOString().slice(0, 10);
  const doFetch = query.fetchImpl ?? defaultFetch();
  const source = CENSUS_GEOCODER;

  const oneLine = [query.street, query.city, query.state, query.zip]
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .join(', ');

  if (oneLine === '') {
    return { kind: 'no-match', source, queriedOn };
  }

  const params = new URLSearchParams({
    address: oneLine,
    benchmark: CENSUS_BENCHMARK,
    format: 'json',
  });

  try {
    const response = await doFetch(`${source}?${params.toString()}`);
    if (!response.ok) {
      return { kind: 'lookup-failed', reason: `HTTP ${response.status}`, source, queriedOn };
    }

    const payload = (await response.json()) as {
      result?: {
        addressMatches?: Array<{
          matchedAddress?: string;
          coordinates?: { x?: number; y?: number };
        }>;
      };
    };

    const match = payload.result?.addressMatches?.[0];
    const x = match?.coordinates?.x;
    const y = match?.coordinates?.y;

    if (match === undefined || typeof x !== 'number' || typeof y !== 'number') {
      return { kind: 'no-match', source, queriedOn };
    }

    return {
      kind: 'matched',
      // x is LONGITUDE and y is LATITUDE. Swapping them is the classic defect
      // here and it fails silently — a reversed pair is a valid coordinate
      // somewhere else in the world, so the flood lookup returns a confident
      // answer for the wrong place rather than an error.
      lat: y,
      lon: x,
      matchedAddress: match.matchedAddress ?? oneLine,
      source,
      queriedOn,
    };
  } catch (err) {
    return {
      kind: 'lookup-failed',
      reason: err instanceof Error ? err.message : 'Unknown error',
      source,
      queriedOn,
    };
  }
}

/** Shown wherever a geocoded point drives a finding. */
export const GEOCODE_DISCLOSURE =
  'The location was worked out from your address by the US Census geocoder, which interpolates ' +
  'along a street’s address range rather than finding your roof. The point is usually on the ' +
  'street near your property and can be some way from the building, which matters most when a ' +
  'boundary runs nearby. Check that the matched address below is actually yours before relying ' +
  'on anything derived from it.';
