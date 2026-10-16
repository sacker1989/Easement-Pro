/**
 * Where does "$0" come from on every Cook County report?
 *
 * report-sweep.mjs flagged all six sampled Cook addresses, and the sample
 * query required CURRENTVALUE_LAND > 0, so the land value is not the zero.
 */
const BASE = process.argv[2] ?? 'http://localhost:3131';
const UA = 'SafeHomeValue/1.0 (internal report sweep)';

const q = new URLSearchParams({
  street: '3160 223RD ST',
  city: 'Sauk Village',
  state: 'IL',
  zip: '60411',
  easementType: 'drainage',
  submitted: '1',
});

const html = await (await fetch(`${BASE}/report?${q}`, { headers: { 'User-Agent': UA } })).text();
const text = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, '|')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/&rsquo;|&#8217;/g, '’');

// Every $0 occurrence with the surrounding cells, so its label is visible.
const parts = text.split('|').map((s) => s.replace(/\s+/g, ' ').trim());
console.log(`page ${html.length} bytes, ${parts.length} text nodes\n`);
parts.forEach((p, i) => {
  if (!/\$0(\.00)?\b|(^|\s)0 sq ft\b/.test(p)) return;
  const before = parts.slice(Math.max(0, i - 4), i).filter(Boolean).slice(-3);
  console.log(`  [${i}] ${JSON.stringify(p.slice(0, 90))}`);
  console.log(`      preceded by: ${JSON.stringify(before.join(' / ').slice(0, 130))}`);
});
