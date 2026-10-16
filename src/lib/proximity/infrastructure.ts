import { createResilientFetch } from '@/lib/net/resilient-fetch';
import type { LngLat } from '@/lib/geo/planar-distance';

/**
 * Utility infrastructure near a parcel, from OpenStreetMap.
 *
 * WHAT THIS IS FOR. `assessEvidenceTier` turns a parcel-boundary distance into
 * an ordinal A/B/C statement about whether infrastructure implies an
 * encumbrance. It has never been shown to anyone because nothing could supply
 * the distance. This supplies the features; geo/planar-distance.ts supplies
 * the measurement.
 *
 * WHY NOT A PROBABILITY, since that is what gets asked for. Calibrating one
 * needs parcels where an easement is known to exist, and
 * docs/open-data-source-assessment.md records the sweep that established none
 * of the four supported counties publishes a recorded-easement layer. A
 * percentage without ground truth is an invented number wearing a
 * probability's clothing, and it anchors a reader harder than a range does.
 *
 * WHY OSM RATHER THAN HIFLD. Measured, not assumed — same Burbank parcel,
 * HIFLD returned 5 transmission features with `OWNER: "NOT AVAILABLE"` on
 * every one, OSM returned 4 with two naming an operator and carrying voltage.
 * HIFLD's schema has no right-of-way width field at all.
 *
 * THE HONESTY PROBLEM THIS MODULE HAS, stated here because it governs the
 * whole design: OSM maps transmission lines well and residential distribution
 * poorly. A query near the LA test parcel returns nothing at all. "Nothing
 * found" therefore means "nothing mapped", NOT "nothing there" — and a
 * homeowner reading the first as the second has been told their property is
 * clear by a tool that simply did not look hard enough. Hence `none-mapped`
 * rather than `none`, and copy that never treats absence as reassurance.
 */

/** Overpass endpoint. GET, not POST — POST returned dispatcher errors. */
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

/**
 * Overpass rejects requests with no User-Agent (406), which reads like a hard
 * block rather than a policy. A contact address is the courtesy the project
 * asks for and costs nothing.
 */
const USER_AGENT = 'SafeHomeValue/1.0 (easement research; help@safehomevalue.com)';

/**
 * How far out to look, in feet.
 *
 * NOT A JUDGMENT ABOUT RELEVANCE — the evidence tier makes that call, and
 * grades anything beyond the boundary strip as context only. This is a budget:
 * a wider radius returns more geometry to measure and takes longer on a public
 * endpoint that is already the slowest thing the report touches.
 */
export const DEFAULT_SCAN_RADIUS_FT = 400;

const FEET_PER_METRE = 3.28084;

export type InfrastructureCategory =
  | 'overhead-power'
  | 'underground-power'
  | 'pipeline'
  | 'communications';

/**
 * Whether a feature's published position was observed or reconstructed.
 *
 * WHY THIS IS A FIELD AND NOT A FOOTNOTE. The evidence tier is a distance
 * measured to the foot against a parcel boundary, and the boundary strip that
 * separates tier B from tier C is 15 ft wide. That arithmetic is only
 * meaningful if the line is actually where the layer says it is.
 *
 * The federal transmission layer marks each record `INFERRED`, and in Cook
 * County 453 of 517 lines are inferred — the route was reconstructed from
 * aerial imagery and EIA utility filings rather than surveyed. In Los Angeles
 * it is 3 of 205 and in San Diego 0 of 60, so this is not a small uniform
 * caveat to bury in the coverage note: it is the dominant case in one of the
 * counties served and nearly absent in the others.
 *
 * Feeding an inferred alignment into a 15 ft threshold manufactures a finding.
 * `assessEvidenceTier` therefore refuses to derive tier A or B from one.
 */
export type GeometryQuality =
  /** The publisher asserts this is where the thing is. */
  | 'mapped'
  /** The publisher says the route was reconstructed, not observed. */
  | 'inferred';

export interface InfrastructureFeature {
  readonly category: InfrastructureCategory;
  /** Plain-language description, e.g. "overhead power line". */
  readonly label: string;
  /** Named operator where OSM carries one. Null is common and is not a fault. */
  readonly operator: string | null;
  /** Positions in [lng, lat]; one for a node, several for a way. */
  readonly geometry: readonly LngLat[];
  /**
   * Required rather than optional, deliberately.
   *
   * An optional field defaulting to 'mapped' would let a new source silently
   * claim survey accuracy it does not have, which is the exact mistake this
   * exists to prevent. Every source must say which it is.
   */
  readonly geometryQuality: GeometryQuality;
}

export type InfrastructureResult =
  | {
      readonly kind: 'found';
      readonly features: readonly InfrastructureFeature[];
      readonly radiusFt: number;
      readonly queriedOn: string;
    }
  /** The query ran and matched nothing. NOT the same as nothing being there. */
  | { readonly kind: 'none-mapped'; readonly radiusFt: number; readonly queriedOn: string }
  | { readonly kind: 'lookup-failed'; readonly reason: string; readonly queriedOn: string };

export interface InfrastructureQuery {
  readonly lat: number;
  readonly lon: number;
  readonly radiusFt?: number;
  readonly today?: string;
  readonly fetchImpl?: typeof fetch;
}

