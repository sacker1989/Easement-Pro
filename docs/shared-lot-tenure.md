# When the lot area is not the owner's lot

**Measured 2026-10-15.** Reproduce with
`npx tsx experiments/tenure-all-counties.mjs` and
`npx tsx experiments/tenure-mappers.mjs`.

Every one of the four counties publishes **one unit's land value against the
whole development's land area**, and every unit in a project carries the same
area. The product divided one by the other to get a price per square foot,
and multiplied that by the easement area.

## What it was doing

| address | land value | lot area | derived | should be about |
|---|---|---|---|---|
| 222 N Columbus Dr, Chicago | $2,103 | 41,068 sq ft | **$0.03/sq ft** | a downtown tower's land share |
| 142 Paramount, Irvine | $467,827 | 135,871 sq ft | **$3.44/sq ft** | $73/sq ft, per the fee lot below |
| 1135 W Brook St, Santa Ana | $493,348 | 6,756 sq ft | $73.02/sq ft | correct — a real lot |

The denominators are the giveaway. All 489 parcels in Orange's `930-18` book
publish 135,871.237 sq ft. All 147 parcels at 253 10th in San Diego publish
42,841 sq ft against 119 different land values. Seventeen parcels at 5053
109th St in LA publish 26,157 sq ft against fifteen.

## Scope

| county | detection signal | affected | of |
|---|---|---|---|
| Cook | PIN's last four digits ≠ `0000` | **464,428** | 1,865,928 |
| San Diego | `LEGLDESC` matches `UND … INT` | **265,453** | 1,088,869 |
| Los Angeles | `LegalDescription` matches `CONDO` | **175,129** | 2,433,213 |
| Orange | `LegalDescr` matches `UND … INT` | **166,052** | 894,009 addressed |

Roughly 1.07 million parcels.

## Three of the four obvious signals are wrong

This is the part worth keeping. Each county has a field that looks like the
answer, and only one of them is.

**LA's unit number over-fires.** 279,408 parcels carry one, and plenty are
not condominiums — 1833 10th Ave has three parcels of 2,005, 2,017 and 3,124
sq ft, separate lots whose addresses carry unit letters, whose valuations are
perfectly sound. Suppressing on the unit number would refuse a figure to a
large share of them for nothing.

**San Diego's `FRACTINT` looks purpose-built and means the opposite.** It is
populated on 1,087,812 of 1,088,869 parcels and reads `1` on an ordinary
single-family lot: it marks a *whole* interest.

**San Diego's suite number is wrong in both directions.** 129,926 undivided
parcels carry no suite — half the population missed — and 51,341
suite-numbered parcels declare none. One of the latter sits at 253 10th among
147 units: `BLK 204*LOT 15*`, 6,867 sq ft, a separate lot that merely shares
a street address.

**Orange's APN prefix is wrong both ways too.** 9,305 non-`9xx` parcels hold
a fractional interest and 30,972 `9xx` parcels do not.

**Matching the word "CONDO" is wrong in two counties.** Orange says
`PROJECT` as often as `CONDO PROJECT` — only 32,053 addressed parcels say
CONDO while 166,052 declare an undivided interest — and San Diego never uses
the word at all, in zero rows.

What works is what the county recorded about the **estate**:

```
LA        "TR=72771 LOT 1 CONDO UNIT 1 (AIRSPACE AND 1/17 INT IN COMMON AREA)"
          "TRACT NO 25040 LOT   99"                       <- fee, excluded
Orange    "...OF CONDO PROJECT 930-18 ... TOGETHER WITH AN UND 1/12 INT..."
          "P-BOOK: 381 PAGE: 23 PAR: 2"                   <- fee, excluded
San Diego "LOT 2*US222PER DOC06-519859&UND INT IN\"
          "PAR 4\"                                        <- fee, excluded
Cook      PIN 17-10-316-033-1307 (unit 1307) vs ...-0000  <- county's encoding
```

## What the product does instead

It refuses, and says why. `landValuePerSqFt` is set to 0, which routes into
the refusal paths that already existed for a county publishing no land value
at all — the same refusal, tested in the same place.

**It does not compute the fraction.** The legal description hands over
`1/12`, so 11,322 sq ft is one multiplication away. An easement over common
area burdens the development rather than one unit, and what an individual
owner is owed turns on the recorded declaration and the CC&Rs. A number
derived by dividing by twelve would read exactly like a measured one.

Three things had to change beyond the arithmetic, and each was only visible
in the rendered page:

1. **The refusal was silent.** A reader seeing a lot area and a land value on
   one page will ask why they cannot be combined. `UNDIVIDED_INTEREST_CAVEAT`
   answers that, attached at the dispatch funnel so a fifth county cannot
   forget it.
2. **The sentence it showed was false.** The only reason the module had read
   "No land value is published for this address… your county assessor
   publishes an assessed land value — that is the number this needs",
   printed directly beneath a panel displaying $467,827. The county has the
   figure; what it lacks is a lot area belonging to that owner.
3. **The label still said "Lot area".** It now says "Shared lot area (whole
   development)", because a caveat further down does not undo a row heading.

## A zero price nearly became a $0 range

`resolvePricePerSqFt`'s `assessorValuation` branch returned whatever it found
without checking the sign, by way of `marketAdjustParcel`, which indexes 0
forward to 0. The output would have been `status: 'range'` with a band around
zero — "your easement is worth $0" — which is a far more confident claim than
"no estimate is possible". The guard now sits at the resolver's exit rather
than in each branch.

## Limits

- **San Diego's `LEGLDESC` is fixed-width and truncates near 64 characters**,
  so a unit whose `UND INT` phrase falls past the cut is missed. That
  under-detects, which costs a reader a caveat rather than handing them a
  wrong number.
- **Orange's 30,972 `9xx` parcels with no undivided-interest wording** were
  not identified. Some are probably common-interest units worded a third way.
- **A condominium address returns `ambiguous`**, because many units share one
  street address and the product offers the candidate list rather than
  guessing. Tenure is reported after a candidate is chosen, which is why
  `experiments/tenure-mappers.mjs` exercises the mappers directly.
- **No fractional share is ever reported**, so a unit owner gets no dollar
  figure from this product at all. That is the intended outcome and it is
  also a real gap: the answer exists, in their declaration.
