# Reconciling the two land-value paths

**Date:** 2026-07-30
**Implements:** `src/lib/valuation/reconcile-paths.ts`
**Related:** [`backtest-zip-land-share.md`](./backtest-zip-land-share.md) (Path B),
[`validation-sd-docdate.md`](./validation-sd-docdate.md) (Path A in San Diego)

---

## 1. The two paths

| | Path A — market-indexed assessment | Path B — ZIP comparables |
|---|---|---|
| method | parcel's own assessed land value × HPI(now)/HPI(vintage) | ZIP median total × ZIP current-regime land share |
| granularity | **parcel-specific** | **ZIP-generic** |
| available | LA (published base year), San Diego (`DOCDATE` vintage) | any county with a sound ZIP cohort |
| measured error | **never measured — see §3** | 19.3% median APE, p90 76.0% |

They are available together in LA and San Diego. This is what to do then.

## 2. Measured disagreement

Both paths computed for **27,770 LA County residential parcels across 6 ZIPs**, compared as the ratio
A/B:

| base-year bucket | p10 | p25 | median | p75 | p90 | within 1.5x |
|---|---|---|---|---|---|---|
| pre-1990 | 0.66 | 0.95 | **1.23** | 1.58 | 1.93 | 60% |
| 1990s | 0.71 | 0.98 | **1.26** | 1.62 | 1.97 | 57% |
| 2000s | 0.62 | 0.93 | **1.27** | 1.59 | 1.91 | 57% |
| 2010s | 0.50 | 0.78 | **1.09** | 1.33 | 1.60 | 68% |
| 2020-23 | 0.59 | 0.90 | **1.17** | 1.37 | 1.60 | 71% |

Three findings:

1. **They disagree materially.** Only 57-71% of parcels fall within 1.5x of each other, and p10 to
   p90 spans roughly a factor of four.
2. **Path A runs systematically higher** — median ratio above 1.0 in every bucket. This is a bias,
   not noise around parity.
3. **The bias is ZIP-dependent.** 90045 ran 1.36-1.64 across buckets while 91331 ran 0.85-1.07, so no
   single global correction reconciles them.

Agreement is *better* for recent base years (68-71% against 57-60%), which is expected: where the
base year is recent, Path A is nearly a no-op and both paths approximate the same fresh-market
quantity.

## 2b. The same measurement in San Diego — and an inverted trend

Repeated across 6 San Diego ZIPs, on the **44,456 parcels of 74,743 (59.5%)** whose `DOCDATE`
vintage passes the four conditions in `san-diego-assessor-provider.ts`:

| vintage bucket | p10 | p25 | median | p75 | p90 | within 1.5x | *(LA for comparison)* |
|---|---|---|---|---|---|---|---|
| pre-1990 | 0.72 | 1.05 | **1.35** | 1.71 | 2.02 | **55%** | *60%* |
| 1990s | 0.64 | 0.94 | **1.25** | 1.56 | 1.89 | **60%** | *57%* |
| 2000s | 0.42 | 0.77 | **1.16** | 1.56 | 1.95 | **51%** | *57%* |
| 2010s | 0.33 | 0.69 | **1.16** | 1.56 | 1.88 | **47%** | *68%* |
| 2020-23 | 0.24 | 0.56 | **1.10** | 1.63 | 2.07 | **40%** | *71%* |
| **all** | | | **1.15** | | | **45%** | *~60%* |

Path A still runs systematically high, as in LA. But two things differ, and the second is the
important one.

**San Diego agrees worse overall** — 45% against roughly 60%.

**The trend is inverted.** LA improves toward recent vintages (57% → 71%); San Diego *degrades*
(55% → 40%), with p10 falling to 0.24 — one parcel in ten has Path A below a quarter of Path B.

That inversion is diagnostic. A recent full-transfer `DOCDATE` should make Path A a near no-op,
exactly as a recent base year does in LA, so agreement ought to peak there. It bottoms out instead.

**Reading: `DOCDATE` is a strong AGGREGATE signal and a weak PARCEL-LEVEL one.** The 2.18x gradient
across vintage buckets in [`validation-sd-docdate.md`](./validation-sd-docdate.md) is real and
reproduced here in the ratio medians. But that validation compared *medians by bucket*, which
averages away precisely the per-parcel dispersion this measurement exposes. Both results are
correct; they answer different questions.

