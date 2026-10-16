/**
 * Does every county now tell a shared lot from an owner's own?
 *
 * All four were found on 2026-10-15 to publish a per-unit land value against
 * a whole building's or development's area, and to divide one by the other.
 * Each county signals it differently and three of the four obvious signals
 * were wrong, so this checks the paired cases against the live services: a
 * known unit and a known fee lot per county.
 *
 *   Cook      PIN's last four digits are the unit; -0000 means undivided
 *   Orange    LegalDescr "TOGETHER WITH AN UND 1/12 INT"
 *   LA        LegalDescription "CONDO UNIT 1 (AIRSPACE AND 1/17 INT...)"
 *   San Diego LEGLDESC "UND INT IN"
 *
 * A unit must report undivided-interest AND a zero price per sq ft. A fee lot
 * must report whole-parcel AND keep deriving its price, because over-refusing
 * costs a reader a figure they were entitled to.
 */
import { lookupParcel } from '../src/lib/parcel-lookup/county-dispatch.ts';
import { setOutcomeSink } from '../src/lib/observability/outcome-log.ts';
setOutcomeSink({ write: () => {} });

const CASES = [
  { want: 'undivided-interest', label: 'LA condo (5053 109th St)',     street: '5053 109TH ST',       city: 'Los Angeles', state: 'CA', zip: '',      county: 'Los Angeles County' },
  { want: 'whole-parcel',       label: 'LA fee lot (8321 Faust Ave)',  street: '8321 Faust Ave',      city: 'Canoga Park', state: 'CA', zip: '91304', county: 'Los Angeles County' },
  { want: 'undivided-interest', label: 'OC condo (142 Paramount)',     street: '142 PARAMOUNT',       city: 'Irvine',      state: 'CA', zip: '92618', county: 'Orange County' },
  { want: 'whole-parcel',       label: 'OC fee lot (1135 W Brook St)', street: '1135 W BROOK ST',     city: 'Santa Ana',   state: 'CA', zip: '92703', county: 'Orange County' },
  { want: 'undivided-interest', label: 'SD condo (253 10th)',          street: '253 10TH',            city: 'San Diego',   state: 'CA', zip: '',      county: 'San Diego County' },
  { want: 'whole-parcel',       label: 'SD fee lot (1590 E Chase Ave)',street: '1590 E Chase Ave',    city: 'El Cajon',    state: 'CA', zip: '92020', county: 'San Diego County' },
  { want: 'undivided-interest', label: 'Cook condo (222 N Columbus)',  street: '222 N COLUMBUS DR 3102', city: 'Chicago', state: 'IL', zip: '60601', county: 'Cook County' },
  { want: 'whole-parcel',       label: 'Cook whole (5801 W Cermak)',   street: '5801 W CERMAK RD',    city: 'Cicero',      state: 'IL', zip: '60804', county: 'Cook County' },
];

let pass = 0;
let fail = 0;
for (const c of CASES) {
  const r = await lookupParcel({
    street: c.street, city: c.city, state: c.state, zip: c.zip, zipPlus4: null, county: c.county,
  });
  if (r.status !== 'found') {
    // An ambiguous result still proves nothing about tenure, so say so plainly.
    console.log(`  ?  ${c.label.padEnd(34)} lookup ${r.status}`);
    continue;
  }
  const v = r.valuation;
  const tenureOk = v.lotTenure === c.want;
  // A unit must have no derived price; a fee lot must have one unless the
  // county publishes no land value (Cermak is exempt, land value 0).
  const priceOk =
    c.want === 'undivided-interest' ? v.landValuePerSqFt === 0 : v.landValue === 0 || v.landValuePerSqFt > 0;
  const caveatOk =
    c.want === 'undivided-interest'
      ? v.caveats.some((x) => x.includes('whole development'))
      : !v.caveats.some((x) => x.includes('whole development'));
  const ok = tenureOk && priceOk && caveatOk;
  ok ? pass++ : fail++;
  console.log(
    `  ${ok ? 'ok' : 'FAIL'} ${c.label.padEnd(34)} ${v.lotTenure.padEnd(19)}` +
      ` area=${Math.round(v.lotAreaSqFt).toLocaleString().padStart(9)}` +
      ` land=$${v.landValue.toLocaleString().padStart(10)}` +
      ` $/sqft=${v.landValuePerSqFt.toFixed(2).padStart(8)}` +
      `${ok ? '' : `   [tenure ${tenureOk} price ${priceOk} caveat ${caveatOk}]`}`,
  );
}
console.log(`\n${pass} passed, ${fail} failed`);
