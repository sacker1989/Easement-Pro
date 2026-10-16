/**
 * Does infrastructure proximity predict a recorded easement?
 *
 * The only calibration this product can currently obtain. Lawrence, Kansas
 * publishes recorded easement polygons AND parcels AND utility networks; none
 * of the four counties the product serves publishes the first of those, which
 * is why the evidence tier has always been an untested claim.
 *
 * Run with:  npx tsx experiments/lawrence-easement-calibration.mjs
 *
 * Results and interpretation: docs/easement-tier-calibration.md
 *
 * TWO METHOD TRAPS THIS SCRIPT EXISTS TO AVOID, both of which bit on the
 * first attempt:
 *
 * 1. TRUNCATION. A flat resultRecordCount silently cut water pipes to 2,000
 *    of 7,162 and easements to 2,000 of 3,005. That starved tier C of both
 *    predictor and ground truth and MANUFACTURED a strong-looking gradient
 *    (87/67/43) which collapsed to 94/88/78 once paged properly. Every layer
 *    is paged to exhaustion here.
 *
 * 2. ADJACENCY MISTAKEN FOR OVERLAP. Plat easements are drawn along lot
 *    lines, so a touching test marks nearly every parcel burdened by
 *    construction. The overlap test below requires a vertex strictly inside
 *    the other polygon. It made almost no difference, which is itself the
 *    finding: these strips genuinely sit inside the lot.
 */
import { featureToParcelFt, localScale, pointInRing, ringCentroid } from '../src/lib/geo/planar-distance.ts';
import { assessEvidenceTier } from '../src/lib/easements/evidence-tier.ts';

const ROOT = 'https://services.arcgis.com/8O9UlSTnqjKptoda/arcgis/rest/services';

/** Pages until exhausted, so no layer is silently truncated. */
async function fetchAll(svc, layer, box, cap = 20000) {
  const out = [];
  let offset = 0;
  for (;;) {
    const u = `${ROOT}/${svc}/FeatureServer/${layer}/query?${new URLSearchParams({
      f: 'json', outSR: '4326', geometry: box, geometryType: 'esriGeometryEnvelope', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID',
      resultOffset: String(offset), resultRecordCount: '1000',
    })}`;
    const r = await fetch(u).then((x) => x.json());
    if (r.error) throw new Error(`${svc}/${layer}: ${r.error.message}`);
    const f = r.features || [];
    out.push(...f);
    if (f.length < 1000 || out.length >= cap) break;
    offset += f.length;
  }
  return out;
}

const rings = (f) => (f.geometry?.rings || []).map((r) => r.map((p) => [p[0], p[1]]));
const paths = (f) => (f.geometry?.paths || []).map((r) => r.map((p) => [p[0], p[1]]));

// TOUCHING is not OVERLAPPING. A plat easement is drawn along the lot line,
// so an adjacency test marks almost every parcel as burdened by construction.
// Strict: a vertex of one must fall strictly INSIDE the other, which needs
// real shared area rather than a shared edge.
function overlaps(parcelRing, otherRing) {
  return otherRing.some((p) => pointInRing(p, parcelRing)) ||
    parcelRing.some((p) => pointInRing(p, otherRing));
}

// Three disjoint study areas, so one neighbourhood's platting cannot carry the result.
const BOXES = [
  ['west',    '-95.300,38.930,-95.280,38.945'],
  ['central', '-95.265,38.950,-95.245,38.965'],
  ['east',    '-95.240,38.930,-95.220,38.945'],
];

const all = [];
for (const [name, box] of BOXES) {
  const [parcels, easements, storm, water] = await Promise.all([
    fetchAll('Parcel', 0, box),
    fetchAll('Easements', 1, box),
    fetchAll('Stormwater', 3, box),
    fetchAll('Water_Distribution', 5, box),
  ]);
  const easementRings = easements.flatMap(rings);
  const utilityPaths = [...storm.flatMap(paths), ...water.flatMap(paths)];
  const rows = [];
  for (const p of parcels) {
    const pr = rings(p)[0];
    if (!pr || pr.length < 4) continue;
    const scale = localScale(ringCentroid(pr)[1]);
    const hasEasement = easementRings.some((er) => overlaps(pr, er));
    let nearest = Infinity;
    for (const u of utilityPaths) {
      const d = featureToParcelFt(u, pr, scale);
      if (d < nearest) nearest = d;
      if (nearest === 0) break;
    }
    if (!Number.isFinite(nearest)) continue;
    rows.push({ tier: assessEvidenceTier(nearest).tier, hasEasement });
  }
  const hit = rows.filter((r) => r.hasEasement).length;
  console.log(`  ${name.padEnd(8)} parcels=${String(parcels.length).padStart(4)} easements=${String(easements.length).padStart(4)} utilities=${String(utilityPaths.length).padStart(5)}  base rate=${Math.round((hit / rows.length) * 100)}%`);
  all.push(...rows);
}

console.log(`\n  POOLED: ${all.length} parcels`);
const base = all.filter((r) => r.hasEasement).length;
console.log(`  base rate: ${base}/${all.length} = ${Math.round((base / all.length) * 100)}%\n`);
console.log('  tier      n    with easement   rate    lift vs base');
for (const t of ['A', 'B', 'C']) {
  const g = all.filter((r) => r.tier === t);
  if (!g.length) { console.log(`   ${t}        0       -           -        -`); continue; }
  const h = g.filter((r) => r.hasEasement).length;
  const rate = (h / g.length) * 100;
  const lift = rate - (base / all.length) * 100;
  console.log(`   ${t}     ${String(g.length).padStart(4)}    ${String(h).padStart(4)}         ${String(Math.round(rate)).padStart(3)}%    ${lift >= 0 ? '+' : ''}${Math.round(lift)} pts`);
}
