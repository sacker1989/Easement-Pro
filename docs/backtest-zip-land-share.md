# Back-test — ZIP current-regime land share (spec §3.2)

**Status:** measured, complete
**Run:** 2026-07-30, live against LA County parcel service, 90 HTTP requests, no 5xx observed
**Tests:** [`spec-easement-valuation.md`](./spec-easement-valuation.md) §3.2, closing validation gate §8.1
**Verdict up front:** the §3.2 *share correction* is confirmed and should be kept. The **end-to-end
method is not fit to ship as a point estimate.** The binding error is the ZIP-median market proxy,
not the land share, and it is worst exactly where the dollars are largest.

---

## 1. What was tested

Spec §3.2 predicts

```
predicted_land_value = (market value for the parcel) x (ZIP current-regime land share)
```

where the current-regime share is the median `Roll_LandValue / (Roll_LandValue + Roll_ImpValue)`
over same-ZIP, same-use-type parcels whose Prop 13 base year is recent, and the subject parcel's own
share is never used.

Because true market land value is never observed, the back-test uses the standard workaround: for
parcels reassessed within ~2 years of the current roll, the assessment approximates the transaction,
so `Roll_LandValue` stands in for ground truth. §7 states plainly what that substitution does and
does not license.

The error is decomposed into the two independent components and then recombined, so it is visible
which half of the chain is responsible.

---

## 2. Data and sample

Source: `https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query`

Current roll year on the service is **`Roll_Year` = 2026**.

| | definition | n |
|---|---|---|
| **Ground-truth set** | `Roll_LandBaseYear` in 2024–2026 (within 2 years of the roll) | **9,476** |
| **Stale set** (baseline only) | `Roll_LandBaseYear` in 1975–2005 | **61,295** |

Both sets filtered to `UseType='Residential'`, `UseCode IN ('0100','0101')` (single-family detached,
with and without pool), `Roll_LandValue>0 AND Roll_ImpValue>0`.

Condos (`010C`/`010D`/`010E`, 35,500 of the 170k recent residential parcels county-wide) are
**excluded**: their `Shape.STArea()` is the whole common-area footprint, so land $/sq ft — the
product's actual output — is not defined for them. That is a real coverage gap, not a nuisance: the
method as specced has nothing to say about roughly a fifth of LA residential parcels.

16 ZIPs, chosen to span the county's price range (ZIP median assessed total $459k to $5.61M) and
its geography — Antelope Valley, South LA, Long Beach/Harbor, San Fernando Valley, San Gabriel
Valley, South Bay, Westside. Minimum cell size **n ≥ 30** for a ZIP to be used; all 16 cleared it by
a wide margin (smallest cell n=183).

| ZIP | area | n recent | n stale | ZIP median total | current-regime share | stale-cohort share | median lot sq ft |
|---|---|---|---|---|---|---|---|
| 93550 | Palmdale | 1,321 | 4,400 | $459,000 | 0.386 | 0.200 | 7,064 |
| 90059 | Watts | 406 | 2,131 | $600,781 | 0.700 | 0.488 | 5,309 |
| 91768 | Pomona | 269 | 2,076 | $682,380 | 0.724 | 0.459 | 7,232 |
| 90805 | N Long Beach | 692 | 5,027 | $713,868 | 0.775 | 0.570 | 5,174 |
| 91331 | Pacoima | 859 | 6,902 | $744,600 | 0.700 | 0.457 | 7,087 |
| 90731 | San Pedro | 457 | 2,999 | $850,000 | 0.814 | 0.646 | 5,005 |
| 90250 | Hawthorne | 517 | 4,646 | $872,100 | 0.800 | 0.637 | 5,452 |
| 91307 | West Hills | 547 | 3,296 | $1,000,000 | 0.724 | 0.443 | 7,798 |
| 91344 | Granada Hills | 1,016 | 6,236 | $1,025,100 | 0.700 | 0.434 | 8,512 |
| 91789 | Walnut | 622 | 6,218 | $1,153,008 | 0.700 | 0.400 | 9,697 |
| 90042 | Highland Park | 617 | 3,642 | $1,154,000 | 0.718 | 0.627 | 5,592 |
| 90503 | Torrance | 462 | 4,110 | $1,374,164 | 0.800 | 0.658 | 5,851 |
| 90045 | Westchester | 665 | 4,006 | $1,581,000 | 0.738 | 0.638 | 6,198 |
| 91106 | Pasadena | 183 | 1,152 | $1,986,756 | 0.700 | 0.622 | 10,573 |
| 90272 | Pacific Palisades | 231 | 1,357 | $3,810,332 | 0.799 | 0.592 | 12,598 |
| 90210 | Beverly Hills | 612 | 3,097 | $5,610,000 | 0.800 | 0.638 | 17,082 |

