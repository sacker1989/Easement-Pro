/**
 * Do the LA and San Diego mappers detect a shared lot in real attribute bags?
 *
 * tenure-all-counties.mjs cannot prove these two: a condominium address
 * returns `ambiguous` by design, because many units share one street address
 * and the product offers the candidate list rather than guessing. That is
 * correct and it stops the lookup before tenure is reported.
 *
 * So this fetches real rows from each service — the same fields the providers
 * request, nothing hand-written — and runs the mappers on them directly.
 */
import { toAssessorParcelValuation } from '../src/lib/risk-disclosure/la-county-assessor-provider.ts';
import { toSanDiegoParcelValuation } from '../src/lib/risk-disclosure/san-diego-assessor-provider.ts';

const UA = 'SafeHomeValue/1.0 (easement research)';
const j = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();

const LA = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query';
const SD = 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query';

const rows = async (base, where, fields, n = 2) => {
  const d = await j(
    `${base}?${new URLSearchParams({
      f: 'json', where, outFields: fields, returnGeometry: 'false', resultRecordCount: String(n),
    })}`,
  );
  if (d.error) throw new Error(JSON.stringify(d.error).slice(0, 200));
  return (d.features ?? []).map((f) => f.attributes);
};

const LA_FIELDS = 'AIN,APN,SitusFullAddress,Roll_Year,Roll_LandValue,Roll_ImpValue,Roll_LandBaseYear,LegalDescription,Shape.STArea()';
const SD_FIELDS = 'APN,ASR_LAND,ASR_IMPR,ASR_TOTAL,SITUS_ADDRESS,SITUS_PRE_DIR,SITUS_STREET,SITUS_SUFFIX,SITUS_POST_DIR,SITUS_ZIP,DOCDATE,DOCTYPE,TOTAL_LVG_AREA,OWN_NAME1,LEGLDESC,Shape.STArea()';

const CASES = [
  { label: 'LA  condominium', want: 'undivided-interest', base: LA, fields: LA_FIELDS, map: toAssessorParcelValuation,
    where: "LegalDescription LIKE '%CONDO%' AND Roll_LandValue > 0" },
  { label: 'LA  fee lot',     want: 'whole-parcel',       base: LA, fields: LA_FIELDS, map: toAssessorParcelValuation,
    where: "LegalDescription NOT LIKE '%CONDO%' AND Roll_LandValue > 0" },
  { label: 'SD  undivided',   want: 'undivided-interest', base: SD, fields: SD_FIELDS, map: toSanDiegoParcelValuation,
    where: "LEGLDESC LIKE '%UND INT%' AND ASR_LAND > 0" },
  { label: 'SD  fee lot',     want: 'whole-parcel',       base: SD, fields: SD_FIELDS, map: toSanDiegoParcelValuation,
    where: "LEGLDESC NOT LIKE '%UND INT%' AND ASR_LAND > 0" },
];

let pass = 0;
let fail = 0;
for (const c of CASES) {
  for (const attrs of await rows(c.base, c.where, c.fields)) {
    let v;
    try {
      v = c.map(attrs);
    } catch (e) {
      console.log(`  ?    ${c.label.padEnd(18)} mapper threw: ${String(e.message).slice(0, 70)}`);
      continue;
    }
    const tenureOk = v.lotTenure === c.want;
    const priceOk = c.want === 'undivided-interest' ? v.landValuePerSqFt === 0 : v.landValuePerSqFt > 0;
    const ok = tenureOk && priceOk;
    ok ? pass++ : fail++;
    const legal = String(attrs.LegalDescription ?? attrs.LEGLDESC ?? '').trim().slice(0, 56);
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${c.label.padEnd(18)} ${v.lotTenure.padEnd(19)}` +
        ` $/sqft=${v.landValuePerSqFt.toFixed(2).padStart(8)}  "${legal}"`,
    );
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
