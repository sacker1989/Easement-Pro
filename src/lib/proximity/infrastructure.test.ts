import { describe, expect, it } from 'vitest';
import { lookupInfrastructure, DEFAULT_SCAN_RADIUS_FT } from './infrastructure';
import { assessParcelInfrastructure, COVERAGE_CAVEAT } from './parcel-infrastructure';
import type { LngLat } from '@/lib/geo/planar-distance';

/**
 * Real parcel ring: AIN 2004001003, 8321 Faust Ave, fetched live from the LA
 * County service with returnGeometry=true.
 */
const FAUST_RING: readonly LngLat[] = [
  [-118.62043438906645, 34.220139162531154],
  [-118.6209272554045, 34.22013149577303],
  [-118.62091787409204, 34.2199082033365],
  [-118.62042500775399, 34.21991587009462],
  [-118.62043438906645, 34.220139162531154],
];

/**
 * The Overpass envelope, captured verbatim from a live GET that returned no
 * matches. The ELEMENTS below follow Overpass's documented `out geom` shape —
 * ways carry `geometry: [{lat, lon}]`, nodes carry `lat`/`lon` directly.
 *
 * STATED PLAINLY: the non-empty elements are constructed to that shape rather
 * than captured, because all three Overpass endpoints — the main one and both
 * mirrors — were returning dispatcher errors while this was written. The
 * empty-result envelope and the error behaviour below are real; the populated
 * payload is shaped from the documented contract. Worth re-capturing against
 * a live response when the service recovers.
 */
function overpass(elements: unknown[]): Response {
  return new Response(
    JSON.stringify({
      version: 0.6,
      generator: 'Overpass API 0.7.62.11 87bfad18',
      osm3s: { timestamp_osm_base: '2026-10-13T20:45:00Z', copyright: 'ODbL' },
      elements,
    }),
    { status: 200 },
  );
}

const stub = (body: () => Response): typeof fetch => (async () => body()) as unknown as typeof fetch;

describe('reading infrastructure from OpenStreetMap', () => {
  it('classifies the feature types that imply a utility corridor', async () => {
    const result = await lookupInfrastructure({
      lat: 34.2201,
      lon: -118.6204,
      today: '2026-10-13',
      fetchImpl: stub(() =>
        overpass([
          {
            type: 'way',
            tags: { power: 'minor_line', operator: 'Los Angeles Department of Water and Power' },
            geometry: [
              { lat: 34.22002, lon: -118.6215 },
              { lat: 34.22002, lon: -118.62 },
            ],
          },
          { type: 'node', tags: { power: 'pole' }, lat: 34.21995, lon: -118.6206 },
          { type: 'way', tags: { man_made: 'pipeline', substance: 'gas' }, geometry: [{ lat: 34.2215, lon: -118.6204 }] },
        ]),
      ),
    });

    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.features.map((f) => f.label)).toEqual([
      'overhead power distribution line',
      'utility pole',
      'gas pipeline',
    ]);
    expect(result.features[0]!.operator).toBe('Los Angeles Department of Water and Power');
    expect(result.features[1]!.operator).toBeNull();
  });

  it('ignores everything that is not a utility corridor', async () => {
    /*
     * A road beside a house is not evidence of a utility easement, and
     * including roads and buildings would bury the signal while making every
     * query slower. The query is narrow; this asserts the parser is too.
     */
    const result = await lookupInfrastructure({
      lat: 34.22,
      lon: -118.62,
      fetchImpl: stub(() =>
        overpass([
          { type: 'way', tags: { highway: 'residential' }, geometry: [{ lat: 34.22, lon: -118.62 }] },
          { type: 'way', tags: { building: 'house' }, geometry: [{ lat: 34.22, lon: -118.62 }] },
        ]),
      ),
    });
    expect(result.kind).toBe('none-mapped');
  });

  it('treats an HTML error page served as 200 as a failure', async () => {
    /*
     * Overpass answers an overloaded dispatcher with HTTP 200 and an HTML
     * error page — observed live, repeatedly, across the main endpoint and
     * both mirrors. Exactly the trap the Esri services set by returning 200
     * with an {error} body, and the reason this parses rather than trusting
     * the status.
     */
    const result = await lookupInfrastructure({
      lat: 34.22,
      lon: -118.62,
      fetchImpl: stub(() => new Response('<html><p>Error: dispatcher</p></html>', { status: 200 })),
    });
    expect(result.kind).toBe('lookup-failed');
    if (result.kind !== 'lookup-failed') return;
    expect(result.reason).toMatch(/non-JSON/);
  });

  it('never throws, and never puts coordinates in the reason', async () => {
    /*
     * The query URL contains the parcel's latitude and longitude. An error
     * message quoting it would put a location into whatever log the caller
     * keeps — the same mistake outcome-log.ts prevents structurally.
     */
    const thrower = (async () => {
      throw new TypeError('socket hang up to https://overpass-api.de/?data=...34.2201,-118.6204');
    }) as unknown as typeof fetch;
    const result = await lookupInfrastructure({ lat: 34.2201, lon: -118.6204, fetchImpl: thrower });
    expect(result.kind).toBe('lookup-failed');
    if (result.kind !== 'lookup-failed') return;
    expect(result.reason).not.toContain('34.2201');
    expect(result.reason).not.toContain('118.6204');
  });

  it('reports a non-200 as a failure rather than as nothing found', async () => {
    const result = await lookupInfrastructure({
      lat: 34.22,
      lon: -118.62,
      fetchImpl: stub(() => new Response('rate limited', { status: 429 })),
    });
    expect(result.kind).toBe('lookup-failed');
  });
});

