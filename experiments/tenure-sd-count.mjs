const UA = 'SafeHomeValue/1.0 (easement research)';
const SD = 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query';
const n = async (w) => (await (await fetch(`${SD}?${new URLSearchParams({ f: 'json', where: w, returnCountOnly: 'true' })}`, { headers: { 'User-Agent': UA } })).json()).count;
for (const w of [
  "LEGLDESC LIKE '%UND INT%'",
  "LEGLDESC LIKE '%UND %INT%'",
  "LEGLDESC LIKE '%UND INT%' AND SITUS_ADDRESS > 0",
  "SITUS_SUITE <> '' AND SITUS_SUITE IS NOT NULL AND LEGLDESC NOT LIKE '%UND INT%'",
  "LEGLDESC LIKE '%UND INT%' AND (SITUS_SUITE = '' OR SITUS_SUITE IS NULL)",
]) console.log(`${String(await n(w)).padStart(8)}  ${w}`);