The current-regime vs stale-cohort columns independently reproduce the §3.1 finding in all 16 ZIPs:
older base year, lower land share, every time.

---

## 3. How ground-truth leakage was avoided

**Exact leave-one-out, not a held-out split.** For each subject parcel *i* in ZIP *z*, every
ZIP-level statistic is the median over `G_z \ {i}` — the subject is removed from the array before the
median is taken, and the median of the remaining *n*−1 is computed exactly (not approximated by
re-using the full-sample median). This applies to all three ZIP statistics used: the current-regime
land share, the ZIP median total, and the ZIP median land $/sq ft.

Without this, a subject parcel sitting at its ZIP's median would have its own `Roll_LandValue`
appear on both sides of the comparison. With n as low as 183 in 91106 that is not a rounding-error
concern.

The stale-cohort baseline (§6) needs no LOO treatment: the stale set (base year ≤ 2005) and the
ground-truth set (base year ≥ 2024) are disjoint by construction.

---

## 4. Error decomposition

All figures are absolute percentage error, `|predicted − actual| / actual`, pooled across all 9,476
ground-truth parcels. Per-ZIP breakdowns follow in §4.4.

### 4.1 Component 1 — land-share error, isolated

`predicted = (parcel's own Roll_LandValue + Roll_ImpValue) × ZIP current-regime share (LOO)`
compared against the parcel's actual `Roll_LandValue`. Using the parcel's own total eliminates
market-value error by construction, so what remains is purely the cost of substituting a
neighbourhood share for the parcel's own.

| | n | p10 | p25 | **p50** | p75 | p90 | p95 | mean |
|---|---|---|---|---|---|---|---|---|
| all 16 ZIPs | 9,476 | 0.6% | 3.8% | **10.0%** | 17.5% | 44.9% | 54.3% | 17.6% |
| excl. 93550 | 8,155 | — | 3.4% | **8.4%** | 14.7% | 21.6% | — | — |

84.3% of parcels within ±25%; 92.5% within ±50%. Median signed error 0.0% — no bias.

**This component is well-behaved.** Outside Palmdale the p90 is 21.6%, i.e. the tail is tight.

### 4.2 Component 2 — market-proxy error, isolated

`predicted = ZIP median of (Roll_LandValue + Roll_ImpValue) over recently-reassessed parcels (LOO)`
compared against the parcel's own actual total.

**Proxy-for-a-proxy disclosure:** this uses the assessed totals of recently-reassessed parcels as the
ZIP market level rather than downloading Redfin `MEDIAN_SALE_PRICE`. It measures the right thing —
how badly a ZIP-level central tendency misses an individual parcel — but the ZIP level itself is
LA's assessment roll, not Redfin's closed sales. Redfin's median would sit at a slightly different
level and would be built from that month's sales rather than the trailing ~2 years of them.
Dispersion around the median, which is what this component actually measures, is a property of the
housing stock and should carry over; the level offset would not.

| | n | p10 | p25 | **p50** | p75 | p90 | p95 | mean |
|---|---|---|---|---|---|---|---|---|
| all 16 ZIPs | 9,476 | 2.6% | 6.9% | **15.6%** | 31.6% | 63.2% | 116.9% | 40.3% |
| excl. 93550 | 8,155 | — | 7.3% | **16.7%** | 34.0% | 68.3% | — | — |

Only 67.4% of parcels within ±25%.

**This component dominates, as expected, and its tail is severe** — one parcel in twenty is off by
more than 117% on the market level alone, before any land-share step is applied.

### 4.3 Component 3 — combined (the full §3.2 method)

`predicted = ZIP median total (LOO) × ZIP current-regime share (LOO)` vs actual `Roll_LandValue`.

| | n | p10 | p25 | **p50** | p75 | p90 | p95 | mean |
|---|---|---|---|---|---|---|---|---|
| all 16 ZIPs | 9,476 | 3.0% | 8.3% | **19.3%** | 38.7% | 76.0% | 151.0% | 64.3% |
| excl. 93550 | 8,155 | — | 7.8% | **17.5%** | 35.0% | 73.1% | — | — |

