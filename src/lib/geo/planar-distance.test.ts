import { describe, expect, it } from 'vitest';
import {
  featureToParcelFt,
  localScale,
  pointInRing,
  pointToRingFt,
  pointToSegmentFt,
  ringCentroid,
  type LngLat,
} from './planar-distance';

/**
 * A real parcel: AIN 2004001003, 8321 Faust Ave, fetched from the LA County
 * service with returnGeometry=true. Using the live ring rather than a square
 * keeps the numbers checkable against something that exists.
 */
const FAUST_RING: readonly LngLat[] = [
  [-118.62043438906645, 34.220139162531154],
  [-118.6209272554045, 34.22013149577303],
  [-118.62091787409204, 34.2199082033365],
  [-118.62042500775399, 34.21991587009462],
  [-118.62043438906645, 34.220139162531154],
];

const SCALE = localScale(34.22);

describe('the local projection', () => {
  it('shortens longitude by the cosine of latitude', () => {
    // At 34°N a degree of longitude is about 83% of a degree of latitude.
    const s = localScale(34.22);
    expect(s.feetPerDegreeLng / s.feetPerDegreeLat).toBeCloseTo(Math.cos((34.22 * Math.PI) / 180), 6);
  });

  it('treats the equator as the case where they match', () => {
    const s = localScale(0);
    expect(s.feetPerDegreeLng).toBeCloseTo(s.feetPerDegreeLat, 6);
  });
});

describe('point to segment', () => {
  it('measures to the nearest point along a span, not to its ends', () => {
    /*
     * THE CASE THAT MATTERS FOR POWER LINES. A span runs between two mapped
     * towers; the nearest part of it to a parcel is usually somewhere in the
     * middle. Measuring to vertices only would overstate the distance, which
     * understates the tier — the wrong direction to be wrong in.
     */
    const a: LngLat = [-118.621, 34.2205];
    const b: LngLat = [-118.620, 34.2205];
    const abovemiddle: LngLat = [-118.6205, 34.2206];
    const toSegment = pointToSegmentFt(abovemiddle, a, b, SCALE);
    const toNearestEnd = Math.min(
      pointToSegmentFt(abovemiddle, a, a, SCALE),
      pointToSegmentFt(abovemiddle, b, b, SCALE),
    );
    expect(toSegment).toBeLessThan(toNearestEnd);
    // 0.0001 degrees of latitude is about 36 ft.
    expect(toSegment).toBeCloseTo(36.4, 0);
  });

  it('clamps to the endpoints rather than running off the line', () => {
    const a: LngLat = [-118.621, 34.2205];
    const b: LngLat = [-118.620, 34.2205];
    // Well past b along the same bearing: the answer is the distance to b.
    const beyond: LngLat = [-118.619, 34.2205];
    expect(pointToSegmentFt(beyond, a, b, SCALE)).toBeCloseTo(
      pointToSegmentFt(beyond, b, b, SCALE),
      6,
    );
  });

  it('handles a degenerate segment as a point', () => {
    const a: LngLat = [-118.621, 34.2205];
    expect(pointToSegmentFt([-118.621, 34.2206], a, a, SCALE)).toBeCloseTo(36.4, 0);
  });
});

describe('inside the parcel', () => {
  it('finds the centroid inside', () => {
    expect(pointInRing(ringCentroid(FAUST_RING), FAUST_RING)).toBe(true);
  });

  it('finds a point outside', () => {
    expect(pointInRing([-118.6215, 34.2205], FAUST_RING)).toBe(false);
  });

  it('measures a real parcel at roughly its recorded size', () => {
    /*
     * The county reports 9,686 sq ft for this parcel. The ring is about 148 ft
     * by 81 ft, so the centroid sits roughly 40 ft from the nearest edge. This
     * is a sanity check on the projection: if the scale factors were wrong the
     * number would be out by tens of percent.
     */
    const d = pointToRingFt(ringCentroid(FAUST_RING), FAUST_RING, SCALE);
    expect(d).toBeGreaterThan(35);
    expect(d).toBeLessThan(50);
  });
});

describe('feature to parcel', () => {
  it('returns zero for a feature inside the parcel', () => {
    expect(featureToParcelFt([ringCentroid(FAUST_RING)], FAUST_RING, SCALE)).toBe(0);
  });

  it('returns zero for a line crossing clean through with no vertex inside', () => {
    /*
     * THE CASE A NAIVE IMPLEMENTATION MISSES. A transmission line spans a
     * whole block; its mapped vertices are towers hundreds of feet away on
     * either side, and not one of them is inside this parcel. Testing only
     * the feature's own vertices would report it as far away while it runs
     * directly over the house.
     */
    const throughIt: readonly LngLat[] = [
      [-118.6215, 34.22002],
      [-118.6200, 34.22002],
    ];
    expect(featureToParcelFt(throughIt, FAUST_RING, SCALE)).toBe(0);
  });

  it('measures a line running parallel just outside the boundary', () => {
    // About 0.00002 degrees of latitude south of the southern edge: ~7 ft.
    const alongside: readonly LngLat[] = [
      [-118.6215, 34.21989],
      [-118.6200, 34.21989],
    ];
    const d = featureToParcelFt(alongside, FAUST_RING, SCALE);
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(12);
  });

  it('measures a distant feature as distant', () => {
    const faraway: readonly LngLat[] = [[-118.625, 34.225]];
    expect(featureToParcelFt(faraway, FAUST_RING, SCALE)).toBeGreaterThan(1000);
  });

  it('refuses to guess from an empty feature or a degenerate ring', () => {
    expect(featureToParcelFt([], FAUST_RING, SCALE)).toBe(Number.POSITIVE_INFINITY);
    expect(featureToParcelFt([[-118.62, 34.22]], [], SCALE)).toBe(Number.POSITIVE_INFINITY);
  });
});
