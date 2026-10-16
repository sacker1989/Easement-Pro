/**
 * Does San Diego's LEGLDESC distinguish a condominium unit from an ordinary
 * lot, the way LA's LegalDescription does?
 *
 * The suite number is a candidate signal but may over-fire the same way LA's
 * unit number did — LA has duplexes on separate lots carrying unit letters,
 * which share no area and must keep their valuation. 253 10th (147 parcels,
 * one area) is the shared case; 1590 Chase (a single-family parcel used
 * throughout this codebase's tests) is the control.
 */
const UA = 'SafeHomeValue/1.0 (easement research)';
const j = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();
const SD = 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query';
const q = (p) => j(`${SD}?${new URLSearchParams({ f: 'json', ...p })}`);

const CASES = [
  { label: 'SHARED area (147 parcels at one address)', where: "SITUS_ADDRESS=253 AND SITUS_STREET='10TH'" },
  { label: 'CONTROL single-family lot', where: "APN='4982604500'" },
];

for (const c of CASES) {
  const d = await q({
    where: c.where,
    outFields: 'APN,SITUS_ADDRESS,SITUS_STREET,SITUS_SUITE,LEGLDESC,FRACTINT,ASR_LAND,ASR_LANDUSE,Shape.STArea()',
    returnGeometry: 'false',
    resultRecordCount: '3',
  });
  console.log(`\n=== ${c.label}`);
  if (d.error) { console.log('  error:', JSON.stringify(d.error).slice(0, 160)); continue; }
  for (const f of d.features ?? []) {
    const a = f.attributes;
    console.log(`  APN ${a.APN}  suite=${JSON.stringify(a.SITUS_SUITE)}  area=${Math.round(Number(a['Shape.STArea()']))}  land=$${a.ASR_LAND}  landuse=${a.ASR_LANDUSE}  fractint=${a.FRACTINT}`);
    console.log(`     legal=${JSON.stringify(String(a.LEGLDESC ?? '').slice(0, 170))}`);
  }
}

const n = async (w) => (await q({ where: w, returnCountOnly: 'true' })).count;
console.log('\n=== counts');
for (const w of [
  '1=1',
  "LEGLDESC LIKE '%CONDO%'",
  "LEGLDESC LIKE '%UNIT%'",
  "LEGLDESC LIKE '%COMMON%'",
  "SITUS_SUITE <> '' AND SITUS_SUITE IS NOT NULL",
]) {
  console.log(`  ${w.padEnd(44)} ${await n(w)}`);
}
