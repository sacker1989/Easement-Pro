# Does infrastructure proximity predict a recorded easement?

**Measured 2026-10-15.** Reproduce with
`npx tsx experiments/lawrence-easement-calibration.mjs`.

The evidence tier has been in the product since before it rendered to anyone,
and the claim behind it — that infrastructure near a parcel is evidence worth
chasing about a possible easement — had never been tested. This is the test.

## Why Lawrence, Kansas

Calibration needs ground truth: parcels where an easement is known to exist.
**None of the four counties the product serves publishes one.** That is
recorded in `open-data-source-assessment.md` and was re-confirmed this week.

Lawrence publishes all three pieces on one ArcGIS org: 14,423 recorded
easement polygons (plat-derived, with book, page and width), 41,800 parcels,
and the utility networks — 20,337 stormwater lines and 40,528 water pipes.

## Method

Three disjoint study areas, every layer paged to exhaustion. For each parcel:

- **ground truth** — does a recorded easement polygon overlap its interior?
- **predictor** — nearest utility line to the parcel boundary, fed through the
  product's own `assessEvidenceTier`

2,702 parcels.

## Result

| tier | n | with a recorded easement | rate | vs base |
|---|---|---|---|---|
| A — crosses the parcel | 1,053 | 995 | **94%** | +5 pts |
| B — within 15 ft | 1,404 | 1,233 | **88%** | −2 pts |
| C — further away | 245 | 191 | **78%** | −12 pts |
| **all** | **2,702** | **2,419** | **90%** | — |

## What it says

**1. Easements are the norm, not the exception.** Ninety per cent of parcels
in a platted suburban county carry a recorded easement overlapping the lot.
This is the most useful number the experiment produced and it has nothing to
do with the tier: for most homeowners the question is not *whether* they have
an easement but *what theirs says*.

**2. The tier discriminates, but weakly.** It is monotonic — 94, 88, 78 — so
proximity does carry signal. But the whole range spans 16 points against a
90% base, and **78% of tier-C parcels still have a recorded easement**. The
tier is not a test for whether an easement exists, and must never be
presented as one.

**3. Tier C is the dangerous one to misread.** The copy says "No encumbrance
on this parcel is implied", which is accurate about *that infrastructure* and
easy to read as "you probably have no easement". Four out of five tier-C
parcels here did.

## Two method traps, both of which bit

The first run reported **87 / 67 / 43** — a strong-looking gradient, and
wrong. A flat `resultRecordCount` had truncated water pipes to 2,000 of 7,162
and easements to 2,000 of 3,005, starving tier C of both predictor and ground
truth. Paging to exhaustion collapsed it to 94 / 88 / 78. **Truncation
manufactures signal**, and it did so in the direction that flattered the
feature.

The second: plat easements are drawn along lot lines, so a touching test
marks nearly every parcel burdened by construction. Requiring strict interior
overlap changed the result by under a point — which is itself informative.
These strips sit inside the lot, not beside it.

## Limits

- **One city.** Lawrence's platting convention may not be California's. The
  90% should not be quoted for LA without measuring LA, which cannot be done
  until a California county publishes easements.
- **Utility lines are a proxy** for the infrastructure a reader cares about,
  and Lawrence's networks are better mapped than OpenStreetMap is anywhere
  the product actually runs.
- **Association is not provenance.** A parcel with a nearby pipe and a
  recorded easement does not establish that the easement is *for* that pipe.

## What should change

1. Tell readers the base rate where it has been measured, with the citation.
   "Most platted lots carry at least one recorded easement" is true, useful,
   and reframes the product from *do I have one* to *what does mine say*.
2. Do not strengthen the tier copy. If anything tier C needs a sentence
   noting that no infrastructure nearby is not evidence of no easement.
3. Do not quote 90% as a national or Californian figure. It is Lawrence.
