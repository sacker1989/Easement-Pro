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

### RESOLVED 2026-08-01 — non-arm's-length grant deeds, and a composition effect

The first candidate was tested and is correct. **A large and growing share of `DOCTYPE=1` grant
deeds are transfers into trusts, which Proposition 13 excludes from reassessment.**

Recent grant deeds split by owner class, assessed value per living sq ft:

| ZIP | individually owned | trust owned | ratio | trust share |
|---|---|---|---|---|
| 92117 | 683 | 405 | 0.59 | 41% |
| 92126 | 557 | 290 | 0.52 | 44% |
| 92024 | 729 | 489 | 0.67 | 57% |

Trust-owned parcels carry roughly **half** the assessed value of comparable individually-owned homes
conveyed in the same years — the signature of a basis that never reset.

Re-running the A/B comparison split by owner class closes it completely:

| vintage | class | n | median | p10 | within 1.5x |
|---|---|---|---|---|---|
| pre-2010 | individual | 4,563 | 0.86 | 0.45 | **69%** |
| pre-2010 | trust/entity | 884 | 0.44 | 0.11 | **23%** |
| 2010s | individual | 7,464 | 0.94 | 0.40 | **68%** |
| 2010s | trust/entity | 4,338 | 0.53 | 0.10 | **32%** |
| 2020-23 | individual | 7,255 | 1.06 | 0.32 | **66%** |
| 2020-23 | trust/entity | 6,046 | 0.53 | 0.09 | **33%** |

**For individually-owned parcels the inversion disappears** — 66-69%, flat across every vintage and
squarely inside LA's 57-71% band. Trust/entity parcels sit at 23-33% with a median near 0.5.

**The inversion was a composition effect.** The trust share grows with recency — 16% of pre-2010
vintages, 37% of 2010s, **45%** of 2020-23. Each subgroup is stable; the blended rate falls only
because the badly-behaved subgroup grows. San Diego never had a vintage-quality problem; it had a
mix problem.

This also accounts for Path A running high. Once trusts are excluded from the Path B cohort, the
individual medians land at 0.86-1.06 rather than 1.10-1.35.

The second candidate — that Path B is simply noisier in San Diego — is not needed to explain
anything and was not pursued.

**Acted on.** `classifyVintage` gained a fifth condition, `non-arms-length`, which withholds an
indexed figure when the owner is a trust or entity. Verified live: 11 of 25 recent grant deeds in
92117 are withheld, matching that ZIP's 41% trust share.

### Does LA need the same fix? No — checked 2026-08-01

LA publishes **no owner-name fields at all** (Gov Code §7928.205), so owners cannot be classified
there. But the question that matters is structural and testable without names: does LA's vintage
marker carry the same contamination?

Comparing the dispersion of assessed value per living sq ft among *recent-vintage* parcels — LA by
`Roll_LandBaseYear` = 2022, San Diego by `DOCDATE` year 2022 with `DOCTYPE=1`. The two cohorts are
defined differently on purpose; that difference is the subject of the test.

| county | ZIP | n | IQR/median | p10/median |
|---|---|---|---|---|
| LA | 91307 | 346 | 0.25 | 0.73 |
| LA | 91344 | 669 | 0.31 | 0.69 |
| LA | 90045 | 433 | 0.45 | 0.60 |
| LA | 90042 | 538 | 0.65 | 0.60 |
| SD | 92117 | 508 | 0.70 | 0.27 |
| SD | 92126 | 478 | 0.91 | 0.38 |
| SD | 92024 | 478 | 0.78 | 0.33 |
| SD | 92114 | 641 | 0.89 | 0.29 |
| | **median** | | **LA 0.38 / SD 0.83** | **LA 0.65 / SD 0.31** |

San Diego's recent-vintage cohort is **2.2x more dispersed**, and its bottom decile sits below a
third of the median against LA's 0.65 — an ordinary distributional tail. The depressed lower mode is
the stale-basis subpopulation. **LA has no such mode.**

**Why, and it is the general lesson.** Trusts own property in LA exactly as they do in San Diego —
the ownership pattern is a feature of California, not of one county. But LA publishes the
*reassessment year itself*. A trust transfer that does not reassess simply leaves `Roll_LandBaseYear`
old, and indexing from that old year is then correct. The county answers the question the San Diego
provider has to infer.

So the trust pattern corrupts a vintage **only where the vintage is inferred from recorded
documents**. That is an argument for preferring a published base year over any document-derived
proxy, and for treating a county's own reassessment field as materially better evidence than
anything reconstructible from deeds — not merely more convenient.

No change to the LA path. The check was worth running because a shared fix would have been the
wrong response.

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
