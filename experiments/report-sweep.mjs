/**
 * Renders many real addresses and asserts the page never states something it
 * does not know.
 *
 * WHY THIS EXISTS. On 2026-10-15 five real defects were found by fetching the
 * production HTML for one address and reading it, while 1,647 unit tests
 * passed through every one of them. None was a crash or a type error. Each
 * was the page asserting something false in prose or in a figure:
 *
 *   "the county's own record"        for a city department's data
 *   "actual lot area of 0 sq ft"     for a parcel with 16,779 sq ft
 *   "$3.44/sq ft"                    a unit's value over a development's area
 *   "No land value is published"     under a panel showing $467,827
 *   tier A "crosses your land"       from a route nobody surveyed
 *
 * A unit test cannot catch these because each component was behaving as
 * written. What catches them is reading the rendered page for a real address,
 * so this does that at volume and checks the invariants mechanically.
 *
 * THE SAMPLE IS EACH COUNTY'S OWN SITUS ADDRESSES, the same ground truth
 * address-match-rate.mjs uses: the county asserts the address exists and
 * belongs to the parcel.
 *
 * Usage:  npx tsx experiments/report-sweep.mjs [baseUrl] [perCounty]
 *   e.g.  npx tsx experiments/report-sweep.mjs http://localhost:3131 8
 *
 * Findings are printed, not thrown. A finding is a thing to go and look at,
 * and some will be explicable; the point is that nothing is examined by
 * chance.
 */
const BASE = process.argv[2] ?? 'http://localhost:3131';
const PER_COUNTY = Number(process.argv[3] ?? '6');
const UA = 'SafeHomeValue/1.0 (internal report sweep)';

const j = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();

/**
 * A city name, never a blank one.
 *
 * `String(x || fallback).trim()` is not enough: a field holding "   " is
 * truthy, so it survives `||` and trims to "". Counties publish exactly that
 * — San Diego's SITUS_ZIP for 648 San Ysidro Blvd is ten spaces.
 */
function buildCity(value, fallback) {
  const t = String(value ?? '').trim();
  return t === '' ? fallback : t;
}

/** Each county's own addresses, with the fields needed to build a query. */
const COUNTIES = [
  {
    county: 'Los Angeles County',
    state: 'CA',
    url: 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query',
    fields: 'APN,SitusHouseNo,SitusDirection,SitusStreet,SitusCity,SitusZIP',
    // resultOffset needs a deterministic sort, and the APN is the natural one.
    orderBy: 'APN',
    where: "SitusStreet<>'' AND SitusHouseNo<>'' AND Roll_LandValue>0",
    build: (a) => ({
      street: [a.SitusHouseNo, (a.SitusDirection || '').trim(), a.SitusStreet].filter(Boolean).join(' '),
      city: buildCity(a.SitusCity, 'Los Angeles'),
      zip: String(a.SitusZIP || '').slice(0, 5),
    }),
  },
  {
    county: 'Orange County',
    state: 'CA',
    url: 'https://www.ocgis.com/arcpub/rest/services/LegalLotsAttributeOpenData/MapServer/0/query',
    fields: 'AssessmentNo,SiteAddress,SiteCityState,SiteZip5',
    orderBy: 'AssessmentNo',
    where: "SiteAddress<>'' AND SiteAddress NOT LIKE 'SITUS%' AND LandVal IS NOT NULL",
    build: (a) => ({
      street: a.SiteAddress,
      city: buildCity(String(a.SiteCityState ?? '').split(',')[0], 'Anaheim'),
      zip: String(a.SiteZip5 || ''),
    }),
  },
  {
    county: 'San Diego County',
    state: 'CA',
    url: 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query',
    fields: 'APN,SITUS_ADDRESS,SITUS_PRE_DIR,SITUS_STREET,SITUS_SUFFIX,SITUS_ZIP,SITUS_COMMUNITY',
    orderBy: 'APN',
    where: "SITUS_STREET<>'' AND SITUS_ADDRESS>0 AND ASR_LAND>0",
    build: (a) => ({
      street: [a.SITUS_ADDRESS, (a.SITUS_PRE_DIR || '').trim(), a.SITUS_STREET, (a.SITUS_SUFFIX || '').trim()]
        .filter(Boolean)
        .join(' '),
      /*
       * SITUS_COMMUNITY IS SOMETIMES BLANK, and `||` does not catch a string
       * of spaces — 648 San Ysidro Blvd publishes "" for the community and
       * "          " for the ZIP, so the sweep sent neither and the page
       * rightly asked for a city. A real user cannot submit a blank city, the
       * input being `required`, so sending one tested a path no reader walks.
       * buildCity falls back rather than sending nothing.
       */
      city: buildCity(a.SITUS_COMMUNITY, 'San Diego'),
      zip: String(a.SITUS_ZIP || '').trim().slice(0, 5),
    }),
  },
  {
    county: 'Cook County',
    state: 'IL',
    url: 'https://gis12.cookcountyil.gov/traditional/rest/services/CookViewer3Parcels/MapServer/0/query',
    fields: 'PIN14_dash,street_address,CITYNAME,ZIP1',
    orderBy: 'PIN14_dash',
    where: "street_address<>'' AND CURRENTVALUE_LAND>0",
    build: (a) => ({
      street: a.street_address,
      city: buildCity(a.CITYNAME, 'Chicago'),
      zip: String(a.ZIP1 || ''),
    }),
  },
];

