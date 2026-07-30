# Validation — San Diego `DOCDATE` as a Proposition 13 reassessment-vintage proxy

**Date:** 2026-07-30
**Status:** validated with named caveats — usable, but it is a proxy, not a published base year
**Source layer:** `gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0`

---

## 1. Why this matters

`market-index.ts` restates a Prop 13-frozen assessment in present-day terms, and it needs a base
year. LA County publishes one (`Roll_LandBaseYear`). Orange County publishes none, and probing
established that no vintage field exists anywhere in its public GIS
([spec §3.4](./spec-easement-valuation.md)), which is why Orange County is blocked.

San Diego publishes `DOCDATE` — the recording date of the parcel's document, MMDDYY, populated on
**1,088,673 of 1,089,648 parcels**. Under Prop 13 a change of ownership triggers reassessment, so if
`DOCDATE` is the conveying-deed date it should behave like a base year. This tests that.

A first pass found a suggestive 1.48x land-share drift but was rejected as evidence: samples were
OID-ordered rather than random, uncontrolled for location, thin in older years, and non-monotonic in
the middle. All four are fixed here.

## 2. Method

- **Complete enumeration, not sampling.** The layer supports `supportsPagination`, so every matching
  parcel in each ZIP was retrieved by paging. There is no sampling bias to argue about.
- **Controlled** to `ASR_LANDUSE=11` (the dominant residential code, 570,819 parcels countywide — the
  first pass used code 10, which has only 7,469, hence its thin cells) with `ASR_LAND>0`,
  `ASR_IMPR>0`, `TOTAL_LVG_AREA>200`, within single ZIPs.
- **Normalised** to assessed dollars per square foot of living area, so a bucket cannot look richer
  merely by containing bigger houses.
- 8 ZIPs spanning the county's price range; **97,026 parcels** pooled.
- Years bucketed ±2 around 1990/1995/2000/2005/2010/2015/2020/2024. Century pivot at 26.

## 3. Result

Pooled, by `DOCDATE` bucket:

| bucket | n | assessed $/living sq ft | land share | median living sq ft |
|---|---|---|---|---|
| 1990 | 1,374 | 187 | 0.361 | 1,446 |
| 1995 | 2,180 | 174 | 0.369 | 1,528 |
| 2000 | 4,940 | 207 | 0.383 | 1,627 |
| 2005 | 8,580 | 252 | 0.413 | 1,658 |
| 2010 | 10,772 | 250 | 0.448 | 1,730 |
| 2015 | 17,855 | 315 | 0.469 | 1,758 |
| 2020 | 29,779 | 382 | 0.528 | 1,722 |
| 2024 | 21,546 | 409 | 0.567 | 1,681 |

**Assessed value rises 2.18x with `DOCDATE` recency. Land share rises monotonically in all 7 steps,
0.361 → 0.567** — the same direction and a similar magnitude to the LA base-year drift measured in
[spec §3.1](./spec-easement-valuation.md).

### The control that matters

Median **effective year built is flat within each ZIP** across every bucket — 92117 sits at 60 in all
eight, 92126 at ~74-75, 92064 at ~74. The housing stock is the same age regardless of `DOCDATE`, so
the value gradient is not newer construction. Median living area moves only ~16% and
non-monotonically, against a 2.18x value signal.

**Exception:** 92130 (Carmel Valley) shows effective year built jumping from 85-88 in old buckets to
16-19 in recent ones — genuinely newer construction, so `DOCDATE` recency there is partly confounded
with new builds. New-growth ZIPs need this checked before use.

### `DOCTYPE` sharpens it

Both document types rise monotonically (4/4 decades, both ZIPs tested), but `DOCTYPE=1` sits
consistently **1.5-1.75x above `DOCTYPE=2`** at every decade:

| decade | 92117 type 1 | 92117 type 2 | 92064 type 1 | 92064 type 2 |
|---|---|---|---|---|
| 1990s | 213 | 121 | 214 | 156 |
| 2020s | 581 | 313 | 485 | 343 |

Consistent with `DOCTYPE=1` being full-value transfers that trigger complete reassessment, and
`DOCTYPE=2` capturing Prop 13-**excluded** transfers (parent-child, spousal, trust) that preserve the
prior basis. **Prefer `DOCTYPE=1` when using `DOCDATE` as a vintage.** This interpretation of the
codes is inferred from behaviour, not from published county documentation, and should be confirmed.

## 4. Independent check against FHFA

FHFA annual tract HPI, median across San Diego County tracts (FIPS 06073), 1990=100:

