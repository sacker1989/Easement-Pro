/**
 * Distances between a parcel boundary and nearby infrastructure.
 *
 * WHY THIS EXISTS. `assessEvidenceTier` in easements/evidence-tier.ts takes a
 * distance in feet and states plainly what it must be: measured from the
 * parcel BOUNDARY, not its centroid, because "a centroid distance is wrong for
 * any parcel whose radius approaches the search radius". Nothing in the
 * product could produce that number, so the tier was never shown to anybody.
 * This module is what makes it producible.
 *
 * EQUIRECTANGULAR, AND THAT IS A DELIBERATE SIMPLIFICATION. Latitude and
 * longitude are projected onto a local flat plane centred on the parcel, with
 * the longitude axis scaled by cos(latitude). Over the distances that matter
 * here — a parcel is tens of metres across and the search radius is a couple
 * of hundred — the error against a proper geodesic is far below a foot, which
 * is well inside the 15 ft boundary strip the tier turns on. Great-circle
 * formulae would be more precise and would not change a single tier.
 *
 * It would be wrong at continental scale. Nothing here works at that scale:
 * every caller passes points within a few hundred metres of each other, and
 * `localScale` is derived per parcel rather than globally.
 */

/** A WGS84 position, in the [longitude, latitude] order Esri and GeoJSON use. */
export type LngLat = readonly [number, number];

/** Feet per degree of latitude. Constant enough at this precision. */
const FEET_PER_DEGREE_LAT = 364_000;

export interface LocalScale {
  readonly feetPerDegreeLat: number;
  readonly feetPerDegreeLng: number;
}

/**
 * Scale factors at a given latitude.
 *
 * Longitude degrees shorten towards the poles; latitude degrees do not, to
 * any precision this needs. Taking the scale from the parcel's own latitude
 * is what keeps the flat-plane approximation honest.
 */
export function localScale(latitude: number): LocalScale {
  return {
    feetPerDegreeLat: FEET_PER_DEGREE_LAT,
    feetPerDegreeLng: FEET_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180),
  };
}

function toFeet(from: LngLat, to: LngLat, scale: LocalScale): readonly [number, number] {
  return [
    (to[0] - from[0]) * scale.feetPerDegreeLng,
    (to[1] - from[1]) * scale.feetPerDegreeLat,
  ];
}

/**
 * Shortest distance in feet from a point to a line segment.
 *
 * The segment case rather than the endpoint case matters: a power line is a
 * polyline, and the nearest part of it to a parcel is usually somewhere along
 * a span rather than at a mapped tower. Measuring to vertices only would
 * overstate the distance, which would understate the tier — the wrong
 * direction to be wrong in.
 */
export function pointToSegmentFt(p: LngLat, a: LngLat, b: LngLat, scale: LocalScale): number {
  const [ax, ay] = toFeet(p, a, scale);
  const [bx, by] = toFeet(p, b, scale);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  // A degenerate segment is a point; both endpoints coincide.
  if (lengthSq === 0) return Math.hypot(ax, ay);

  // Projection of the origin (the point, now at 0,0) onto the segment,
  // clamped so it cannot run off either end.
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Whether a point lies inside a ring, by ray casting.
 *
 * NEEDED BECAUSE TIER A IS "INTERSECTS", NOT "IS NEAR". Infrastructure that
 * sits inside the parcel is zero feet from it, and a boundary-distance
 * calculation alone would report the distance to the nearest edge — a
 * positive number, which would read as tier B or C for a line running right
 * across the property. That is the single most consequential mistake this
 * module could make, so inside-ness is tested separately and first.
 */
export function pointInRing(p: LngLat, ring: readonly LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const straddles = yi > p[1] !== yj > p[1];
    if (!straddles) continue;
    const xCrossing = ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (p[0] < xCrossing) inside = !inside;
  }
  return inside;
}

