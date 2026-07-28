# Spec — On-Parcel Easement Identification and Valuation

**Status:** build brief, not yet implemented
**Owner:** valuation agent
**Written:** 2026-07-27
**Consumes:** `src/lib/risk-disclosure/*`, `src/lib/jurisdiction/*`
**Related:** [`spec-proximity-easement-scan.md`](./spec-proximity-easement-scan.md) — that spec covers
easements *near* a parcel; this one covers easements *on* it, and what they are worth.

---

## 1. What this replaces, and why

Today the app derives a land value one way: take the county's assessed land value and, in LA County
only, index it forward with the FHFA house-price index (`market-index.ts`). That path has two known
failures, both documented in code:

1. **It needs a Proposition 13 base year.** LA publishes `Roll_LandBaseYear`. Orange County does not.
   Without it there is no defensible way to tell whether an assessed figure reflects 2003 or 2024, so
   `orange-county-assessor-provider.ts` returns values raw and refuses to index them. See
   `ORANGE_COUNTY_STALENESS_CAVEAT`.
2. **Even indexed, it is an assessment, not a market observation.** The index applies county-median
   appreciation to a specific parcel, which is wrong for that parcel by an unknown amount.

This spec replaces the primary valuation path with one anchored to **what comparable property is
actually selling for**, and demotes the assessed-value path to a cross-check.

The change also dissolves the base-year problem rather than solving it. See §3.

---

## 2. Scope

**In scope**
- Enumerate the easement types that can encumber a parcel, as a typed taxonomy.
- Estimate current market land value per square foot for a parcel.
- Convert that into a dollar valuation for a *specific easement* on that parcel, by type, area, and
  the share of rights the easement takes.

**Out of scope**
- Reading recorded easement documents. Determining that a given easement *exists* on a parcel is
  Track 1/2 document retrieval work. This spec values easements once identified, and enumerates what
  could exist so the UI can ask the right questions.
- Anything within 500 ft but off-parcel — see the companion spec.

---

## 3. The valuation chain

The core move: **stop indexing a stale level, and start applying a stable ratio to a current level.**

```
                     ┌─ Redfin MEDIAN_SALE_PRICE / Zillow ZHVI, by ZIP, monthly  ─┐
current market value │                                                            │
of a typical property└────────────────────────────────────────────────────────────┘
                                          ×
                     ┌─ assessor LandVal / (LandVal + ImprovedVal), per parcel   ─┐
land share of value  │  LA: Roll_LandValue / (Roll_LandValue + Roll_ImpValue)     │
                     └────────────────────────────────────────────────────────────┘
                                          =
                              estimated market land value
                                          ÷ lotAreaSqFt
                                          =
                                 land $/sq ft  ──►  easement valuation (§6)
```

**Why the land share works where the level does not.** Proposition 13 freezes the *level* of an
assessment, and the freeze is severe: two comparable ~6,200 sq ft lots on W Huntington Ave in Anaheim
carry assessed land values of 243,414 and 531,538. But land and improvements are reassessed
*together*, on the same event, at the same time. The **ratio** between them is therefore far less
distorted than either figure alone, and — critically — **it does not require knowing the base year.**
That is what makes this path work in Orange County, and in any county publishing a land/improvement
split without a base year.

This is an assumption, not a theorem. It must be validated (§8) and stated in output (§7).

---

## 4. Market data source

### 4.1 What to use

| Source | File | Grain | Cadence | Key field |
|---|---|---|---|---|
| Redfin Data Center | `zip_code_market_tracker.tsv000.gz` | ZIP × property type × month | monthly | `MEDIAN_SALE_PRICE`, `MEDIAN_PPSF` |
| Zillow Research | `Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` | ZIP × month | monthly | ZHVI value, one column per month |

Both verified reachable and keyless on 2026-07-27:
- `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz` → HTTP 200, ~1.5 GB gzipped
- `https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` → HTTP 200, ~123 MB

Redfin column names confirmed from the live file header: `PERIOD_BEGIN, PERIOD_END, REGION,
STATE_CODE, PROPERTY_TYPE, MEDIAN_SALE_PRICE, MEDIAN_PPSF, HOMES_SOLD, PENDING_SALES, …`.
Zillow header confirmed: `RegionID, SizeRank, RegionName, RegionType, StateName, State, City, Metro,
CountyName,` then one column per month from `2000-01-31` forward.

