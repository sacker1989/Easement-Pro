# Open-data source assessment

**Probed live 2026-08-01.** Every row below was fetched, not assessed on reputation.

---

## 1. Source verdicts

| source | status | keyless | notes |
|---|---|---|---|
| **OpenStreetMap** (Overpass) | ✅ works | yes | **406 without a `User-Agent` header** — that alone looks like a hard block. Set one. |
| **Census TIGERweb** REST | ✅ works | yes | `tigerweb.geo.census.gov/arcgis/rest/services`. Note this is *not* the Census data API, which key-gates every request (302 → `missing_key.html`). |
| **USGS 3DEP** elevation | ✅ works | yes | `elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer` |
| **USGS NHD** hydrography | ✅ works | yes | `hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer` |
| **FEMA OpenFEMA** | ✅ works | yes | v1 and v2 both return. One transient 503 on first attempt; retry succeeded. |
| **FEMA NFHL** flood | ✅ works | yes | `hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` |
| **USGS PAD-US** | ✅ works | yes | **Not on `gis1.usgs.gov` (502).** Live copies are AGOL Feature Services under `services.arcgis.com/v01gqwM5QqNysAAi` — six of them, split by manager, access, GAP status, and protection mechanism. |
| **BLS** API | ✅ works | yes | v1 is keyless (v2 needs registration). |
| **Census building permits** | ✅ works | yes | `www2.census.gov/econ/bps/County/co2024a.txt`, county-level, real columns. |
| **State parcel portals** | not probed | — | Per-state; the existing `county-database.ts` process applies. |

### OSM is better than HIFLD for this use case

Same point, the Burbank test parcel from the two-parcel check:

| | features within 500 ft | with a named operator |
|---|---|---|
| HIFLD transmission | 5 | **0** — all `OWNER: "NOT AVAILABLE"` |
| OpenStreetMap | 4 | **2** — `Los Angeles Department of Water and Power`, `voltage=230000`, plus tower nodes |

OSM also carries `circuits`, `cables`, station names (`Hollywood Way Distributing Station`,
operator `City of Burbank`). HIFLD's schema has no right-of-way width field at all — checked the full
field list.

**Use OSM as primary and HIFLD as the fallback**, not the reverse. But see §3 on the density
confound before using OSM for comparative statistics.

---

## 2. Feature-by-feature verdict

### ❌ Easement likelihood scores — NOT buildable for 3 of the 4 types

A likelihood score is a probability, and calibrating a probability needs **ground truth**: parcels
where you know whether an easement exists. This project has established repeatedly that recorded
easements live in deeds and title reports, and that no GIS layer carries them. A dedicated sweep
today confirms it: **LA County publishes no easement or right-of-way service at all**, and San Diego
publishes exactly one.

Without labelled positives, a "72% likely" score is an invented number wearing a probability's
clothing — the encumbrance-factor trap again, and worse, because a percentage anchors a reader far
harder than a dollar range does.

**CORRECTION 2026-08-01.** An earlier revision of this section cited
`sdep_warehouse/ESMT_OPEN_SPACE` (San Diego) as conservation-easement ground truth, on the strength
of its field list — `EASEID`, `DOCNO`, `RECDATE`, `Shape.STArea()`. **It is not usable.** The service
advertises `supportsQueryWithDistance: true` at layer level but its capabilities are `Map` only, and
every query returns `code 400 — "The requested capability is not supported."` It is a display layer.
Same pattern as Riverside: advertised capability, nothing delivered. Reading a field list is not
verification; querying is.

**But ground truth does exist — just not in the two counties this product covers.** A search of
ArcGIS Online returns **4,590 public easement Feature Services**, including recognisably
plat-and-deed-derived ones:

- *Deeds and Easements* (Puyallup, WA)
- *Recorded Floodplain Easements*
- *Conservation Easements*
- *Raleigh Greenway Easements*, *Airport Avigation Easements* (Boise)

**PAD-US** also carries conservation easements nationally, with a protection-mechanism split.

This changes the verdict from "impossible" to "a coverage question":

