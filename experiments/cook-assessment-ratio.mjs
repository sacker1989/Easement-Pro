/**
 * How far below market is the Cook County land figure the report prices from?
 *
 * report-sweep.mjs surfaced "800 sq ft x $0.35/sq ft = $280 of land under the
 * easement" on a Sauk Village parcel, labelled "Verified against the Cook
 * County assessment roll". Illinois assesses at a statutory fraction of market
 * value, so that is not a land price, and the product's stated purpose is to
 * tell a homeowner whether a claim is worth a professional's time.
 *
 * The question is whether the gap can be MEASURED from what the county
 * publishes, rather than asserted from statute. cook-county-assessor-provider
 * deliberately does not scale the figure, on the grounds that the ratio varies
 * by class and by legislative change — so the first thing to establish is
 * what the layer actually carries.
 */
const UA = 'SafeHomeValue/1.0 (easement research)';
const j = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();
const LAYER = 'https://gis12.cookcountyil.gov/traditional/rest/services/CookViewer3Parcels/MapServer/0';

const meta = await j(`${LAYER}?f=json`);
const names = (meta.fields ?? []).map((f) => `${f.name}:${f.type.replace('esriFieldType', '')}`);
console.log('all fields:');
console.log('  ' + names.join('  '));

const interesting = (meta.fields ?? [])
  .map((f) => f.name)
  .filter((n) => /value|val|market|assess|class|mkt|av\b|eav/i.test(n));
console.log('\nvalue/class-ish fields:', interesting.join(', '));

// What do they hold for the flagged parcel and a few neighbours?
const d = await j(
  `${LAYER}/query?${new URLSearchParams({
    f: 'json',
    where: "street_address LIKE '3160 223RD%'",
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: '1',
  })}`,
);
const a = d.features?.[0]?.attributes ?? {};
console.log('\n3160 223RD ST, every populated field:');
for (const [k, v] of Object.entries(a)) {
  if (v === null || v === '' || v === ' ') continue;
  console.log(`  ${k.padEnd(24)} ${JSON.stringify(v).slice(0, 80)}`);
}