59.8% within ±25%, 82.1% within ±50%. Median signed error −1.4%, so the method is close to unbiased
*in aggregate* — which, per §5, conceals large offsetting biases by sub-population.

Note the product's stated output is land $/sq ft, obtained by dividing this figure by
`lotAreaSqFt`. Since the same lot area divides both the prediction and the truth, the percentage
error of land $/sq ft is **identical** to the table above. Nothing is gained or lost in that step.

### 4.4 Per-ZIP median APE, ordered by ZIP price level

| ZIP | median total | (1) share | (2) market | (3) combined |
|---|---|---|---|---|
| 93550 | $459,000 | 44.9% | 11.1% | 35.0% |
| 90059 | $600,781 | 6.1% | 11.3% | 13.4% |
| 91768 | $682,380 | 9.5% | 10.3% | 11.7% |
| 90805 | $713,868 | 7.2% | 8.5% | 9.6% |
| 91331 | $744,600 | 11.9% | 9.5% | 13.6% |
| 90731 | $850,000 | 5.6% | 17.0% | 16.7% |
| 90250 | $872,100 | 6.7% | 16.2% | 17.0% |
| 91307 | $1,000,000 | 9.5% | 13.3% | 13.0% |
| 91344 | $1,025,100 | 9.4% | 17.9% | 17.2% |
| 91789 | $1,153,008 | 7.5% | 18.5% | 18.0% |
| 90042 | $1,154,000 | 10.4% | 20.0% | 24.4% |
| 90503 | $1,374,164 | 7.3% | 13.4% | 13.2% |
| 90045 | $1,581,000 | 12.0% | 21.3% | 22.3% |
| 91106 | $1,986,756 | 6.6% | 45.0% | 42.4% |
| 90272 | $3,810,332 | 8.6% | 43.2% | 44.4% |
| 90210 | $5,610,000 | 8.0% | 54.1% | 54.6% |

The share column is flat across the price range (5.6%–12.0%, Palmdale aside). The market column
climbs from 8.5% in the cheapest tract ZIPs to 54.1% in Beverly Hills. **The method degrades
monotonically with ZIP price level, and it does so entirely through the market proxy.**

---

## 5. Error vs covariates

### 5.1 Base year — no effect

Within the 2024–2026 ground-truth window:

| base year | n | MdAPE (1) share | MdAPE (3) combined | median signed (3) |
|---|---|---|---|---|
| 2024 | 3,449 | 10.4% | 18.4% | −2.1% |
| 2025 | 3,912 | 10.3% | 19.6% | −2.2% |
| 2026 | 2,115 | 8.9% | 19.9% | +1.6% |

Pooled median share by base year: 2024 = 0.732, 2025 = 0.700, 2026 = 0.730. The ~2-year window is
flat, which supports the §3.2 window choice. This says nothing about the 1995–2005 drift already
established in §3.1; it says the *current regime is internally homogeneous*, which is the assumption
§3.2 actually needs.

### 5.2 Price level — large, systematic, and the method's central weakness

Quintiles of the parcel's own assessed total **relative to its own ZIP median** (so this is
within-ZIP position, not cross-ZIP price):

| quintile | n | MdAPE (1) share | MdAPE (3) combined | **median signed (3)** |
|---|---|---|---|---|
| Q1 (cheapest in ZIP) | 1,896 | 11.1% | 62.5% | **+62.5%** |
| Q2 | 1,895 | 9.7% | 12.2% | +8.6% |
| Q3 | 1,895 | 8.6% | 8.7% | −2.2% |
| Q4 | 1,895 | 10.4% | 14.5% | −12.1% |
| Q5 (dearest in ZIP) | 1,895 | 10.4% | 29.6% | **−28.8%** |

Excluding 93550 the pattern is slightly sharper: Q1 +64.5%, Q5 −31.0%.

This is regression to the ZIP median, and for this product it is not a statistical curiosity — it is
the failure mode that matters. The method **overstates land value by a median 62.5% for the
cheapest fifth of parcels in a ZIP, and understates it by 28.8% for the dearest fifth.** In easement
pricing that means systematically overcompensating the smallest holders and shortchanging the
largest ones, with the error signed the same way every time. The share column shows this is entirely
the market proxy's doing; the share step is flat at ~9–11% across all five quintiles.

### 5.3 Lot size — modest effect, concentrated in the largest lots

Quintiles of `Shape.STArea()`:

