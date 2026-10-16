/**
 * Can LA County's legal description tell a condominium unit from a duplex on
 * its own lot?
 *
 * A unit number alone cannot: 5053 109th St has 17 parcels sharing one area
 * (a condominium) while 1833 10th Ave has 3 parcels with 3 areas (separate
 * lots that happen to carry unit designations). Suppressing on the unit
 * number would over-refuse the second kind. Orange's equivalent signal is the
 * legal description, so this checks whether LA's says the same thing.
 */
const UA = 'SafeHomeValue/1.0 (easement research)';
const j = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();
const LA = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query';
const q = (p) => j(`${LA}?${new URLSearchParams({ f: 'json', ...p })}`);

const CASES = [
  { label: 'SHARED area (condominium)', where: "SitusHouseNo='5053' AND SitusStreet='109TH ST'" },
  { label: 'PER-PARCEL area (own lots)', where: "SitusHouseNo='1833' AND SitusStreet='10TH AVE'" },
];

for (const c of CASES) {
  const d = await q({
    where: c.where,
    outFields: 'APN,SitusUnit,UseType,UseDescription,LegalDescription,Roll_LandValue,Shape.STArea()',
    returnGeometry: 'false',
    resultRecordCount: '3',
  });
  console.log(`\n=== ${c.label}`);
  if (d.error) { console.log('  error:', JSON.stringify(d.error).slice(0, 160)); continue; }
  for (const f of d.features ?? []) {
    const a = f.attributes;
    console.log(`  APN ${a.APN}  unit=${JSON.stringify(a.SitusUnit)}  area=${Math.round(Number(a['Shape.STArea()']))}  land=$${a.Roll_LandValue}`);
    console.log(`     useType=${JSON.stringify(a.UseType)}  useDesc=${JSON.stringify(a.UseDescription)}`);
    console.log(`     legal=${JSON.stringify(String(a.LegalDescription ?? '').slice(0, 170))}`);
  }
}

// If the legal description carries a marker, how many parcels have it?
const n = async (w) => (await q({ where: w, returnCountOnly: 'true' })).count;
console.log('\n=== counts');
for (const w of [
  "LegalDescription LIKE '%CONDOMINIUM%'",
  "LegalDescription LIKE '%AIR SPACE%'",
  "LegalDescription LIKE '%UNDIVIDED%'",
  "UseType LIKE '%ondominium%'",
]) {
  console.log(`  ${w.padEnd(48)} ${await n(w)}`);
}
