/**
 * Do LA County and San Diego County publish a shared lot area per
 * condominium unit, the way Cook and Orange do?
 *
 * Cook publishes the building footprint against a per-unit land value and
 * Orange publishes the whole development's; both now suppress the per-sq-ft
 * derivation instead of dividing one by the other. LA and San Diego were
 * declared 'whole-parcel' without being checked, which is a claim.
 *
 * TWO SIGNALS THAT LOOKED PROMISING AND ARE NOT:
 *   LA's UseDescription never contains "condominium" — 0 of 2,433,213 rows.
 *   San Diego's FRACTINT is populated on 1,087,812 of 1,088,869 parcels and
 *   reads 1 on ordinary lots, so it is a whole-interest marker, not a flag.
 *
 * THE SIGNATURE IS SEVERAL PARCELS AT ONE ADDRESS SHARING ONE AREA. A
 * per-unit area differs between units; a development's does not. That is
 * tested directly here rather than inferred from a column name.
 */
const UA = 'SafeHomeValue/1.0 (easement research)';
const j = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();
const LA = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query';
const SD = 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query';
const q = (base, params) => j(`${base}?${new URLSearchParams({ f: 'json', ...params })}`);

/** Groups rows by street address and reports whether the area is shared. */
function report(label, rows, addrOf, areaOf, valueOf) {
  const byAddr = new Map();
  for (const a of rows) {
    const k = addrOf(a);
    if (!k.trim()) continue;
    if (!byAddr.has(k)) byAddr.set(k, []);
    byAddr.get(k).push(a);
  }
  const multi = [...byAddr.entries()].filter(([, v]) => v.length >= 3);
  console.log(`  ${label}: ${multi.length} addresses with 3+ parcels`);
  let shared = 0;
  for (const [addr, rs] of multi.slice(0, 8)) {
    const areas = new Set(rs.map((r) => Math.round(areaOf(r))));
    const vals = new Set(rs.map((r) => Number(valueOf(r)) || 0));
    const isShared = areas.size === 1;
    if (isShared) shared++;
    console.log(
      `    ${addr.slice(0, 30).padEnd(30)} ${String(rs.length).padStart(3)} parcels  ` +
        `${areas.size} area(s)  ${vals.size} land value(s)  ${isShared ? '<-- SHARED AREA' : 'per-parcel'}`,
    );
  }
  return shared;
}

console.log('=== LOS ANGELES COUNTY');
const la = await q(LA, {
  where: "SitusUnit <> ' ' AND SitusUnit <> '' AND SitusHouseNo <> ''",
  outFields: 'APN,SitusHouseNo,SitusStreet,SitusUnit,Roll_LandValue,Shape.STArea()',
  returnGeometry: 'false',
  orderByFields: 'SitusStreet,SitusHouseNo',
  resultRecordCount: '1000',
});
if (la.error) console.log('  error:', JSON.stringify(la.error).slice(0, 200));
console.log(`  rows with a unit number: ${(la.features ?? []).length}`);
report(
  'unit-numbered addresses',
  (la.features ?? []).map((f) => f.attributes),
  (a) => `${a.SitusHouseNo} ${a.SitusStreet}`,
  (a) => Number(a['Shape.STArea()']) || 0,
  (a) => a.Roll_LandValue,
);
const laUnits = await q(LA, { where: "SitusUnit <> ' ' AND SitusUnit <> ''", returnCountOnly: 'true' });
const laAll = await q(LA, { where: '1=1', returnCountOnly: 'true' });
console.log(`  county: ${laUnits.count} of ${laAll.count} carry a unit number`);

console.log('\n=== SAN DIEGO COUNTY');
const sdOdd = await q(SD, { where: 'FRACTINT <> 1', returnCountOnly: 'true' });
const sdAll = await q(SD, { where: '1=1', returnCountOnly: 'true' });
console.log(`  FRACTINT <> 1: ${sdOdd.count} of ${sdAll.count}`);
const sd = await q(SD, {
  where: "SITUS_SUITE <> '' AND SITUS_SUITE IS NOT NULL AND SITUS_ADDRESS > 0",
  outFields: 'APN,SITUS_ADDRESS,SITUS_STREET,SITUS_SUITE,FRACTINT,ASR_LAND,Shape.STArea()',
  returnGeometry: 'false',
  orderByFields: 'SITUS_STREET,SITUS_ADDRESS',
  resultRecordCount: '1000',
});
if (sd.error) console.log('  error:', JSON.stringify(sd.error).slice(0, 200));
console.log(`  rows with a suite: ${(sd.features ?? []).length}`);
report(
  'suite-numbered addresses',
  (sd.features ?? []).map((f) => f.attributes),
  (a) => `${a.SITUS_ADDRESS} ${a.SITUS_STREET}`,
  (a) => Number(a['Shape.STArea()']) || 0,
  (a) => a.ASR_LAND,
);
const sdSuite = await q(SD, { where: "SITUS_SUITE <> '' AND SITUS_SUITE IS NOT NULL", returnCountOnly: 'true' });
console.log(`  county: ${sdSuite.count} of ${sdAll.count} carry a suite`);