| type | ground truth | verdict |
|---|---|---|
| conservation | **yes** — PAD-US, nationally | scoreable now |
| utility / drainage / access | **only where a county publishes an easement layer** | scoreable in those jurisdictions; not in LA or San Diego, which publish none between them |

So the likelihood-score feature is buildable **county by county**, gated on whether that county
publishes recorded easements — exactly the shape of `county-database.ts`. It is not a national
feature, and it cannot be built at all in the two counties currently supported.

For jurisdictions without an easement layer, ship the evidence tier from
`.claude/agents/implied-easement-valuation.md` — A/B/C by geometric relationship — which is an
honest ordinal statement rather than a fabricated cardinal one.

### FOUND 2026-08-02: homeowner parcels with recorded easements — but the data splits

A homeowner parcel with a recorded easement **does exist in open data**, and it was reached. It is
just not in any county this product currently covers.

**Lawrence, Kansas** (`services.arcgis.com/8O9UlSTnqjKptoda`) publishes an `Easements` layer of
14,397 polygons with `SOURCETYPE='PLAT'`, `BOOK`, `PAGE`, `RECORDED` and — decisively — **`WIDTH`**.
The same org publishes a matching `Parcel` layer, so the two intersect directly.

Intersecting them returns ordinary suburban homes: quarter- to third-acre lots on a golf-course
subdivision, individually owned, each crossed by a **22.5 ft easement recorded at plat book 11, page
7**. The easement polygon measures **7,927 sq ft over a 352 ft run** — note that is the whole run
across a row of lots, so a per-parcel share needs the easement∩parcel intersection, not the polygon
area.

**Lynden, Washington** publishes the same shape of data with typed easements — `SEWER & WATER
UTILITY EASEMENT`, `DRAINAGE EASEMENT` — a `FEET` width, and an auditor's file number.

**But neither publishes assessed values.** Lawrence's `Parcel` layer carries owner, address, acreage
and legal description and no money at all; Douglas County's `Tax_Parcel` layer has 26 fields and
**zero value fields**.

So the two halves of an end-to-end homeowner valuation sit in different places:

| | assessed land value | recorded easement + width |
|---|---|---|
| LA County | ✅ with a published base year | ❌ none published |
| San Diego | ✅ 987k parcels | ❌ none queryable |
| Orange County | ✅ 696k parcels | ⚠️ 517 polygons, **institutional only** |
| Lawrence KS / Lynden WA | ❌ none | ✅ plat-derived, with width |

**No jurisdiction probed has both.** That is the single most important constraint on the product's
coverage, and it is not a gap that more probing fixes — it reflects which office publishes what.
Assessors publish values; city engineering and public-works departments publish plat easements. They
are different agencies with different open-data programmes.

Practical consequence: an end-to-end homeowner easement valuation needs either a county that
publishes both (worth searching for specifically, using the two-layer test above as the criterion),
or the value half sourced from the market path in `spec-easement-valuation.md` rather than from the
roll.

### FOUND 2026-08-02: a jurisdiction that publishes BOTH

**Green Cove Springs, Clay County, Florida** — org `R0MaBWycrb80Pvlu` on `services2.arcgis.com`.

| layer | service | n |
|---|---|---|
| easements | `Utility_and_Drainage_Easements/FeatureServer/911154` | 125 polygons, widths in `Notes` |
| parcels | `GCS_Parcels/FeatureServer/41` | 4,756, with `MktLandVal`, `JustValue`, `BldgValue`, `UseCode` |

Both queryable, same org, same spatial reference. A sweep of orgs publishing easement layers found
**27 with both easements and valued parcels**, so this is not a one-off.

**Florida removes the hardest problem entirely.** It assesses at *just value* annually, so there is
no Proposition 13 freeze, no base-year inference, no HPI indexing, and none of the vintage machinery
built for California. `MktLandVal` is a current market land value as published.

#### Two worked results, computed end to end

Intersection area via the public ArcGIS geometry service, not estimated:

