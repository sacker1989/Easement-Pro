/**
 * CAL FIRE Fire Hazard Severity Zone for a point.
 *
 * WHY THIS AND NOT AN INTEGER CODE. The FHSZ layers carry `FHSZ` as a bare
 * smallint with no coded domain published on the service — classifying from
 * it would mean asserting CAL FIRE's code standard from memory, which is the
 * one thing this codebase does not do with facts it serves to users. The same
 * layers carry `FHSZ_Description` as prose — "Very High", "NonWildland" —
 * and the service says what its own values mean, so nothing is inferred.
 * Same discipline as flood-zone.ts.
 *
 * TWO MAPS, ONE QUESTION. CAL FIRE publishes severity zones separately for
 * Local Responsibility Areas (cities, 2025 map) and State Responsibility
 * Areas (unincorporated wildland, 2024 map). A point in one is generally not
 * in the other, so the lookup tries LRA first and falls back to SRA. Both
 * are public ArcGIS Online services, no token.
 *
 * WHAT IT IS NOT. An FHSZ polygon is the REGULATORY map, not a measurement of
 * this parcel. It maps hazard — the physical conditions that create expected
 * fire behavior over decades — not risk, which would account for defensible
 * space, hardening, and local firefighting. The copy says so.
 */

import { createResilientFetch } from '@/lib/net/resilient-fetch';

/** CAL FIRE FHSZ, Local Responsibility Areas — map dated March 24, 2025. */
export const CALFIRE_FHSZ_LRA_LAYER =
  'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSALRA25_v1_All/FeatureServer/0';

/** CAL FIRE FHSZ, State Responsibility Areas — 2024 map. */
export const CALFIRE_FHSZ_SRA_LAYER =
  'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZSRA_23_3/FeatureServer/0';

/** The three mapped hazard classes. Everything else is not a hazard zone. */
export type FireSeverityClass = 'Very High' | 'High' | 'Moderate';

export type FireSeverityResult =
  | {
      readonly kind: 'in-hazard-zone';
      readonly severity: FireSeverityClass;
      /** FHSZ_Description verbatim, e.g. "Very High". */
      readonly description: string;
      readonly source: string;
      readonly queriedOn: string;
    }
  | {
      /** Mapped, and the map says this is not wildland hazard (e.g. NonWildland). */
      readonly kind: 'not-in-hazard-zone';
      readonly description: string | null;
      readonly source: string;
      readonly queriedOn: string;
    }
  | {
      /** Neither map has a polygon here. NOT the same as "no fire risk". */
      readonly kind: 'no-map-coverage';
      readonly source: string;
      readonly queriedOn: string;
    }
  | {
      readonly kind: 'lookup-failed';
      readonly reason: string;
      readonly source: string;
      readonly queriedOn: string;
    };