| quintile | n | MdAPE (1) share | MdAPE (3) combined | median signed (3) |
|---|---|---|---|---|
| Q1 (smallest) | 1,896 | 8.5% | 15.5% | +3.6% |
| Q2 | 1,895 | 8.9% | 16.2% | −1.1% |
| Q3 | 1,895 | 12.3% | 19.6% | +0.9% |
| Q4 | 1,895 | 10.5% | 17.6% | +0.6% |
| Q5 (largest) | 1,895 | 9.7% | 29.6% | −16.4% |

Quintile cuts: 5,408 | 6,501 | 7,501 | 10,016 sq ft. Only the top quintile is materially worse, and
it is largely the same parcels as §5.2 Q5.

---

## 6. Baseline comparison — is the correction actually an improvement?

### 6.1 The obvious baseline is degenerate, and this must be said

"Use the parcel's own land share" **cannot be scored on this ground-truth set.** A recently-reassessed
parcel's own share *is* the current-regime share, so `own total × own share` reproduces
`Roll_LandValue` exactly, giving 0% error by construction. That is an artefact of the ground-truth
definition, not evidence about the baseline. Any back-test that reports it as a comparison is wrong.

Two non-degenerate stand-ins are used instead. Both apply a share the subject parcel did not
contribute to, against the subject's own total, so they are directly comparable to Component 1.

### 6.2 Results

| method | share used | n | p10 | p25 | **p50** | p75 | p90 | p95 | ≤25% |
|---|---|---|---|---|---|---|---|---|---|
| **(1) corrected §3.2** | ZIP current-regime (LOO) | 9,476 | 0.6% | 3.8% | **10.0%** | 17.5% | 44.9% | 54.3% | 84.3% |
| B1 naive | ZIP all-vintage pooled (LOO) | 9,476 | 6.1% | 14.9% | **25.1%** | 35.5% | 45.3% | 57.2% | 49.8% |
| B2 pre-correction | ZIP stale cohort (1975–2005) | 9,476 | 10.1% | 19.9% | **28.9%** | 39.6% | 48.0% | 61.0% | 40.2% |

B2 is the counterfactual for what the pre-§3.2 method would produce for a long-held parcel: the
share a 1975–2005-base-year parcel in that ZIP actually carries. It is a *cohort* stand-in, not the
subject's literal own stale share — the subject is recently reassessed and therefore has no stale
share to use. That substitution is unavoidable and is stated rather than hidden.

End-to-end, the same comparison: combined method 19.3% median vs stale-share end-to-end 35.8%
median (p90 76.0% vs 67.9%).

### 6.3 Reading

**The correction is real and substantial in the body of the distribution.** Median share error falls
from 28.9% to 10.0% — a 2.9x improvement — and the fraction of parcels landing within ±25% rises
from 40.2% to 84.3%.

More important than the magnitude is the **bias**. Signed error percentiles:

| method | p10 | p25 | **p50** | p75 | p90 |
|---|---|---|---|---|---|
| (1) corrected | −17.2% | −9.1% | **0.0%** | +11.6% | +30.2% |
| B2 stale share | −46.8% | −38.5% | **−28.1%** | −18.9% | −8.8% |

The stale-share method is **one-sided**: it understates land value at every percentile shown, by a
median 28.1%, and at p10 by 46.8%. This is the §3.1 harm quantified end-to-end — the pre-correction
method would have systematically undercompensated long-held owners, which is precisely the group
with the strongest easement claims. The corrected method is centred on zero. **§3.2 fixes a bias, not
merely a variance problem, and on that basis it should be kept.**

**The honest caveat:** the improvement is in the middle, not the tail. At p90 the corrected method
(44.9%) is no better than the naive all-vintage baseline (45.3%) or the stale baseline (48.0%).
Anyone relying on the "2.9x better" headline to argue the tail is safe is misreading the table.

---

## 7. Two findings that limit what this back-test can prove

### 7.1 The assessor's land/improvement split is substantially administrative

Of the 9,476 recently-reassessed parcels, **2,619 (27.6%)** have a land share landing on a 0.05 grid
to within 0.0005. The single most common value is exactly **0.70 (1,587 parcels, 16.7%)**, then
exactly **0.80 (728, 7.7%)** and exactly **0.60 (427, 4.5%)**. Nine of the sixteen ZIP-level medians
are themselves exactly 0.700 or 0.800.

That is not what a market-determined ratio looks like. It is consistent with the assessor allocating
a purchase price between land and improvements by rule of thumb for a large share of transfers.