| | lot | `MktLandVal` | $/sq ft | easement | encumbered | land value of strip |
|---|---|---|---|---|---|---|
| A | 39,858 sq ft | $54,285 | $1.36 | "20' wide, from CAD" | 62 sq ft (0.2%) | **$84** |
| B | 14,474 sq ft | $45,393 | $3.14 | "Sewer easement" | 1,204 sq ft (8.3%) | **$3,775** |

**Two of the three blockers are cleared.** Encumbered area: computed. Land value: published.

**But the third is not a blocker — it is a dead end, established 2026-08-02.** The Uniform Appraisal
Standards for Federal Land Acquisitions §4.6.5 rejects "strip valuation" — valuing the encumbered
area on its own — as not the correct measure, because "the rights remaining in the owners of the
servient estate may be substantial". The correct measure is the whole tract before minus the
remainder after.

So the **$84** and **$3,775** above are exactly what they say and nothing more: *the land value of
the ground under the easement*. They are **not** easement values, not a lower bound on one, and not
an input awaiting a factor — the formula that would consume them is the rejected one. Report them as
context for a conversation with an appraiser, never as compensation figures.

#### Caveats that belong with those numbers

- **Coverage is partial.** 125 easement polygons against 4,756 parcels. Absence of an easement here
  does **not** mean none exists — most parcels simply are not covered by the layer.
- **The publisher flags its own accuracy.** Parcel B's easement note reads *"approximate as county
  parcels different from survey"*. The encumbered area is approximate by the county's own admission.
- **Parcel A's 62 sq ft is small for a 20 ft easement** — the strip clips a corner rather than
  running the lot. Plausible, but a per-parcel share always needs the intersection, never the
  easement polygon's own area.

#### Web Mercator area trap — cost an 8x error before it was caught

Both layers are EPSG:3857, where `Shape__Area` is in **square metres** *and* inflated by
`1/cos²(latitude)`. At Green Cove Springs' latitude that is **1.333x**, verified against `GISACRES`
on six parcels (measured 1.3380 against a theoretical 1.3331 — a 0.4% match).

```
true_sq_ft = Shape__Area × cos²(lat) × 10.7639     # = ×8.0746 here
```

Reading `Shape__Area` as square feet understated these easements by roughly **8x** and did so
silently, producing figures that looked entirely reasonable. Any 3857 layer needs this correction, or
areas must come from the geometry service, which returns true values.

### The guide supplies the missing bridge

`.claude/agents/easement_analysis_guide.md` Part 3 is the piece that makes this coherent as a
product. **Plats show easements as labelled dashed lines** — *"15' Utility Easement"* — and a deed's
**Exceptions and Reservations** clause lists them with book and page references. That is where the
certainty lives, and it is reachable by the homeowner for $10–$50 in 1–2 days.

That reframes the tool honestly, and matches the guide's own "Map First, Deed Second" workflow: this
product is the **screening layer** that tells you *where to look and what to ask*. It is not the
answer. The guide's own table makes the distinction correctly — the tool gives *probability of
easement*, the deed gives *certainty of easement existence* — and that framing should be adopted
verbatim in the UI.

### ✅ Regional cost estimates — buildable, with a caveat on "liability"

BLS (keyless) and Census permits (keyless) both work, and `construction-cost.ts` already
establishes the sourced-regional-cost pattern. Maintenance cost is a straightforward extension.

**"Liability" is not.** Liability exposure is a legal and insurance question, not a labour-cost one.
Nothing in BLS or Census supports it, and deriving it from wage data would be fabrication with a
citation attached. Either source it from insurance data or drop it from the feature.

### ✅ Interactive map layers — the most deliverable of the four

Every verified source is either an Esri REST service or Overpass, so a MapLibre/Leaflet layer stack
consumes them directly. Nothing blocks this. It also does something valuable for the product's
honesty problem: showing the user *the actual infrastructure* alongside the caveat is far less
misleading than a single score.

### ⚠️ Comparative benchmarks — computable, but the name in the request is wrong

> "This ZIP code has 2.3× the utility easement density of the state average"

