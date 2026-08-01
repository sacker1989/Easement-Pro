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