The practical consequence is that more San Diego parcels fall out as `discordant`. **That is the
correct behaviour, not a threshold problem.** Do not widen `CONCORDANCE_RATIO` to raise the pass
rate — the disagreement is real and the flag is the product working.

### A proposed mechanism, and its retraction

**Proposed 2026-08-01, withdrawn the same day.** The county data dictionary calls `DOCDATE` the
recording date of the document that "created this parcel", which read literally means the
subdivision map rather than a conveyance. That would have explained both anomalies neatly: indexing
from a too-old creating document inflates Path A, and a recently *created* parcel is a new
subdivision rather than an ordinary sale.

**It was then tested and is false.** Grouping parcels by `SUBNAME`, one subdivision shows 901
distinct `DOCDATE` values and 1,000 distinct `DOCNMBR` values across 1,000 parcels, spanning
1976-2026 — essentially one document per parcel, not one per subdivision. Five other large
subdivisions behave identically. See [`validation-sd-docdate.md`](./validation-sd-docdate.md) §4a
for the table. "Created this parcel" means created this parcel *record* in the Master Property
Record, which the assessor opens on transfer.

**So both anomalies in §2b are open.** Path A running high and agreement degrading toward recent
vintages remain measured and unexplained. Candidate directions, none tested:

- `DOCTYPE=1` grant deeds include non-arm's-length transfers — to an LLC, between family members,
  into an estate — that are recorded as grant deeds but do not reassess to market.
- Path B's ZIP median may simply be noisier in San Diego than in LA, in which case the inversion is
  a property of the comparison rather than of `DOCDATE`.

Distinguishing these needs an independent transfer or sale-price source. The recorder publishes
document images but this layer carries no sale price, so the test is not available from data in
hand.

## 3. Why the module does not average

Averaging is the obvious move and it is wrong here.

**Neither path is ground truth.** Path B's error is measured — 19.3% median APE against assessed land
value. **Path A's error has never been measured, and cannot be by the available method.** The only
ground truth in this data is recently-reassessed parcels, whose assessment approximates market. But
indexing forward from a *fresh* base year is nearly a no-op, so Path A scores ~0% on exactly those
parcels by construction. That is the same degeneracy the back-test identified when it rejected "use
the parcel's own share" as a baseline (§6.1 there).

With one path unmeasurable and a systematic ~1.2x gap between them, a midpoint is a number **neither
method supports and no evidence prefers**. It would also import Path A's upward bias at half
strength while presenting the result as a reconciliation.

## 4. Policy

| situation | output | confidence |
|---|---|---|
| both, ratio within 1.5x | midpoint, range spanning both estimates and the calibrated interval | `inferred` |
| both, ratio outside 1.5x | **no point estimate**; bounds span the two estimates | `flagged` |
| one only | that estimate with its own calibrated range | `inferred` |
| neither | no figure at all | `flagged` |

Agreement is treated as genuine corroboration rather than the same error twice, because the paths
fail differently: Path A is parcel-specific and inherits the parcel's own assessment; Path B is
ZIP-generic and inherits the neighbourhood's. Path B's dominant error term is precisely the
ZIP-median market level (component 2: p90 63.2%, against 21.6% for the share), and Path A does not
use it at all.

`hasReportablePointEstimate()` is a hard gate. A caller needing one number — a letter, a checkout
total — must branch on it rather than reaching for `low`, `high`, or their midpoint.

## 5. Limits

- ~~Measured in LA County only.~~ **San Diego measured too (§2b), and it differs materially** — worse
  agreement and an inverted vintage trend. Do not assume a third county resembles either.
- Residential only, 6 ZIPs per county.
- `CONCORDANCE_RATIO = 1.5` is the band this measurement reports against, not a tolerance fitted to a
  target pass rate. Re-derive it if the comparison is extended to more counties.
- The ZIP-dependent bias in finding 3 is unexplained. It is plausibly the same within-ZIP position
  effect the back-test measured (§5.2: +62.5% for the cheapest fifth, −28.8% for the dearest), but
  that was not tested here.

## Reproduction

`reconcile.ts` in the session scratchpad, not committed. Path B inputs are rebuilt per ZIP from the
`Roll_LandBaseYear >= 2024` cohort; Path A uses `LA_COUNTY_HPI_BY_YEAR` from the repo.