**Easement density cannot be measured** — same reason as above. What is measurable is
**infrastructure density**, and the distinction is exactly the proximity-is-not-an-easement rule this
codebase enforces everywhere else. Shipping the sentence as written would assert a fact we have no
data for.

The honest version — *"this ZIP has 2.3× the transmission-line density of the state median"* — is
computable today from OSM or HIFLD.

**But there is a real confound.** OSM density reflects **mapping effort as well as reality**. A ZIP
with active contributors shows more infrastructure than an identically-equipped ZIP without them, so
a ZIP-vs-state comparison can measure volunteer activity rather than power lines. HIFLD is more
uniform but sparser and lower quality. Before shipping any benchmark:

1. Compare OSM against HIFLD per ZIP and quantify the disagreement.
2. Use HIFLD for the *comparison* (uniform coverage) and OSM for the *detail* (operator, voltage).
3. State the completeness caveat in the output, as with `categoriesNotCovered` in the proximity spec.

---

## 3. Recommended order

1. **Interactive map layers** — no blockers, and it improves the honesty of everything else.
2. **Swap OSM in as the primary power source**, HIFLD as fallback. Measured quality win.
3. **Conservation-easement scoring** via PAD-US — the one type with real ground truth.
4. **Infrastructure-density benchmarks**, named accurately, after the OSM-vs-HIFLD confound is
   quantified.
5. **Maintenance costs** from BLS + permits. Drop "liability" or source it separately.
6. **Do not build utility/drainage/access likelihood scores** until a source of recorded easements
   exists. That source is a title-data vendor, not an open-data portal.

---

## NHD infrastructure classification — checked 2026-10-05, not usable

The specced infrastructure proximity scan wants to say *"there is a pipeline across
your land."* USGS NHD is the obvious national candidate and it **answers distance
queries correctly** — a point query near a Los Angeles address with
`distance=400&units=esriSRUnit_Foot` returns features in ~1s.

**It cannot be classified.** Layer 6 (`Flowline - Large Scale`) returns bare numeric
`ftype` and `fcode` and nothing else:

```
460/46007 | gnis_name: null
428/42823 | gnis_name: null
```

- no coded domain on `ftype` (checked the layer metadata)
- no description or type-name field (checked `outFields=*`)
- no lookup table anywhere in the service (checked the service root: 13 layers,
  **zero tables**)

Turning `428` into "pipeline" means asserting the NHD code standard from memory,
which is the thing this project does not do with facts it shows users — and the
stakes are specific here: NHD is a *hydrography* dataset, so a 428 is a water
conveyance, and presenting one as a gas transmission line would be both wrong and
alarming.

**Status: not built.** Reopen when a fetchable FCode domain is found, or when a
jurisdiction's own utility layer is wired instead.

## FEMA NFHL — built 2026-10-05

The opposite case, and the reason it shipped. Layer 28 returns values that describe
themselves:

```
FLD_ZONE: "X"
ZONE_SUBTY: "AREA WITH REDUCED FLOOD RISK DUE TO LEVEE"
SFHA_TF: "F"
STATIC_BFE: -9999
```

`ZONE_SUBTY` is prose from the service, and `SFHA_TF` is FEMA's own
Special-Flood-Hazard-Area flag — so neither the meaning nor the regulatory
consequence has to be inferred. `STATIC_BFE: -9999` is a no-value sentinel and is
mapped to null at the boundary.

Verified live against Los Angeles (minimal hazard) and New Orleans (levee). The
levee subtype is handled as its own case: outside the SFHA, and not the same as
minimal risk.

## US Census geocoder — built 2026-10-05

Free, no key, national. `geocoding.geo.census.gov/geocoder/locations/onelineaddress`
with `benchmark=Public_AR_Current` returned `{x: -118.476, y: 34.083}` for a real
Los Angeles address.

**It interpolates along a street's address range — it is not a rooftop geocoder.**
The point lands on the street segment, which can be tens of metres from the
building. That is disclosed to the user along with the matched address, because a
point near a flood-zone boundary can fall on the wrong side of it.