let sharedFetch: typeof fetch | null = null;
function defaultFetch(): typeof fetch {
  // Lazy for the same reason flood-zone is: createResilientFetch throws in a
  // module-load context where fetch is not yet defined.
  if (sharedFetch === null) sharedFetch = createResilientFetch() as unknown as typeof fetch;
  return sharedFetch;
}

/**
 * The Overpass QL. Deliberately narrow.
 *
 * Only things that imply a utility corridor: power lines of both kinds, the
 * poles and towers that carry them, underground cables, and pipelines. NOT
 * roads, buildings or water features — a road beside a house is not evidence
 * of a utility easement, and including it would bury the signal in noise
 * while making every query slower.
 */
function overpassQuery(lat: number, lon: number, radiusM: number): string {
  const around = `(around:${radiusM.toFixed(0)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  return [
    '[out:json][timeout:20];(',
    `way["power"~"^(line|minor_line|cable)$"]${around};`,
    `node["power"~"^(tower|pole)$"]${around};`,
    `way["man_made"="pipeline"]${around};`,
    `way["communication"="line"]${around};`,
    ');out geom;',
  ].join('');
}

interface OverpassElement {
  readonly type?: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly geometry?: ReadonlyArray<{ readonly lat?: number; readonly lon?: number }>;
  readonly tags?: Readonly<Record<string, string>>;
}

/** Maps OSM tags to a category and a phrase a homeowner would recognise. */
function classify(tags: Readonly<Record<string, string>>): {
  category: InfrastructureCategory;
  label: string;
} | null {
  const power = tags['power'];
  if (power === 'line') return { category: 'overhead-power', label: 'overhead power transmission line' };
  if (power === 'minor_line') return { category: 'overhead-power', label: 'overhead power distribution line' };
  if (power === 'cable') return { category: 'underground-power', label: 'underground power cable' };
  if (power === 'tower') return { category: 'overhead-power', label: 'transmission tower' };
  if (power === 'pole') return { category: 'overhead-power', label: 'utility pole' };
  if (tags['man_made'] === 'pipeline') {
    const substance = tags['substance'];
    return {
      category: 'pipeline',
      label: substance ? `${substance} pipeline` : 'pipeline',
    };
  }
  if (tags['communication'] === 'line') {
    return { category: 'communications', label: 'communications line' };
  }
  return null;
}

function toGeometry(element: OverpassElement): readonly LngLat[] {
  if (Array.isArray(element.geometry)) {
    return element.geometry
      .filter((p): p is { lat: number; lon: number } => typeof p.lat === 'number' && typeof p.lon === 'number')
      .map((p): LngLat => [p.lon, p.lat]);
  }
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return [[element.lon, element.lat]];
  }
  return [];
}

/**
 * Looks up infrastructure near a point.
 *
 * NEVER THROWS. Every failure becomes `lookup-failed` with a reason that
 * names no address — the query URL contains coordinates, so an error message
 * quoting it would put a location into whatever logs the caller keeps. Same
 * rule the outcome log enforces structurally.
 */
export async function lookupInfrastructure(query: InfrastructureQuery): Promise<InfrastructureResult> {
  const queriedOn = query.today ?? new Date().toISOString().slice(0, 10);
  const radiusFt = query.radiusFt ?? DEFAULT_SCAN_RADIUS_FT;
  const radiusM = radiusFt / FEET_PER_METRE;
  const doFetch = query.fetchImpl ?? defaultFetch();

  const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(
    overpassQuery(query.lat, query.lon, radiusM),
  )}`;

  try {
    const response = await doFetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      return { kind: 'lookup-failed', reason: `OpenStreetMap returned ${response.status}`, queriedOn };
    }

    /*
     * Overpass answers an overloaded dispatcher with HTTP 200 and an HTML
     * error page, which is the same trap the Esri services set by returning
     * 200 with an {error} body. Parsing is the only way to tell.
     */
    const text = await response.text();
    let payload: { elements?: readonly OverpassElement[] };
    try {
      payload = JSON.parse(text) as { elements?: readonly OverpassElement[] };
    } catch {
      return { kind: 'lookup-failed', reason: 'OpenStreetMap returned a non-JSON response', queriedOn };
    }

    const elements = payload.elements ?? [];
    const features = elements.flatMap((element): InfrastructureFeature[] => {
      const kind = classify(element.tags ?? {});
      if (kind === null) return [];
      const geometry = toGeometry(element);
      if (geometry.length === 0) return [];
      return [
        {
          category: kind.category,
          label: kind.label,
          operator: element.tags?.['operator'] ?? null,
          geometry,
          /*
           * OSM IS TREATED AS MAPPED, which is a judgment worth stating.
           * A volunteer tracing a pole line from imagery is doing much what
           * the federal layer calls "inferred", and OSM carries no flag
           * saying which records were surveyed. But OSM's weakness is
           * OMISSION rather than displacement — the measured failure is
           * streets with nothing on them at all, which COVERAGE_CAVEAT
           * already tells the reader. Marking every OSM feature inferred
           * would suppress the tier everywhere and make the field mean
           * "not the federal layer" instead of what it says.
           */
          geometryQuality: 'mapped',
        },
      ];
    });

    if (features.length === 0) return { kind: 'none-mapped', radiusFt, queriedOn };
    return { kind: 'found', features, radiusFt, queriedOn };
  } catch {
    return { kind: 'lookup-failed', reason: 'OpenStreetMap did not respond', queriedOn };
  }
}