export interface FireSeverityQuery {
  readonly lat: number;
  readonly lon: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

let sharedFetch: typeof fetch | null = null;
function defaultFetch(): typeof fetch {
  // Lazy for the same reason flood-zone is: createResilientFetch throws in a
  // browser, and module init would run there during a client bundle.
  if (sharedFetch === null) sharedFetch = createResilientFetch() as unknown as typeof fetch;
  return sharedFetch;
}

function buildUrl(layer: string, lat: number, lon: number): string {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'SRA,FHSZ_Description',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${layer}/query?${params.toString()}`;
}

interface Classified {
  readonly layer: string;
  readonly description: string;
  readonly severity: FireSeverityClass | null;
}

/**
 * Classify one layer's prose description. Returns null severity for mapped
 * non-hazard classes (NonWildland and friends). Unknown prose is NOT guessed
 * at — it comes back as a failure, because inventing a hazard class is worse
 * than saying the check could not be completed.
 */
function classifyFromProse(description: string): FireSeverityClass | 'non-hazard' | 'unknown' {
  const d = description.trim().toLowerCase();
  if (d === 'very high') return 'Very High';
  if (d === 'high') return 'High';
  if (d === 'moderate') return 'Moderate';
  if (d === 'nonwildland' || d === 'non-wildland' || d === 'urban unzoned') return 'non-hazard';
  return 'unknown';
}

async function queryLayer(
  layer: string,
  lat: number,
  lon: number,
  doFetch: typeof fetch,
): Promise<Classified | 'no-coverage' | 'failed'> {
  const response = await doFetch(buildUrl(layer, lat, lon));
  if (!response.ok) return 'failed';

  const payload = (await response.json()) as {
    error?: { message?: string };
    features?: Array<{ attributes?: Record<string, unknown> }>;
  };

  // Esri answers HTTP 200 with an error body. Every other provider in this
  // codebase checks for it, and so does this one.
  if (payload.error) return 'failed';

  const attributes = payload.features?.[0]?.attributes;
  if (attributes === undefined) return 'no-coverage';

  const description =
    typeof attributes.FHSZ_Description === 'string' ? attributes.FHSZ_Description.trim() : '';
  if (description === '') return 'no-coverage';

  const severity = classifyFromProse(description);
  if (severity === 'unknown') return 'failed';
  return { layer, description, severity: severity === 'non-hazard' ? null : severity };
}

/**
 * Looks up the fire hazard severity zone containing a point.
 *
 * NEVER THROWS FOR AN UPSTREAM PROBLEM. A CAL FIRE outage must not take down
 * a report whose other sections are fine — the fire panel is additive, and
 * the honest degraded state is "we could not check", which the result type
 * carries. Programmer errors (a non-finite coordinate) still throw.
 */
export async function lookupFireSeverity(query: FireSeverityQuery): Promise<FireSeverityResult> {
  const { lat, lon } = query;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new TypeError(`lookupFireSeverity needs finite coordinates; got ${lat}, ${lon}`);
  }

  const now = query.now ?? (() => new Date());
  const queriedOn = now().toISOString().slice(0, 10);
  const doFetch = query.fetchImpl ?? defaultFetch();

  try {
    const lra = await queryLayer(CALFIRE_FHSZ_LRA_LAYER, lat, lon, doFetch);
    const answered = lra === 'no-coverage'
      ? await queryLayer(CALFIRE_FHSZ_SRA_LAYER, lat, lon, doFetch)
      : lra;

    if (answered === 'failed') {
      return { kind: 'lookup-failed', reason: 'CAL FIRE service error', source: CALFIRE_FHSZ_LRA_LAYER, queriedOn };
    }
    if (answered === 'no-coverage') {
      return { kind: 'no-map-coverage', source: CALFIRE_FHSZ_LRA_LAYER, queriedOn };
    }
    if (answered.severity === null) {
      return { kind: 'not-in-hazard-zone', description: answered.description, source: answered.layer, queriedOn };
    }
    return {
      kind: 'in-hazard-zone',
      severity: answered.severity,
      description: answered.description,
      source: answered.layer,
      queriedOn,
    };
  } catch (err) {
    return {
      kind: 'lookup-failed',
      reason: err instanceof Error ? err.message : 'Unknown error',
      source: CALFIRE_FHSZ_LRA_LAYER,
      queriedOn,
    };
  }
}

export interface FireSafetyContent {
  readonly severity: FireSeverityClass;
  readonly headline: string;
  readonly whatItIs: string;
  readonly whyItMatters: string;
  readonly whoIsResponsible: string;
  readonly freeNextStep: string;
}

/**
 * Builds the homeowner-facing fire section, or null when there is nothing
 * credible to say. The gate is deliberately narrow: overhead power lines are
 * the easement type where the holder's own infrastructure is an ignition
 * source, and a mapped hazard zone is what makes that combination worth a
 * dedicated section. Every other combination returns null — no placeholder,
 * no hedging paragraph.
 */
export function buildFireSafetyContent(
  easementType: string,
  result: FireSeverityResult,
): FireSafetyContent | null {
  if (easementType !== 'utility-overhead') return null;
  if (result.kind !== 'in-hazard-zone') return null;

  const defensibleSpace =
    result.severity === 'Very High'
      ? ' In Very High zones, California law (Public Resources Code 4291) requires 100 feet of ' +
        'defensible space around structures — cleared vegetation, limbed trees, no combustible ' +
        'storage against the house. Insurers and buyers both ask about this designation.'
      : '';

  return {
    severity: result.severity,
    headline: 'Fire risk from the overhead power lines',
    whatItIs:
      `CAL FIRE maps this address inside a ${result.severity} Fire Hazard Severity Zone. That is ` +
      'the state\u2019s official mapping of where wildfire behavior is expected to be most severe, ' +
      'based on fuels, terrain, and fire weather over decades — not a prediction about your house ' +
      'specifically, and not a statement about defensible space or hardening you may already have.',
    whyItMatters:
      'Overhead power lines are ignition sources: wind-driven contact, vegetation contact, and ' +
      'equipment failure have all started major California fires. Where the lines cross a mapped ' +
      'hazard zone, the combination is exactly what the zone system exists to flag.' +
      defensibleSpace,
    whoIsResponsible:
      'Vegetation management under and around the conductors is generally the utility\u2019s ' +
      'responsibility — they trim to clearance standards on their schedule, not yours, and the ' +
      'shape of the trim is decided by clearance rather than appearance. Keeping the ground ' +
      'beneath the lines tidy and never planting trees that will grow into the wires is generally ' +
      'yours. Never prune near power lines yourself; that is the utility\u2019s work or a ' +
      'qualified line-clearance crew\u2019s.',
    freeNextStep:
      'Walk the strip under the lines and photograph it from several angles, with dates. Note ' +
      'any tree already touching or near the wires and report it to the utility — vegetation ' +
      'contact is the failure they are required to prevent, and a dated record costs nothing.',
  };
}

/** Stated wherever a severity zone is shown. */
export const FIRE_SEVERITY_DISCLOSURE =
  'This is CAL FIRE\u2019s regulatory hazard map, not a survey of your parcel. It maps hazard — ' +
  'the physical conditions that create expected fire behavior — not risk, which would account ' +
  'for defensible space, hardening, and local firefighting. Where no map covers an address, ' +
  'that means CAL FIRE has not mapped it, which is not a finding that the risk is low. ' +
  'Map data: CAL FIRE / Office of the State Fire Marshal — Fire Hazard Severity Zones ' +
  '(Local Responsibility Area map dated March 24, 2025; State Responsibility Area 2024 map), ' +
  'used with attribution under CC BY.';

/**
 * What CAL FIRE says about this parcel, for every outcome — including the
 * outcomes that are not a hazard.
 *
 * WHY SILENCE WAS THE WRONG ANSWER. `buildFireSafetyContent` returns null
 * unless the easement is an overhead utility line AND the parcel sits in a
 * mapped hazard zone, so every other parcel got no fire content at all. From
 * a reader's side, "not in a mapped zone" and "we never looked" are the same
 * blank page.
 *
 * It was reported from production on 2026-10-21 in the sharpest possible
 * form: a Studio City report carried a VERY HIGH panel, and an Altadena
 * address — inside the Eaton Fire burn scar — carried nothing. The reviewer
 * called it the worst miss the product can make, and they were right about
 * the effect while the cause was not what it looked like.
 *
 * THE PRODUCT WAS REPORTING CAL FIRE FAITHFULLY. Queried 2026-10-25, the LRA
 * layer returns FHSZ -3, "NonWildland", for southern Altadena, and "Very
 * High" a mile north at the foothills. The map is doing what it was built to
 * do: FHSZ models WILDLAND fire hazard from terrain, fuel and weather over
 * decades. The Eaton Fire's destruction of developed Altadena in January 2025
 * was an urban conflagration driven by wind and structure-to-structure
 * spread, which is a different phenomenon and is not what this layer models.
 *
 * So the fix is not to invent a hazard the map does not assert. It is to stop
 * being silent, and to say what the map does and does not cover — because a
 * homeowner reading "not in a mapped hazard zone" after their neighbourhood
 * burned deserves to know why those two facts are compatible.
 */
export interface FireStatusNote {
  readonly heading: string;
  readonly body: string;
  /** The limit of what the layer claims. Always present. */
  readonly limit: string;
  readonly source: string | null;
}

/** THE SENTENCE THAT MATTERS, and the reason this function exists. */
const WILDLAND_ONLY =
  'CAL FIRE\u2019s severity zones model WILDLAND fire hazard — terrain, vegetation and weather ' +
  'over decades. They are not a record of what has burned, and they do not model urban ' +
  'conflagration, where wind carries fire from structure to structure through a built-up ' +
  'neighbourhood. Areas mapped as non-wildland have burned in exactly that way.';

export function buildFireStatusNote(result: FireSeverityResult): FireStatusNote {
  switch (result.kind) {
    case 'in-hazard-zone':
      return {
        heading: `CAL FIRE maps this parcel as ${result.severity} fire hazard severity`,
        body:
          `The parcel sits inside a mapped ${result.description} Fire Hazard Severity Zone. That ` +
          'carries real consequences: defensible-space requirements, building standards for ' +
          'repairs and additions, and insurance that is harder and dearer to obtain.',
        limit: WILDLAND_ONLY,
        source: result.source,
      };
    case 'not-in-hazard-zone':
      return {
        heading: 'CAL FIRE does not map this parcel in a fire hazard severity zone',
        body:
          `The layer returns ${result.description ?? 'a non-hazard classification'} here, so the ` +
          'state does not designate it Moderate, High or Very High. No defensible-space or ' +
          'wildland building standard follows from the state map at this location.',
        limit: WILDLAND_ONLY,
        source: result.source,
      };
    case 'no-map-coverage':
      return {
        heading: 'CAL FIRE publishes no severity zone for this location',
        body:
          'Neither the local nor the state responsibility area map has a polygon here. That is ' +
          'an absence of mapping, not a finding of low hazard, and it is the ordinary result ' +
          'outside California.',
        limit: WILDLAND_ONLY,
        source: result.source,
      };
    case 'lookup-failed':
      return {
        heading: 'We could not reach CAL FIRE',
        body:
          'The fire hazard lookup did not complete, so this report says nothing either way about ' +
          'fire hazard at this address. Check the CAL FIRE hazard map directly.',
        limit: WILDLAND_ONLY,
        source: result.source,
      };
  }
}