**Consequence for this back-test.** `Roll_LandValue` on a freshly reassessed parcel is a reliable
proxy for *the transaction total* but is only partly a market observation of *land*. Component 1's
10.0% median error is therefore partly the error in guessing which administrative constant the
assessor applied — not purely the error in estimating a market land share. A low number there does
**not** establish that the ZIP current-regime share is the correct market land share. It establishes
that it reproduces the assessor's allocation well.

Checked and ruled out as an explanation for the good result: splitting the sample, parcels *on* the
0.05 grid show median share error 9.6% and off-grid parcels 10.0% — essentially identical. The
clustering is not what makes Component 1 look good. But it does change what Component 1 *means*.

### 7.2 One ZIP fails outright, and nothing available explains why

93550 (Palmdale) has a current-regime share of 0.386 against 0.700–0.814 everywhere else, and its
share distribution is bimodal: 373 parcels at exactly 0.250 and 194 at exactly 0.700, IQR 0.299
against 0.071–0.185 in every other ZIP. Its Component 1 error is 44.9%, four times the pooled figure.

The two modes were probed and are **not** distinguished by anything in the data:

| 93550 subgroup | n | median total | median bldg sq ft | median lot sq ft | use codes |
|---|---|---|---|---|---|
| share < 0.35 | 599 | $463,200 | 1,604 | 7,167 | 0100: 530, 0101: 69 |
| share ≥ 0.35 | 722 | $455,558 | 1,360 | 7,024 | 0100: 657, 0101: 65 |

Same price, same size, same use code, different split. Nor is it base year (frac below 0.35 is 44.7%
/ 40.4% / 56.8% for 2024/2025/2026) or sub-geography (ten AIN mapbooks with n≥25 all sit between
33% and 56% below-0.35). **A ZIP-level median share is simply not a meaningful statistic here**, and
there is no field in this dataset that predicts when that will be true. It has to be detected from
dispersion at runtime (§9, recommendation 4).

---

## 8. Revision candidates tested

Each is a drop-in replacement for one leg of the chain, scored on the same 9,476 parcels with the
same LOO discipline.

| variant | what changes | p50 | p90 | p95 |
|---|---|---|---|---|
| **(3) as specced** | ZIP median total × ZIP share | **19.3%** | **76.0%** | **151.0%** |
| D | ZIP median land $/lot sq ft × own lot area | 23.7% | 104.8% | 233.8% |
| E | ZIP median land value, flat | 19.2% | 77.6% | 154.1% |
| C2 | ZIP median $/bldg sq ft × own bldg sq ft × ZIP share | 22.9% | 81.5% | 147.7% |

C2 and the per-ZIP table below are scored on n=9,464, the 9,476 less 12 parcels with `SQFTmain1`
or `Shape.STArea()` missing or zero. Variant (3) rescored on that same 9,464 gives 19.3% / 75.8% /
150.1%, so the two are directly comparable.

- **D is worse, and much worse in the tail.** Scaling by lot area actively hurts (Q5 lots: 46.9% vs
  29.6%). Large lots do not carry proportionally more land value — the per-sq-ft price falls as lots
  get bigger, so multiplying a ZIP median $/sq ft by a large lot area overshoots badly. Do not adopt
  this as a shortcut.
- **E is indistinguishable from the full method.** Predicting land value as the flat ZIP median land
  value scores 19.2% vs 19.3%. In other words, once the market level is a ZIP median, multiplying a
  ZIP median total by a ZIP median share adds nothing over just taking the ZIP median land value
  directly. The two-step chain is not buying accuracy; it is buying explicability.
- **C2 (Redfin `MEDIAN_PPSF` × building sq ft, which §4.1 already makes available)** is a wash on the
  median but **trims the tail where it matters**, and the per-ZIP split is informative:

  | ZIP | market proxy: ZIP median total | market proxy: $/bldg sq ft |
  |---|---|---|
  | 90210 | 54.1% | **32.4%** |
  | 91106 | 45.0% | **17.2%** |
  | 90272 | 42.8% | **32.4%** |
  | 91789 | 18.5% | **10.3%** |
  | 90805 | **8.5%** | 18.4% |
  | 90059 | **11.3%** | 17.6% |
  | 91331 | **9.5%** | 17.2% |

  Per-sq-ft wins decisively in heterogeneous high-value ZIPs and loses in homogeneous tract ZIPs.
  Pooled market-proxy p95 falls from 116.0% to 95.9%. It is a genuine tail improvement, not a fix.

---

## 9. Verdict and recommendations

