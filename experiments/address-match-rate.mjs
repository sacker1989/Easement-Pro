/**
 * What fraction of real addresses resolve to the right parcel?
 *
 * Four address parsers were repaired on 2026-10-11 after each was found to be
 * missing real parcels. None of them has ever been measured.
 *
 * THE SAMPLE IS THE COUNTY'S OWN SITUS ADDRESSES, which is the fairest
 * available ground truth: the county is asserting that this address exists
 * and belongs to this parcel. If the product cannot find a parcel back from
 * the county's own spelling of it, nothing a homeowner types will do better.
 *
 * AND THE TEST IS APN EQUALITY, not "found something". A lookup that returns
 * the neighbour's parcel is a worse failure than one that returns nothing,
 * and a found/not-found metric would score it as a success.
 */
import { lookupParcel } from '../src/lib/parcel-lookup/county-dispatch.ts';
import { setOutcomeSink } from '../src/lib/observability/outcome-log.ts';

// The outcome log writes a JSON line per upstream call to stdout, which is
// correct in production and drowns a table here.
setOutcomeSink({ write: () => {} });

const SAMPLES = 25;

const COUNTIES = [
  {
    county: 'Los Angeles County', state: 'CA',
    url: 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query',
    fields: 'APN,SitusHouseNo,SitusDirection,SitusStreet,SitusCity,SitusZIP',
    where: "SitusStreet<>'' AND SitusHouseNo<>''",
    build: (a) => ({
      apn: a.APN,
      street: [a.SitusHouseNo, (a.SitusDirection || '').trim(), a.SitusStreet].filter(Boolean).join(' '),
      city: (a.SitusCity || 'Los Angeles').trim(),
      zip: String(a.SitusZIP || '').slice(0, 5),
    }),
  },
  {
    county: 'Orange County', state: 'CA',
    url: 'https://www.ocgis.com/arcpub/rest/services/LegalLotsAttributeOpenData/MapServer/0/query',
    fields: 'AssessmentNo,SiteAddress,SiteZip5',
    where: "SiteAddress<>''",
    build: (a) => ({ apn: a.AssessmentNo, street: a.SiteAddress, city: 'Anaheim', zip: String(a.SiteZip5 || '') }),
  },
  {
    county: 'San Diego County', state: 'CA',
    url: 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query',
    fields: 'APN,SITUS_ADDRESS,SITUS_PRE_DIR,SITUS_STREET,SITUS_SUFFIX,SITUS_ZIP',
    where: "SITUS_STREET<>'' AND SITUS_ADDRESS>0",
    build: (a) => ({
      apn: a.APN,
      street: [a.SITUS_ADDRESS, (a.SITUS_PRE_DIR || '').trim(), a.SITUS_STREET, (a.SITUS_SUFFIX || '').trim()].filter(Boolean).join(' '),
      city: 'San Diego',
      zip: String(a.SITUS_ZIP || '').slice(0, 5),
    }),
  },
  {
    county: 'Cook County', state: 'IL',
    url: 'https://gis12.cookcountyil.gov/traditional/rest/services/CookViewer3Parcels/MapServer/0/query',
    fields: 'PIN14_dash,street_address,ZIP1',
    where: "street_address<>''",
    build: (a) => ({ apn: a.PIN14_dash, street: a.street_address, city: 'Chicago', zip: String(a.ZIP1 || '') }),
  },
];

/** Realistic ways a person types an address the county spells differently. */
const VARIANTS = {
  'as the county spells it': (s) => s,
  'lower case': (s) => s.toLowerCase(),
  'suffix spelled out': (s) => s.replace(/\bST$/i, 'Street').replace(/\bAVE$/i, 'Avenue').replace(/\bDR$/i, 'Drive').replace(/\bRD$/i, 'Road'),
  'no suffix': (s) => s.replace(/\s+(ST|AVE|DR|RD|BLVD|LN|CT|PL|WAY)$/i, ''),
};

const norm = (s) => String(s || '').replace(/[^0-9a-z]/gi, '').toUpperCase();

for (const c of COUNTIES) {
  const u = `${c.url}?${new URLSearchParams({ f: 'json', where: c.where, outFields: c.fields, returnGeometry: 'false', resultRecordCount: String(SAMPLES) })}`;
  const r = await fetch(u).then((x) => x.json()).catch(() => null);
  const rows = (r?.features || []).map((f) => c.build(f.attributes)).filter((x) => x.apn && x.street && !/^SITUSs*NA$/i.test(x.street.trim()));
  if (!rows.length) { console.log(`\n=== ${c.county}: could not sample`); continue; }
  console.log(`\n=== ${c.county} (${rows.length} real addresses)`);
  for (const [label, mutate] of Object.entries(VARIANTS)) {
    let correct = 0, wrong = 0, missed = 0, resolvable = 0;
    for (const row of rows) {
      const street = mutate(row.street);
      let res;
      try {
        res = await lookupParcel({ street, city: row.city, state: c.state, zip: row.zip, zipPlus4: null, county: c.county });
      } catch { missed++; continue; }
      if (res.status === 'found') {
        if (norm(res.valuation.apn) === norm(row.apn)) correct++; else wrong++;
      } else if (res.status === 'ambiguous') {
        /*
         * AMBIGUOUS IS NOT A FAILURE. Several parcels genuinely share one
         * street address — condo units, duplexes — and the product returns
         * the candidate list rather than guessing which is yours. Scoring it
         * as a miss, which the first version of this did, marks the refusal
         * to guess as a defect. It only counts if the right parcel is in the
         * list the reader is shown.
         */
        if (res.candidates.some((k) => norm(k.apn) === norm(row.apn))) resolvable++; else missed++;
      } else missed++;
    }
    /*
     * REACHES THE PARCEL is the metric that matches what a reader
     * experiences: either the report opens on their parcel, or the
     * disambiguation screen lists it and they click once. Both get them
     * there. Reporting exact-match alone — which the first version of this
     * did — scores the product's refusal to guess between two condo units as
     * a defect, and understated San Diego by 24 points.
     */
    const reach = correct + resolvable;
    const pct = Math.round((reach / rows.length) * 100);
    console.log(
      `   ${label.padEnd(22)} reaches it ${String(reach).padStart(2)}/${rows.length} = ${String(pct).padStart(3)}%` +
        `   (exact ${correct}, via picker ${resolvable})   wrong-parcel ${wrong}   no-match ${missed}`,
    );
  }
}