**Prefer Redfin `MEDIAN_SALE_PRICE` as the primary.** It is closed transactions — what property
actually sold for — which is what the product claims. Use Zillow ZHVI as the fallback and the
cross-check; it is a smoothed model output, not a transaction record, and the two should not be
averaged together as if they were the same kind of number.

### 4.2 Constraints the implementer must respect

- **Use only the published bulk research files above.** Do not scrape listing pages, do not call
  undocumented site endpoints, and do not use Zestimate or Redfin Estimate per-address AVM values.
  Those are a different product with different terms, and per-address AVM output is the thing most
  clearly not licensed for redistribution.
- **These files are free of charge but not open-licensed.** Neither is public domain the way FHFA and
  Census data are. Before this ships in a paid product, someone must read Redfin's and Zillow's terms
  of use for their research data and confirm commercial redistribution of derived figures is
  permitted, and with what attribution. **Record the outcome in this file.** Ship attribution on any
  screen showing a derived figure regardless.
- Cache the parsed extract; do not re-download 1.5 GB per request. Reduce to a ZIP × month table at
  build time and commit only the reduced form, following the precedent of `la-county-hpi-data.ts`.
- **`HOMES_SOLD` is a data-quality gate, not decoration.** A ZIP-month with a handful of sales gives a
  median that swings wildly. Set a minimum sale count below which the figure is not used; pick the
  threshold from the distribution in the actual data and record the reasoning. Fall back to a coarser
  geography (city, then county) rather than reporting a median built on almost nothing.

---

## 5. Easement taxonomy

Model as a discriminated union in `src/lib/easements/easement-types.ts`. Each variant carries what
valuation needs, not merely a label.

| Type | Typical form | Exclusive? | Surface use lost |
|---|---|---|---|
| `utility-overhead` | transmission/distribution line, poles | no | partial — build restriction under span |
| `utility-underground` | electric, telecom conduit | no | minimal at surface, no structures |
| `sewer` | gravity main, force main | no | no structures, access for excavation |
| `storm-drain` | pipe or open channel | no | varies; open channel is near-total |
| `water-line` | main, service lateral | no | no structures |
| `pipeline` | gas, petroleum products | often | substantial; wide corridor |
| `access-ingress-egress` | shared driveway, landlocked-parcel access | no | near-total on the strip |
| `public-right-of-way` | dedicated road, sidewalk, alley | yes | total |
| `drainage` | surface flow, detention | no | varies |
| `slope` | cut/fill support on graded lots | no | no structures, no regrading |
| `conservation` | perpetual development restriction | no | varies; can affect whole parcel |
| `prescriptive` | established by use, not grant | no | unresolved until adjudicated |

Each record must carry:

```ts
interface ParcelEasement {
  readonly type: EasementType;
  /** Encumbered area in sq ft. Required — valuation is per-area, not per-easement. */
  readonly areaSqFt: number;
  /** Perpetual vs temporary construction easement. Changes the method entirely (§6.3). */
  readonly term: 'perpetual' | 'temporary';
  readonly termYears?: number;
  /** True where the holder may exclude the owner from the strip. Drives the high end of §6.2. */
  readonly exclusive: boolean;
  /** Where this came from: recorded document, plat, county GIS, or user assertion. */
  readonly provenance: EasementProvenance;
}
```

`provenance` matters as much as the geometry. An easement read off a recorded deed and one a user
ticked in a form must not produce identically-confident dollar figures. Map it onto the existing
three-state vocabulary in `jurisdiction-valuation-bridge.ts` (`verified` / `inferred` / `flagged`)
rather than inventing a fourth confidence scheme.

---

## 6. Valuing an easement

### 6.1 Method

Standard corridor valuation:

```
easement value = encumbered area (sq ft)
               × land value per sq ft        (§3)
               × encumbrance factor          (§6.2, type-dependent)

total claim    = easement value
               + severance damage to the remainder, where applicable
               + temporary construction easement, where applicable (§6.3)
```

### 6.2 Encumbrance factors — DO NOT INVENT THESE

