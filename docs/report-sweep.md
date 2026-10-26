# Reading the rendered page, at volume

```bash
npx next build && npx next start -p 3131
npx tsx experiments/report-sweep.mjs http://localhost:3131 12
```

## Why this exists

On 2026-10-15, five real defects were found by fetching the production HTML
for a single address and reading it. **1,647 unit tests passed through every
one of them.** None was a crash, a type error or a failing assertion. Each was
the page asserting something sourced and false:

| what it said | what was true |
|---|---|
| "the county's own record" | a city sanitation department's data |
| "actual lot area of 0 sq ft" | the parcel is 16,779 sq ft |
| "$3.44/sq ft" | a unit's land value over a development's area |
| "No land value is published" | printed beneath a panel showing $467,827 |
| tier A, "crosses the land" | a route reconstructed from aerial imagery |
| "Verified … (land value $0.35/sq ft)" | a statutory fraction of market value |

A unit test cannot catch these, because every component behaved as written.
What catches them is reading the page a homeowner would read. So this does
that against many real addresses and checks the invariants mechanically.

## Method

The sample is **each county's own situs addresses**, the same ground truth
`address-match-rate.mjs` uses: the county asserts the address exists and
belongs to the parcel. Easement types rotate so the sweep is not all one code
path.

Each rendered page is stripped of scripts and styles — not just of tags — and
checked against a list of things the page must never say: a figure that is
zero, a leaked `NaN`/`undefined`/`NOT AVAILABLE`, a dollar range beside a
refusal to give one, a shared development lot carrying a derived price, an
on-parcel claim built from inferred geometry, a missing limits section, a
suspiciously short page.

Findings are printed, not thrown. A finding is something to go and look at;
some are explicable. The point is that nothing is examined by chance.

## What it caught on its first runs

- **Illinois assessed values presented as land prices.** Cook County publishes
  a statutory fraction of market value, and the report multiplied it out and
  labeled the result "Verified". Fixed; see `shared-lot-tenure.md`'s sibling
  discussion in `economic-impact.ts`.
- **A validation error at the bottom of the page.** 648 San Ysidro Blvd
  rendered 21,000 bytes whose only actionable sentence, "city is required",
  sat below the form, below the easement explanation, level with the footer.

## Three of its own findings were its own fault

Worth recording, because a harness that cries wolf gets ignored and then so do
the real findings.

1. **It flagged all 24 reports for leaking `null`.** React's streaming payload
   is full of literal nulls for absent props, and stripping tags alone left
   the `<script>` contents in.
2. **It flagged all six Cook reports for rendering `$0`.** The pattern
   `/\$0(\.00)?\b/` matches inside `$0.35`, because `\b` is satisfied by the
   decimal point. That false positive is how the real Illinois issue was
   found — which is luck, not method.
3. **It flagged the disambiguation screen as a suppressed report.** 850 Del
   Mar Downs Rd genuinely has three parcels and the product shows the
   candidate list rather than guessing. Scoring that as a defect is exactly
   the mistake the address match-rate metric made before it was corrected.

## Limits

- **It tests invariants, not correctness.** A page can pass every check and
  still be wrong in a way nobody has thought to look for. Each check here was
  added after something shipped.
- **Sampling needs the offset.** A plain `resultRecordCount` returns rows in
  physical layer order, so the first 80-report run tested twenty Cook
  addresses on two adjacent streets. A random `resultOffset` per run spreads
  it; repeated runs accumulate breadth rather than re-checking one
  subdivision.
- **It does not check the arithmetic.** Whether $73.02/sq ft is the right
  price for that parcel is an appraiser's question, and no amount of sweeping
  answers it.
- **It needs the live county services**, so a county outage looks like a
  finding. The per-county note says when a sample could not be drawn.