| year | 1990 | 1995 | 2000 | 2005 | 2010 | 2015 | 2020 | 2024 |
|---|---|---|---|---|---|---|---|---|
| HPI | 100.0 | 89.8 | 129.1 | 271.1 | 195.2 | 246.8 | 320.5 | 484.7 |
| tracts | 416 | 415 | 414 | 415 | 414 | 401 | **277** | |

**This resolves the first pass's "non-monotonic" objection.** The dips in assessed value at 1995 and
2010 land exactly on independently measured price troughs — the mid-1990s California decline and the
post-2008 crash. Non-monotonicity was the housing cycle showing through, which is what a
reassessment-date proxy *should* do. It was signal, not noise.

### The decisive test

If `DOCDATE` is the reassessment date, then `assessed₂₀₂₆ = market(Y) × 1.02^(2026−Y)` with
`market(Y) ∝ HPI(Y)`, so `assessed / [HPI(Y) × 1.02^(2026−Y)]` must be **constant** across buckets.

| bucket | assessed $/sf | HPI | 1.02^(2026−Y) | implied ratio |
|---|---|---|---|---|
| 1990 | 187 | 100.0 | 2.04 | 0.917 |
| 1995 | 174 | 89.8 | 1.85 | 1.049 |
| 2000 | 207 | 129.1 | 1.67 | 0.958 |
| **2005** | 252 | 271.1 | 1.52 | **0.613** |
| 2010 | 250 | 195.2 | 1.37 | 0.933 |
| 2015 | 315 | 246.8 | 1.24 | 1.026 |
| 2020 | 382 | 320.5 | 1.13 | 1.058 |
| **2024** | 409 | 484.7 | 1.04 | **0.811** |

**Six of eight buckets fall within 0.92–1.06 — a 1.15x spread.** That is close agreement for a model
with no fitted parameters. Overall spread is 1.73x against the 2.18x raw variation being explained.

### The two outliers, and the honesty about them

- **2005 (0.613).** 2005 was the bubble peak (HPI 271.1). Parcels bought then should carry the
  highest basis, and they do not. The likely mechanism is **Proposition 8 decline-in-value
  reassessment**, under which California assessors temporarily reduce assessments below the Prop 13
  basis when market value falls — applied en masse to bubble-era purchases after 2008, then restored
  only gradually. This is a real statutory mechanism and it predicts exactly this sign and location.
  **It is a post-hoc explanation and was not tested here.**
- **2024 (0.811).** The 2024 FHFA index rests on **277 tracts against ~415** in other years, so it is
  the least reliable point in the series. Purchase-date timing within the year against an annual
  average index also blurs the most recent bucket. (The comparison was first run against a
  still-downloading copy of the FHFA file, which would have produced exactly this kind of thin tail.
  It was re-run against the complete 89.9 MB file and every figure above is identical, so the 277
  count is a property of FHFA's data, not a truncation artefact.)

Two outliers with named plausible mechanisms is not the same as two outliers explained. Stated as an
open item, not a closed one.

## 5. Verdict

**`DOCDATE` is usable as a Prop 13 reassessment-vintage proxy for San Diego County, with caveats.**

Evidence for: monotonic land-share rise across all 7 steps; 2.18x assessed-value gradient with the
housing-stock control flat; dips coinciding with independently measured HPI troughs; a no-free-
parameter Prop 13 model agreeing within ±8% on six of eight buckets; and a `DOCTYPE` split that
behaves as Prop 13 exclusions predict.

**It is not equivalent to LA's published `Roll_LandBaseYear`, and must not be presented as one.** It
is the date of *a* recorded document, which usually but not always coincides with the reassessment
event. Required conditions for use:

1. Prefer `DOCTYPE=1`; treat `DOCTYPE=2` vintages as unreliable.
2. Check new-growth ZIPs (the 92130 pattern) where `DOCDATE` recency tracks new construction.
3. Expect Prop 8 distortion for 2004-2007 vintages specifically. Do not trust that cohort.
4. Confirm the `DOCTYPE` code meanings against county documentation before shipping.

## 6. Consequence for the product

San Diego becomes the **second county after LA** that can support a base-year-dependent method, and
it is the largest single coverage gain available — 987,889 parcels with assessed land values.

It does **not** unblock Orange County. The vintage lives in San Diego's own data; nothing here
transfers to a county that publishes no date at all.

## Reproduction

Scripts are in the session scratchpad, not committed: `sdvalidate.mjs` (enumeration and buckets),
`sddoctype.mjs` (DOCTYPE split), `fhfacmp.mjs` (FHFA comparison). FHFA source:
`https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv`, filtered to FIPS 06073, column
`hpi1990`.