The encumbrance factor is the share of the fee value the easement takes: near 1.0 where the owner
effectively loses the strip, far lower where they retain most use.

**This repo has an explicit norm against invented numbers.** Commit `daaad19` exists solely to replace
a fabricated rework cost with sourced regional construction data. Do not regress that. A plausible
table of percentages with no citation is worse than no table, because it looks authoritative.

The implementer must source factors from public, checkable authorities and record the citation inline,
in the style of `construction-cost.ts` and `la-county-hpi-data.ts`. Candidate authorities, each of
which **must be fetched and verified before use** — do not cite from memory:

- **Uniform Appraisal Standards for Federal Land Acquisitions** ("Yellow Book") — the controlling
  federal standard for partial-acquisition appraisal.
- **Caltrans Right of Way Manual** — California-specific, public, and directly on point for CA parcels.
- **FHWA right-of-way acquisition guidance.**
- **State DOT ROW manuals** for the parcel's state, where the app expands beyond CA.

Where no sourced factor exists for a type, the correct output is a **range with an explicit
"unsourced" flag**, or `flagged-ambiguous` with no number at all — matching the existing rule in
`valuationConfidenceToTieredResult` that a figure with no source behind it is not surfaced as a number
the user can anchor on.

### 6.3 Temporary construction easements

Value as **rent on the encumbered area for the term**, not as a share of fee value. Requires a ground
rent rate; source it, do not assume a percentage of value.

### 6.4 Severance damages

Where an easement bisects a parcel, sterilises a buildable envelope, or removes access, the damage to
the *remainder* can exceed the value of the strip itself. Do not attempt to model this automatically.
Detect the conditions that suggest it — easement crosses the parcel interior, reduces buildable area
below the zoning minimum, or touches the only street frontage — and route to attorney review via the
existing `src/lib/compliance/attorney-review.ts` hook.

---

## 7. Output contract

Every figure must state its chain. Minimum:

- market source, geography, and period actually used (e.g. "Redfin median sale price, ZIP 92801,
  2026-06, 47 homes sold")
- land share used, and that it came from the county assessment ratio
- encumbrance factor used, **with citation**
- whether the parcel's own assessed value corroborates or contradicts the estimate (§8)
- the standing disclaimer that this is a modelled estimate, not an appraisal

Reuse `src/lib/compliance/disclaimer-copy.ts` rather than writing new disclaimer text, so the report
and letter cannot drift apart — the same reason `ORANGE_COUNTY_STALENESS_CAVEAT` is defined once.

---

## 8. Validation — required before this ships

The land-share assumption in §3 is the load-bearing claim. It must be tested, not asserted.

1. **Back-test in LA County**, the one county with both an assessed value *and* a base year. For
   recently-reassessed parcels (base year within ~2 years, so the assessment approximates market),
   compare `Redfin ZIP median × land share` against the actual assessed land value. Report the error
   distribution. If the median absolute error is large, this method is not ready and the spec needs
   revision, not a caveat.
2. **Check land-share stability across base years.** Group LA parcels by base year and compare the
   land-share distribution. The assumption requires the ratio to be roughly base-year-invariant. If
   land share drifts systematically with base year, quantify the drift and correct for it, or state
   the residual bias.
3. **Extend `hand-verified-parcels.ts`** with easement cases carrying known valuations. The vendor
   scorecard harness from commit `9ccc0d8` is the right pattern to follow.
4. **Cross-check every estimate against the raw assessed value at runtime.** A market estimate far
   below the assessment is a strong signal something is wrong — an assessment is normally a *floor*.
   Surface the disagreement rather than silently preferring one.

---

## 9. Deliverables

- `src/lib/easements/easement-types.ts` — taxonomy and `ParcelEasement`
- `src/lib/valuation/market-land-value.ts` — the §3 chain
- `src/lib/valuation/market-data/` — reduced Redfin/Zillow extract plus loader, with provenance header
- `src/lib/valuation/encumbrance-factors.ts` — sourced factors, citations inline, unsourced types
  explicitly modelled as unsourced
- `src/lib/valuation/value-easement.ts` — §6 calculation
- Tests for each, following the existing convention: live-observed fixtures, negative cases, and
  assertions that unsourced or low-confidence inputs do **not** produce a confident number