/** A rotation of easement types, so the sweep is not all one code path. */
const TYPES = [
  'utility-overhead',
  'sewer',
  'drainage',
  'access-ingress-egress',
  'prescriptive',
  'conservation',
  'slope',
  'public-right-of-way',
];

/**
 * What the page must never say.
 *
 * Each check gets the tag-stripped text. A check returns a string to report a
 * finding, or null. Ordered roughly by how badly a hit would mislead.
 */
const CHECKS = [
  {
    name: 'figure-is-zero',
    /*
     * The Cook bug's visible symptom. THE DECIMAL GUARD IS LOAD-BEARING: the
     * first version used /\$0(\.00)?\b/, whose \b is satisfied by the dot in
     * "$0.35", so it fired on all six Cook reports and reported a zero that
     * was not there. A real zero is $0, $0.00, or 0 sq ft — never $0.35.
     */
    test: (t) => {
      const m = t.match(/(?:\$0(?:\.00)?(?![.\d])|(?<![.\d])\b0 sq ft\b)/);
      return m ? `renders ${JSON.stringify(m[0])} as a figure` : null;
    },
  },
  {
    name: 'area-exceeds-lot',
    test: (t) => (/exceeds this parcel/.test(t) ? 'the easement-exceeds-lot branch fired' : null),
  },
  {
    name: 'placeholder-leaked',
    test: (t) => {
      const m = t.match(/\b(NaN|undefined|null|Infinity|NOT AVAILABLE|\[object Object\])\b/);
      return m ? `leaks ${JSON.stringify(m[0])}` : null;
    },
  },
  {
    name: 'contradicts-itself',
    // A dollar range and a refusal to give one must not both appear.
    test: (t) =>
      /\$[0-9][0-9,]{2,}\s*(?:–|-|to)\s*\$[0-9][0-9,]{2,}/.test(t) &&
      /(No land value is published|not estimated for this parcel)/.test(t)
        ? 'shows a dollar range and says one cannot be given'
        : null,
  },
  {
    name: 'wrong-level-of-government',
    test: (t) => (/the county.s own record/i.test(t) ? 'attributes any publisher to "the county"' : null),
  },
  {
    name: 'shared-lot-priced',
    // The condominium defect: a shared lot must never carry a derived price.
    test: (t) =>
      /Shared lot area/.test(t) && /\$[0-9.]+\/sq ft = \$/.test(t)
        ? 'derives a land price from a shared development lot'
        : null,
  },
  {
    name: 'shared-lot-unexplained',
    test: (t) =>
      /Shared lot area/.test(t) && !/whole development.s, not yours alone/.test(t)
        ? 'labels a shared lot without the caveat that explains it'
        : null,
  },
  {
    name: 'inferred-geometry-tiered',
    // An inferred alignment must never reach tier A or B wording.
    test: (t) =>
      /inferred rather than surveyed/.test(t) && /(crosses or sits on the land|within 15 ft of the parcel boundary)/.test(t)
        ? 'builds an on-parcel claim from inferred geometry'
        : null,
  },
  {
    name: 'missing-limits-section',
    test: (t) => (isPicker(t) || /What this (tool|report)/i.test(t) ? null : 'no limits section found'),
  },
  {
    name: 'suspiciously-short',
    /*
     * A truncated page means a section was suppressed, which is how the Cook
     * zero-area bug presented: 24,671 bytes where a report is ~130,000.
     *
     * THE PICKER IS EXEMPT, and leaving it out cost two false findings on the
     * first run. When several parcels share a street address — 850 Del Mar
     * Downs Rd has three — the product shows the candidate list rather than
     * guessing, and that page is legitimately short. Scoring it as a
     * suppressed report marks the refusal to guess as a defect, which is the
     * same mistake the address match-rate metric made.
     */
    test: (t, html) => (isPicker(t) || html.length >= 60000 ? null : `page is only ${html.length} bytes`),
  },
];

