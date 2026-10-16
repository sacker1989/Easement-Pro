/**
 * Why do two San Diego addresses from the county's own situs list render the
 * form instead of a report?
 *
 * report-sweep.mjs flagged 850 Del Mar Downs Rd and 1640 Chase Ln as 23 KB
 * pages with no limits section, which is the signature of a suppressed
 * report. Both came from the county's own parcels layer, so the county is
 * asserting these addresses exist.
 */
import { lookupParcel } from '../src/lib/parcel-lookup/county-dispatch.ts';
import { setOutcomeSink } from '../src/lib/observability/outcome-log.ts';
setOutcomeSink({ write: () => {} });

const UA = 'SafeHomeValue/1.0 (easement research)';
const SD = 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query';

const CASES = [
  { street: '850 DEL MAR DOWNS RD', city: 'San Diego', zip: '92014' },
  { street: '1640 CHASE LN', city: 'El Cajon', zip: '92020' },
  // A control that is known to work.
  { street: '1590 E CHASE AVE', city: 'El Cajon', zip: '92020' },
];

for (const c of CASES) {
  const r = await lookupParcel({
    street: c.street, city: c.city, state: 'CA', zip: c.zip, zipPlus4: null, county: 'San Diego County',
  });
  console.log(`\n=== ${c.street}  ->  ${r.status}`);
  if (r.status === 'found') console.log(`    apn ${r.valuation.apn}  area ${Math.round(r.valuation.lotAreaSqFt)}  land $${r.valuation.landValue}`);
  else if (r.status === 'ambiguous') console.log(`    ${r.candidates.length} candidates: ${r.candidates.slice(0, 4).map((k) => k.apn).join(', ')}`);
  else console.log(`    ${JSON.stringify(r).slice(0, 200)}`);
}

// What does the county itself hold for these streets?
console.log('\n=== what the county publishes');
for (const name of ['DEL MAR DOWNS', 'CHASE']) {
  const u = `${SD}?${new URLSearchParams({
    f: 'json',
    where: `SITUS_STREET LIKE '${name}%'`,
    outFields: 'APN,SITUS_ADDRESS,SITUS_PRE_DIR,SITUS_STREET,SITUS_SUFFIX,SITUS_ZIP,ASR_LAND',
    returnGeometry: 'false',
    resultRecordCount: '4',
  })}`;
  const d = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
  console.log(`  ${name}:`);
  for (const f of d.features ?? []) console.log('   ', JSON.stringify(f.attributes));
}
