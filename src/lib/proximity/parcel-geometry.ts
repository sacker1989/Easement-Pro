import { createResilientFetch } from '@/lib/net/resilient-fetch';
import type { LngLat } from '@/lib/geo/planar-distance';

/**
 * The parcel's own outline, fetched from the county service that valued it.
 *
 * WHY A SECOND REQUEST. `assessEvidenceTier` will not accept a centroid
 * distance — it says so in its own doc comment, and the reason is that a
 * centroid distance is wrong for any parcel whose radius approaches the
 * search radius. So the infrastructure scan needs the polygon. The valuation
 * query could have carried it by flipping `returnGeometry`, across four
 * providers and seven call sites, putting a new payload and a new failure
 * mode on the one path that already works for every user. This is an
 * addition; it should be able to fail entirely without the valuation
 * noticing, and a separate request is what guarantees that.
 *
 * ESRI RETURNS RINGS IN `geometry.rings`, outer ring first. Only the first is
 * read: a parcel with holes is a parcel with holes, and a doughnut's inner
 * boundary is not where its utility corridor runs.
 */

export type ParcelGeometry =
  | { readonly kind: 'ring'; readonly ring: readonly LngLat[] }
  | { readonly kind: 'unavailable'; readonly reason: string };

export interface ParcelGeometryQuery {
  /** The county layer that produced the valuation. */
  readonly serviceUrl: string;
  /** The county's own identifier field and value, from UnifiedParcelValuation. */
  readonly idQuery: { readonly field: string; readonly value: string };
  readonly fetchImpl?: typeof fetch;
}

let sharedFetch: typeof fetch | null = null;
function defaultFetch(): typeof fetch {
  if (sharedFetch === null) sharedFetch = createResilientFetch() as unknown as typeof fetch;
  return sharedFetch;
}

/**
 * Only digits, letters, hyphens and spaces reach the where clause.
 *
 * Every supported county's identifier is of that shape — AIN 2004001003,
 * AssessmentNo 071-334-14, PIN14_dash 17-16-216-009-0000. Rejecting rather
 * than escaping, because an identifier that does not look like one has not
 * come from a provider and there is nothing to be gained by asking anyway.
 */
function safeIdentifier(value: string): string | null {
  return /^[A-Za-z0-9\- ]{1,32}$/.test(value) ? value : null;
}

/**
 * Fetches the parcel outline in WGS84.
 *
 * NEVER THROWS, and never puts the identifier in a reason string: a parcel
 * number resolves to an address, and the reasons travel into whatever the
 * caller logs.
 */
export async function fetchParcelGeometry(query: ParcelGeometryQuery): Promise<ParcelGeometry> {
  const id = safeIdentifier(query.idQuery.value);
  if (id === null) return { kind: 'unavailable', reason: 'parcel identifier is not well formed' };

  /*
   * THE LAYER URL IS NOT THE QUERY URL, which cost a production bug.
   *
   * `esriServiceUrl` in county-database.ts is the layer — ".../MapServer/0" —
   * because that is what identifies the layer. Esri's query endpoint is that
   * plus "/query". Appending the parameters straight to the layer URL hits
   * the layer's metadata document instead, which answers 200 with no
   * `features` at all, so this returned "no parcel outline" for every parcel
   * in every county.
   *
   * IT PASSED LOCALLY because the live check was written with the query URL
   * typed by hand, and only production used the stored one. Normalising here
   * rather than editing four database entries: the stored value is correct
   * for what it claims to be, and every future caller wanting to query a
   * layer needs the same suffix.
   */
  const queryUrl = query.serviceUrl.replace(/\/+$/, '').endsWith('/query')
    ? query.serviceUrl
    : `${query.serviceUrl.replace(/\/+$/, '')}/query`;

  const params = new URLSearchParams({
    where: `${query.idQuery.field}='${id}'`,
    outFields: query.idQuery.field,
    returnGeometry: 'true',
    // WGS84, so the ring matches OpenStreetMap without reprojection.
    outSR: '4326',
    f: 'json',
  });

  try {
    const response = await (query.fetchImpl ?? defaultFetch())(`${queryUrl}?${params}`);
    if (!response.ok) {
      return { kind: 'unavailable', reason: `county service returned ${response.status}` };
    }

    /*
     * Esri answers errors with HTTP 200 and an {error} body — the trap this
     * codebase has hit enough times to check for by habit.
     */
    const payload = (await response.json()) as {
      error?: unknown;
      features?: ReadonlyArray<{ geometry?: { rings?: ReadonlyArray<ReadonlyArray<readonly number[]>> } }>;
    };
    if (payload.error !== undefined) {
      return { kind: 'unavailable', reason: 'county service reported an error' };
    }

    const rings = payload.features?.[0]?.geometry?.rings;
    const outer = rings?.[0];
    if (!Array.isArray(outer) || outer.length < 4) {
      return { kind: 'unavailable', reason: 'county service returned no parcel outline' };
    }

    const ring = outer
      .filter((p): p is readonly [number, number] => Array.isArray(p) && p.length >= 2)
      .map(([lng, lat]): LngLat => [lng, lat]);

    if (ring.length < 4) {
      return { kind: 'unavailable', reason: 'parcel outline was not usable' };
    }
    return { kind: 'ring', ring };
  } catch {
    return { kind: 'unavailable', reason: 'county service did not respond' };
  }
}