describe('tiering features against the parcel boundary', () => {
  async function scan(elements: unknown[]) {
    const lookup = await lookupInfrastructure({
      lat: 34.2201,
      lon: -118.6204,
      today: '2026-10-13',
      fetchImpl: stub(() => overpass(elements)),
    });
    return assessParcelInfrastructure(lookup, FAUST_RING);
  }

  it('grades a line crossing the parcel as tier A', async () => {
    const result = await scan([
      {
        type: 'way',
        tags: { power: 'line' },
        geometry: [
          { lat: 34.22002, lon: -118.6215 },
          { lat: 34.22002, lon: -118.62 },
        ],
      },
    ]);
    expect(result.kind).toBe('assessed');
    if (result.kind !== 'assessed') return;
    expect(result.findings[0]!.assessment.tier).toBe('A');
    expect(result.findings[0]!.assessment.distanceFt).toBe(0);
    expect(result.findings[0]!.assessment.mayValue).toBe(true);
  });

  it('grades a distant feature as tier C and says it implies nothing', async () => {
    const result = await scan([
      { type: 'node', tags: { power: 'pole' }, lat: 34.2235, lon: -118.6204 },
    ]);
    expect(result.kind).toBe('assessed');
    if (result.kind !== 'assessed') return;
    expect(result.findings[0]!.assessment.tier).toBe('C');
    expect(result.findings[0]!.assessment.implication).toMatch(/No encumbrance on this parcel is implied/);
  });

  it('puts the strongest evidence first', async () => {
    /*
     * Tier before distance: a feature crossing the parcel outranks one 3 ft
     * away that does not, because the tiers are categorically different
     * claims rather than points on one scale.
     */
    const result = await scan([
      { type: 'node', tags: { power: 'pole' }, lat: 34.2235, lon: -118.6204 },
      {
        type: 'way',
        tags: { power: 'line' },
        geometry: [
          { lat: 34.22002, lon: -118.6215 },
          { lat: 34.22002, lon: -118.62 },
        ],
      },
    ]);
    expect(result.kind).toBe('assessed');
    if (result.kind !== 'assessed') return;
    expect(result.findings.map((f) => f.assessment.tier)).toEqual(['A', 'C']);
  });

  it('refuses to tier without a parcel polygon', async () => {
    /*
     * THE WHOLE CONTRACT OF assessEvidenceTier. Measuring from the geocoded
     * point instead would be the centroid distance it warns against — wrong
     * for any parcel whose radius approaches the search radius, and wrong in
     * the direction of overstating the tier.
     */
    const lookup = await lookupInfrastructure({
      lat: 34.2201,
      lon: -118.6204,
      fetchImpl: stub(() => overpass([{ type: 'node', tags: { power: 'pole' }, lat: 34.22, lon: -118.62 }])),
    });
    expect(assessParcelInfrastructure(lookup, null).kind).toBe('no-parcel-geometry');
    expect(assessParcelInfrastructure(lookup, [[-118.62, 34.22]]).kind).toBe('no-parcel-geometry');
  });

  it('keeps a failed lookup distinct from an empty one', async () => {
    /*
     * THE DISTINCTION THE WHOLE FEATURE RESTS ON. "The scan did not run" and
     * "the scan found nothing" must never render as the same sentence, and
     * neither may render as "there is nothing there".
     */
    const failed = await lookupInfrastructure({
      lat: 34.22,
      lon: -118.62,
      fetchImpl: stub(() => new Response('boom', { status: 503 })),
    });
    expect(assessParcelInfrastructure(failed, FAUST_RING).kind).toBe('lookup-failed');

    const empty = await lookupInfrastructure({
      lat: 34.22,
      lon: -118.62,
      fetchImpl: stub(() => overpass([])),
    });
    expect(assessParcelInfrastructure(empty, FAUST_RING).kind).toBe('none-mapped');
  });
});

