import { lookupParcel } from '../src/lib/parcel-lookup/county-dispatch.ts';
import { setOutcomeSink } from '../src/lib/observability/outcome-log.ts';
setOutcomeSink({ write: () => {} });
// The county's own values for APN 2982604200, varied one at a time.
const CASES = [
  { label: "county zip, community city", street: '850 DEL MAR DOWNS RD', city: 'Solana Beach', zip: '92075' },
  { label: "county zip, no city       ", street: '850 DEL MAR DOWNS RD', city: '', zip: '92075' },
  { label: "no zip at all             ", street: '850 DEL MAR DOWNS RD', city: 'Solana Beach', zip: '' },
  { label: "wrong zip (my invention)  ", street: '850 DEL MAR DOWNS RD', city: 'San Diego', zip: '92014' },
  { label: "no suffix                 ", street: '850 DEL MAR DOWNS', city: 'Solana Beach', zip: '92075' },
];
for (const c of CASES) {
  const r = await lookupParcel({ street: c.street, city: c.city, state: 'CA', zip: c.zip, zipPlus4: null, county: 'San Diego County' });
  const detail = r.status === 'found' ? r.valuation.apn : r.status === 'ambiguous' ? `${r.candidates.length} candidates` : '';
  console.log(`${c.label}  ->  ${r.status.padEnd(12)} ${detail}`);
}
