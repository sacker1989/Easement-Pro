/**
 * Are Cook County's published values market values or assessed values?
 *
 * The report prices from CURRENTVALUE_LAND / LANDSF and labels the result
 * "Verified against the Cook County assessment roll". If those figures are
 * assessed at a statutory fraction, the dollar amount the reader sees is low
 * by that fraction, and the product's purpose — telling someone whether a
 * claim is worth a professional's time — is defeated rather than served.
 *
 * ONE ROW IS NOT EVIDENCE. 3160 223rd St publishes a total of $9,267 for a
 * 1,376 sq ft house, which is obviously not a market price, but a single
 * parcel could be an oddity. This samples the distribution across residential
 * classes and several townships.
 */
const UA = 'SafeHomeValue/1.0 (easement research)';
const j = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();
const Q = 'https://gis12.cookcountyil.gov/traditional/rest/services/CookViewer3Parcels/MapServer/0/query';

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
};

for (const town of ['Sauk Village', 'Evanston', 'Winnetka', 'Chicago']) {
  const d = await j(
    `${Q}?${new URLSearchParams({
      f: 'json',
      where: `CITYNAME='${town.toUpperCase()}' AND major_class_description='Residential' AND CURRENTVALUE_TOTAL>0 AND BLDGSQFT>400`,
      outFields: 'CURRENTVALUE_TOTAL,CURRENTVALUE_LAND,LANDSF,BLDGSQFT,BCLASS',
      returnGeometry: 'false',
      resultRecordCount: '200',
    })}`,
  );
  const rows = (d.features ?? []).map((f) => f.attributes);
  if (rows.length === 0) {
    console.log(`${town.padEnd(14)} no rows`);
    continue;
  }
  const totals = rows.map((r) => Number(r.CURRENTVALUE_TOTAL) || 0);
  const perLandSqFt = rows
    .filter((r) => Number(r.LANDSF) > 0)
    .map((r) => Number(r.CURRENTVALUE_LAND) / Number(r.LANDSF));
  const classes = [...new Set(rows.map((r) => r.BCLASS))].slice(0, 5).join(',');
  console.log(
    `${town.padEnd(14)} n=${String(rows.length).padStart(3)}  median total $${median(totals).toLocaleString().padStart(9)}` +
      `  median land $/sqft ${median(perLandSqFt).toFixed(2).padStart(7)}  classes ${classes}`,
  );
}

console.log(
  '\nA median total in the low tens of thousands for an occupied single-family\n' +
    'house is an assessed figure, not a market one. Cook publishes BCLASS and\n' +
    'major_class_description on every row, so the class is available.',
);
