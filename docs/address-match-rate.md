# Does a real address find the right parcel?

**Measured 2026-10-15.** Reproduce with
`npx tsx experiments/address-match-rate.mjs`.

Four address parsers were repaired on 2026-10-11, each after being found to
miss real parcels. None had ever been measured.

## Method

The sample is **each county's own situs addresses** — the fairest ground
truth available, because the county is asserting that this address exists and
belongs to this parcel. If the product cannot find a parcel back from the
county's own spelling, nothing a homeowner types will do better.

25 addresses per county, each tried four ways: as the county spells it, lower
case, suffix spelled out ("Street" for "ST"), and with the suffix dropped.

The test is **APN equality**, not "found something". A lookup returning the
neighbour's parcel is worse than one returning nothing, and a found/not-found
metric scores it as a success.

## Result

| county | reaches the parcel | exact first hit | needs the picker | wrong parcel |
|---|---|---|---|---|
| Los Angeles | **100%** | 100% | 0% | 0 |
| Orange | **100%** | 72–80% | 20–28% | 0 |
| San Diego | **96%** | 72% | 24% | 0 |
| Cook | **100%** | 64–100% | 0–36% | 0 |

Across 400 lookups: **one** address failed to reach its parcel, and **no
lookup ever returned the wrong one**.

Suffix handling is solid everywhere except Cook, where dropping the suffix
moves 9 of 25 from an exact hit to the disambiguation screen — they still
reach the parcel, with one extra click.

## The metric was wrong first, and it maligned the product

The first run reported Orange at 80% and San Diego at 72%, counting
`ambiguous` as a failure. It is not one. Several parcels genuinely share a
street address — condo units, duplexes — and the product returns the
candidate list rather than guessing which is yours. That refusal is a design
decision the codebase makes deliberately, and scoring it as a defect
understated San Diego by 24 points.

The corrected metric asks what a reader experiences: either the report opens
on their parcel, or the picker lists it and they click once. Both get them
there. It only counts if the true APN is actually in the list shown.

Orange's five "failures" were also an artifact: the county publishes the
literal string `SITUS NA` for parcels with no address, and the sample had
picked five of them. Not addresses, so not a product failure. They are
excluded by name now.

## Limits

- **25 per county** is enough to find a systematic parser fault and not
  enough to estimate a true rate to within a few points.
- **The sample is the county's own spelling**, which is the easy case. Real
  users mistype, abbreviate oddly, use a former street name, or give an
  address the assessor never recorded. This measures the floor, not the field.
- **Cities are not tested.** The product serves four counties; an address in
  a city whose parcels the county does not publish is out of scope here.
- **One genuine miss in San Diego** was not diagnosed. Worth a look if the
  outcome log shows `county-parcel` degraded rates rising there.