/** Shortest distance in feet from a point to a ring's boundary. */
export function pointToRingFt(p: LngLat, ring: readonly LngLat[], scale: LocalScale): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    nearest = Math.min(nearest, pointToSegmentFt(p, ring[i]!, ring[j]!, scale));
  }
  return nearest;
}

/** Sign of the cross product (b-a)x(c-a); the side of ab that c falls on. */
function orientation(a: LngLat, b: LngLat, c: LngLat): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * Whether two segments cross.
 *
 * THE PRIMITIVE THE FIRST VERSION OF THIS FILE OMITTED, and the omission was
 * not academic. A transmission line spans a whole block: its mapped vertices
 * are towers hundreds of feet away on either side of the parcel, so no
 * feature vertex is inside the ring — and because the line passes BETWEEN the
 * parcel's north and south edges, no ring vertex is near it either. Both of
 * the cheaper checks miss it, and the line is reported as 38 ft away while it
 * runs directly over the house. A test caught it; the geometry had to grow a
 * real intersection test.
 *
 * Done in raw degrees rather than projected feet: the test is only about
 * which side of a line a point falls on, and that is unchanged by a positive
 * scaling of either axis.
 */
function segmentsIntersect(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const d1 = orientation(a, b, c);
  const d2 = orientation(a, b, d);
  const d3 = orientation(c, d, a);
  const d4 = orientation(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Distance in feet from a parcel ring to a feature, where a feature is a
 * point (one position) or a polyline (several).
 *
 * RETURNS ZERO FOR ANYTHING TOUCHING THE PARCEL, which is what tier A means,
 * and getting that wrong is the most consequential mistake this module could
 * make. There are three ways to touch and all three are tested, because each
 * of the first two misses a case the next one catches:
 *
 *   1. a feature vertex inside the ring   — a pole in the back garden
 *   2. a span crossing a ring edge        — a line entering and leaving
 *   3. a ring vertex inside the feature   — not possible for a polyline, so
 *                                           case 2 is the one that carries it
 *
 * Only once none of those hold is a positive distance meaningful.
 */
export function featureToParcelFt(
  feature: readonly LngLat[],
  ring: readonly LngLat[],
  scale: LocalScale,
): number {
  if (feature.length === 0 || ring.length < 3) return Number.POSITIVE_INFINITY;

  for (const position of feature) {
    if (pointInRing(position, ring)) return 0;
  }

  for (let f = 1; f < feature.length; f++) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (segmentsIntersect(feature[f - 1]!, feature[f]!, ring[j]!, ring[i]!)) return 0;
    }
  }

  let nearest = Number.POSITIVE_INFINITY;
  for (const position of feature) {
    nearest = Math.min(nearest, pointToRingFt(position, ring, scale));
  }
  /*
   * And every ring vertex against every span, which is the nearest approach
   * when a line runs alongside the parcel without crossing it — the tier B
   * case, and the one the strip width was chosen for.
   */
  for (const corner of ring) {
    for (let f = 1; f < feature.length; f++) {
      nearest = Math.min(nearest, pointToSegmentFt(corner, feature[f - 1]!, feature[f]!, scale));
    }
  }

  return nearest;
}

/**
 * Any position inside the ring, for centring the local projection.
 *
 * THE CLOSING VERTEX IS DROPPED FIRST. Esri and GeoJSON both repeat the first
 * position at the end to close a ring, and averaging that duplicate pulls the
 * result toward one corner — measurably: on the test parcel it moved the
 * centroid about 10 ft, enough to misreport how far the middle of a lot sits
 * from its own boundary.
 */
export function ringCentroid(ring: readonly LngLat[]): LngLat {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed =
    ring.length > 1 && first !== undefined && last !== undefined
      ? first[0] === last[0] && first[1] === last[1]
      : false;
  const positions = closed ? ring.slice(0, -1) : ring;
  const sum = positions.reduce<[number, number]>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / positions.length, sum[1] / positions.length];
}