### Verdict

1. **The §3.2 correction is validated. Keep it.** Substituting the ZIP current-regime share for the
   parcel's own stale share cuts median share error from 28.9% to 10.0% and, more importantly,
   removes a systematic −28.1% understatement that ran in one direction at every percentile. §8 gate
   2 in the spec can be marked closed.

2. **The end-to-end method is not fit to ship as a point estimate.** Median APE 19.3%, p90 76.0%,
   p95 151.0%. Only 59.8% of parcels land within ±25% of the assessed land value. For a figure that
   is meant to price a specific owner's specific easement, a one-in-ten chance of being off by 76%
   is not a caveat, it is a defect.

3. **The land share is not the problem; the ZIP-median market level is.** Component 1 has p90 21.6%
   outside Palmdale. Component 2 has p90 63.2% and p95 116.9%. Effort spent refining the share will
   not move the product.

4. **The failure is signed and systematic, not noise** (§5.2): +62.5% for the cheapest fifth of
   parcels in a ZIP, −28.8% for the dearest fifth. Aggregate near-zero bias hides it.

5. **Accuracy is worst where the stakes are highest.** Combined MdAPE runs 9.6%–17% in ZIPs with
   median totals under $1M and 42%–55% in 91106, 90272 and 90210. A 54.6% error on a $5.6M Beverly
   Hills parcel is a far larger dollar exposure than a 9.6% error in North Long Beach.

### Recommended revisions

1. **Emit a range, not a point.** The percentiles in §4.3 are a calibration table. A parcel-level
   output of "land value $X, 80% interval $0.6X–$1.8X" is defensible; "$X" is not. This matches the
   existing house rule in `valuationConfidenceToTieredResult` that an unsupportable figure is not
   surfaced as a number the user can anchor on.

2. **Do not ship a bare ZIP median as the market level.** The spec's own §4.2 prohibition on
   per-address AVM values is what forces the ZIP median, and this back-test shows that constraint —
   not the land-share logic — is what caps the product's accuracy. That trade-off should be decided
   deliberately and recorded, because it is the single largest error source measured here.

3. **Choose the market proxy per ZIP, from measured dispersion.** Use Redfin `MEDIAN_PPSF` ×
   building sq ft where the ZIP's value distribution is wide, and `MEDIAN_SALE_PRICE` where it is
   tight (§8). Both fields are already in the extract §4.1 specifies, so this costs no new data
   source. The switch threshold must be fitted and recorded, not guessed.

4. **Add a per-ZIP fitness gate before any figure is emitted.** 93550 fails this method and nothing
   in the parcel record predicts that. Compute the IQR of the ZIP's current-regime share
   distribution; the 15 sound ZIPs run 0.071–0.185, 93550 runs 0.299. A ZIP over roughly 0.20, or
   with a visibly bimodal share distribution, should degrade to `flagged` rather than produce a
   number. Threshold to be fitted on more ZIPs than the 16 here before it is hard-coded.

5. **Untested idea worth testing: use the subject's rank within its own base-year cohort.** A parcel
   frozen at a 2003 base year that was worth 1.8x its 2003 cohort median is plausibly still near
   1.8x the ZIP median today. That ratio is computable at runtime from data the product already
   pulls, and it attacks the dominant error term directly by making the market level
   parcel-specific. **It could not be tested here** — validating it requires observing the same
   parcel's relative position at two different roll years, and the service publishes one roll. It
   needs either an archived roll or a re-run against `Roll_Year` 2027. Do not implement it on the
   strength of the argument alone.

6. **Record what the ground truth actually is.** Per §7.1, `Roll_LandValue` on a fresh reassessment
   is substantially an administrative allocation of the sale price — 27.6% of splits land on a 0.05
   grid, 16.7% on exactly 0.70. The product should not claim its land-value figure is validated
   against market land value. It is validated against the assessor's allocation. Those are different
   claims and only the second one is supported.

---

## Reproduction

Scripts were run from a scratchpad and are not committed. To reproduce: query the endpoint in §2 for
the two base-year bands, filtered to `UseType='Residential' AND UseCode IN ('0100','0101')` and
`Roll_LandValue>0 AND Roll_ImpValue>0`, paginating with `resultOffset` at
`resultRecordCount=1000`, `orderByFields=AIN`; then compute exact leave-one-out ZIP medians as
described in §3. 90 requests total at 700 ms spacing; the service returned no 5xx and no
`{"error":...}` bodies during the run.