/**
 * Pages that are legitimately short, and so are not suppressed reports.
 *
 * THE PICKER. When several parcels share a street address — 850 Del Mar Downs
 * Rd has three — the product shows the candidate list rather than guessing.
 * Scoring that as a defect is the same mistake the address match-rate metric
 * made before it was corrected.
 *
 * THE REQUEST FOR MORE INPUT. A county row with a blank situs city makes this
 * sweep send none, and the page then asks for one. That is correct, and
 * `buildCity` now avoids sending a blank in the first place, so this arm
 * should rarely fire — but a check that reports correct behaviour as a
 * finding gets ignored, and then so do the real ones.
 */
function isPicker(text) {
  return (
    /(more than one parcel|which parcel|several parcels|choose|select the parcel)/i.test(text) ||
    /This needs the (city|street)/i.test(text)
  );
}

/**
 * Fetches rows from a county, tolerating a service that declines.
 *
 * THE OFFSET IS WHY THIS IS NOT 20 REPORTS ABOUT ONE STREET. A plain
 * resultRecordCount returns the first N rows in layer order, which is
 * physical order, so the first 80-report run tested twenty Cook addresses on
 * 223rd and 224th St in Sauk Village and reported a count that implied far
 * more coverage than it had. A random offset per county per run walks a
 * different slice each time, so repeated runs accumulate breadth instead of
 * re-checking one neighbourhood.
 */
async function sample(c) {
  const offset = Math.floor(Math.random() * 40000);
  const u = `${c.url}?${new URLSearchParams({
    f: 'json',
    where: c.where,
    outFields: c.fields,
    returnGeometry: 'false',
    orderByFields: c.orderBy,
    resultOffset: String(offset),
    resultRecordCount: String(PER_COUNTY),
  })}`;
  try {
    const d = await j(u);
    if (d.error) return { rows: [], note: JSON.stringify(d.error).slice(0, 110) };
    return { rows: (d.features ?? []).map((f) => c.build(f.attributes)), note: null };
  } catch (e) {
    return { rows: [], note: String(e).slice(0, 110) };
  }
}

let checked = 0;
let clean = 0;
const findings = [];
let typeIndex = 0;

for (const c of COUNTIES) {
  const { rows, note } = await sample(c);
  console.log(`\n=== ${c.county}  (${rows.length} addresses)${note ? `  [${note}]` : ''}`);
  for (const row of rows) {
    if (!row.street || !row.street.trim()) continue;
    const easementType = TYPES[typeIndex++ % TYPES.length];
    const qs = new URLSearchParams({
      street: row.street,
      city: row.city,
      state: c.state,
      zip: row.zip,
      easementType,
      submitted: '1',
    });
    let html;
    try {
      const res = await fetch(`${BASE}/report?${qs}`, { headers: { 'User-Agent': UA } });
      html = await res.text();
      if (!res.ok) {
        findings.push({ county: c.county, addr: row.street, easementType, name: 'http-error', why: `HTTP ${res.status}` });
        console.log(`  !! ${row.street.padEnd(28)} HTTP ${res.status}`);
        continue;
      }
    } catch (e) {
      findings.push({ county: c.county, addr: row.street, easementType, name: 'fetch-failed', why: String(e).slice(0, 80) });
      continue;
    }
    checked++;
    /*
     * SCRIPTS COME OUT FIRST, and the first run of this sweep is why. React's
     * streaming payload is a series of self.__next_f.push([1,"..."]) calls
     * carrying the serialised tree, which is full of literal `null`s for
     * absent props. Stripping tags alone left that in, so the placeholder
     * check fired on all 24 reports — a finding about the harness, not the
     * product. What a reader sees is the only thing worth checking.
     */
    const text = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&rsquo;|&#8217;/g, '’')
      .replace(/\s+/g, ' ');
    const hits = CHECKS.map((k) => {
      const why = k.test(text, html);
      return why ? { name: k.name, why } : null;
    }).filter(Boolean);
    if (hits.length === 0) {
      clean++;
      console.log(`  ok ${row.street.slice(0, 28).padEnd(28)} ${easementType.padEnd(22)} ${html.length} bytes`);
    } else {
      for (const h of hits) findings.push({ county: c.county, addr: row.street, easementType, ...h });
      console.log(
        `  !! ${row.street.slice(0, 28).padEnd(28)} ${easementType.padEnd(22)} ${hits.map((h) => h.name).join(', ')}`,
      );
    }
  }
}

console.log(`\n${'='.repeat(72)}`);
console.log(`${checked} reports rendered, ${clean} clean, ${findings.length} findings`);
if (findings.length > 0) {
  const byName = new Map();
  for (const f of findings) {
    if (!byName.has(f.name)) byName.set(f.name, []);
    byName.get(f.name).push(f);
  }
  for (const [name, fs] of [...byName.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${name}  (${fs.length})`);
    console.log(`   ${fs[0].why}`);
    for (const f of fs.slice(0, 5)) console.log(`   - ${f.county}: ${f.addr} [${f.easementType}]`);
    if (fs.length > 5) console.log(`   ... and ${fs.length - 5} more`);
  }
}