describe('the coverage caveat', () => {
  it('says absence of a finding is not absence of infrastructure', async () => {
    /*
     * The scan's failure mode is silence: a street whose poles nobody has
     * traced looks identical to a street with no poles. OpenStreetMap maps
     * transmission well and residential distribution poorly — a live query
     * near the LA test parcel returned nothing at all.
     */
    expect(COVERAGE_CAVEAT).toMatch(/not evidence that nothing is there/);
    expect(COVERAGE_CAVEAT).toMatch(/volunteer map/);
    expect(COVERAGE_CAVEAT).toMatch(/deed|plat/);
  });

  it('has a default radius that is a budget, not a relevance judgment', () => {
    // The tier decides relevance; this only bounds how much geometry comes
    // back from the slowest service the report touches.
    expect(DEFAULT_SCAN_RADIUS_FT).toBeGreaterThan(100);
    expect(DEFAULT_SCAN_RADIUS_FT).toBeLessThanOrEqual(1000);
  });
});

describe('the join carries each feature\'s own account of its position', () => {
  /*
   * assessParcelInfrastructure measures to the foot. evidence-tier.ts refuses
   * to build a tier A or B claim out of an inferred alignment — but it can
   * only refuse if the join passes the flag along, and nothing else in the
   * suite would notice if that argument were dropped. Checked behaviourally
   * rather than by reading the source, because the behaviour is the point.
   */
  const crossing = (quality: 'mapped' | 'inferred') =>
    assessParcelInfrastructure(
      {
        kind: 'found',
        radiusFt: 400,
        queriedOn: '2026-10-15',
        features: [
          {
            category: 'overhead-power',
            label: '345kV overhead electricity transmission line',
            operator: 'COMMONWEALTH EDISON CO',
            // Straight through the middle of the ring: unambiguously tier A
            // geometry, so only the quality flag can change the outcome.
            geometry: [
              [-118.6212, 34.22002],
              [-118.6203, 34.22002],
            ],
            geometryQuality: quality,
          },
        ],
      },
      FAUST_RING,
    );

  it('grades a surveyed line through the parcel as tier A', () => {
    const r = crossing('mapped');
    expect(r.kind).toBe('assessed');
    if (r.kind !== 'assessed') return;
    expect(r.findings[0]!.assessment.tier).toBe('A');
    expect(r.findings[0]!.assessment.mayValue).toBe(true);
  });

  it('refuses tier A for the same geometry when the publisher inferred it', () => {
    const r = crossing('inferred');
    expect(r.kind).toBe('assessed');
    if (r.kind !== 'assessed') return;
    expect(r.findings[0]!.assessment.tier).toBe('C');
    expect(r.findings[0]!.assessment.mayValue).toBe(false);
    expect(r.findings[0]!.assessment.basis).toMatch(/inferred/i);
  });
});
