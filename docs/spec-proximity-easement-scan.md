# Spec — 500-Foot Proximity Easement Scan

**Status:** build brief, not yet implemented
**Owner:** a dedicated subagent — this spec is the whole brief; assume no other context
**Written:** 2026-07-27
**Related:** [`spec-easement-valuation.md`](./spec-easement-valuation.md) — easements *on* the parcel
and what they are worth. This spec covers infrastructure *near* the parcel that commonly implies one.

---

## 1. Goal

Given an APN, return the easement-generating infrastructure within **500 feet of the parcel
boundary**, ranked by distance, so the user can see potential easement concerns near their property
before they order a title report.

## 2. The distinction this tool must never blur

**Proximity is not an easement.** A transmission line 300 ft away does not mean an easement encumbers
the parcel. A sewer main under the street is normally in the public right-of-way, not on private land.
This tool answers *"what is near me that commonly comes with an easement?"* — it does not and cannot
answer *"what is recorded against my parcel?"* Only the recorded documents do that.

Every output must be framed as **"investigate this"**, never **"you have this."** Wire the standing
language through `src/lib/compliance/disclaimer-copy.ts` rather than writing new copy, and route
anything the user may act on through `src/lib/compliance/attorney-review.ts`. This is a legal-adjacent
product; a confident false positive here is the most damaging output the tool can produce.

Note also the asymmetry, which should be stated in the UI: a **negative result is weak evidence**.
Finding nothing means nothing was found *in the layers queried*, and the layers are incomplete —
especially for sewer, water, and telecom, which are municipal and inconsistently published.

---

## 3. Mechanism — verified working

Esri feature services support a distance query natively. Both the parcel layers and the national
infrastructure layer advertise `supportsQueryWithDistance: true` (verified 2026-07-27), so no
client-side buffering or geometry library is required.

**Buffer from the parcel polygon, not its centroid.** Passing the polygon with `distance=500` yields
500 ft from the boundary, which is the stated requirement. A centroid buffer is wrong for any parcel
whose radius approaches 500 ft and gets worse as parcels get larger.

Verified query shape (this exact call was run and behaved correctly):

```bash
curl -s "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0/query?geometry=-117.93,33.85&geometryType=esriGeometryPoint&inSR=4326&distance=5000&units=esriSRUnit_Foot&spatialRel=esriSpatialRelIntersects&outFields=OWNER,VOLTAGE,TYPE&returnGeometry=false&f=json"
```

Behaviour observed: **5,000 ft returned `features: []`; 20,000 ft returned features.** Both results are
correct for that location. This matters as a test fixture — it is a verified true negative, which is
the only way to prove the tool is not simply returning everything.

Practical notes:
- `units=esriSRUnit_Foot` is confirmed accepted.
- Parcel layers and HIFLD are in **different spatial references** — LA parcels EPSG:2229, Orange
  County EPSG:2230, HIFLD 3857/4326. Pass `inSR` explicitly on every call and never assume the
  server's default matches your geometry. A silent SR mismatch produces plausible-looking wrong
  distances, which is the worst failure mode available here.
- Respect `maxRecordCount` (HIFLD transmission: 2000) and always check `exceededTransferLimit`.
- Esri returns **HTTP 200 with an `error` object** in the body. Treat that as a failure. The existing
  providers already do this — copy the `requestJson` pattern from
  `src/lib/risk-disclosure/orange-county-assessor-provider.ts` rather than writing a new client.

### Getting the parcel geometry

| County | Service | Notes |
|---|---|---|
| Los Angeles | `public.gis.lacounty.gov/.../LACounty_Parcel/MapServer/0` | query by `AIN`, `returnGeometry=true`, EPSG:2229 |
| Orange | `www.ocgis.com/arcpub/rest/services/LegalLotsAttributeOpenData/MapServer/0` | query by `AssessmentNo`, EPSG:2230 |

Other counties in `src/lib/jurisdiction/county-database.ts` currently have no usable parcel geometry
endpoint. For those, the tool must return "unsupported jurisdiction" — **not** a centroid guessed from
a geocoded address. A geocoded rooftop point silently becomes a 500 ft circle around the wrong place.

---

## 4. The ten categories to detect

Ranked by how commonly each implies a recorded easement on or adjacent to residential parcels.

| # | Category | Typical easement | Data source | Verified? |
|---|---|---|---|---|
| 1 | Electric transmission line | utility, often wide and exclusive | HIFLD `Electric_Power_Transmission_Lines` | **yes** — query tested |
| 2 | Electric substation | utility + access | HIFLD substations layer | no — locate and probe |
| 3 | Natural gas / petroleum pipeline | pipeline, wide corridor | PHMSA National Pipeline Mapping System | no — see §5 caveat |
| 4 | Sewer main / trunk conduit | sewer | county or city sanitation GIS | no — per-jurisdiction |
| 5 | Storm drain / flood control channel | drainage, often near-total on the strip | county flood control district GIS | no — per-jurisdiction |
| 6 | Water main / aqueduct | water line | water district GIS | no — per-jurisdiction |
| 7 | Public right-of-way, road, alley | dedicated ROW | Census TIGER/Line roads (public domain) | no — probe |
| 8 | Railroad corridor | rail ROW, frequently very wide | FRA / HIFLD rail network | no — probe |
| 9 | Public accessway, trail, park access | public access | county parks / trails GIS | no — per-jurisdiction |
| 10 | Telecom / fiber trunk | utility | **largely unpublished** | expect a gap |

**Category 10 is a known hole. Say so in the output rather than implying its absence means absence.**
Telecom routes are not systematically public. The same caveat applies in weaker form to 4, 5, 6 and 9,
which depend entirely on whether a given jurisdiction publishes them.

---

## 5. Probe before you trust — mandatory

Only rows marked "verified" above have been exercised. **Every other endpoint must be probed live
before a line of integration code is written**, and the result recorded in
`src/lib/jurisdiction/county-database.ts` in the established `source` shape (`accessMode`,
`verifiedOn`, `verifiedVia`, `limitations`).

This is not boilerplate caution. Every failure below was hit for real while assembling the current
county table, and each one returns something that looks like success:

| Failure mode | Real example | What it looks like |
|---|---|---|
| Guessed URL path | FHFA `/annually/` vs `/annual/` | HTTP 404 with a 75 KB HTML body |
| Silent key gate | Census ACS, every vintage tested | HTTP 302 → `missing_key.html` |
| Token required | San Diego County parcels | HTTP 200, body `{"code":499,"message":"Token Required"}` |
| Advertises capability, delivers nothing | Riverside County | service lists Query, enumerates **zero** layers; layer 0 → error 500 |
| Fields present but legally redacted | San Bernardino, CA AB 1785 | address and owner columns exist and are blank |
| **Right data on the wrong service** | **Orange County** | parcel layer had 6 fields and no values; the assessment roll with `LandVal` was on a *different service on the same server* |

The last one is the important one, and it is why §6 exists. It caused this project to record Orange
County as having no assessed value at all, which was wrong and had to be reverted.

## 6. Required discovery procedure

For each jurisdiction, before concluding a layer does not exist:

1. **Enumerate the whole service root**, not the service you expect:
   `GET {server}/rest/services?f=json`
2. Enumerate every folder returned. Interesting layers are routinely named nothing like the thing they
   contain — Orange County's assessment roll is `LegalLotsAttributeOpenData`.
3. For each candidate, `GET {service}/{layer}?f=json` and **read the full field list.** Do not infer
   content from the service name.
4. Query real records. A layer can list a field and populate it entirely with nulls.
5. Only after all of the above, record a negative — and record *what you probed*, so the next pass
   does not repeat it or trust it blindly.

Search the enumerated names case-insensitively for at least: `easement, sewer, storm, drain, flood,
water, utility, electric, transmission, pipeline, rail, trail, right_of_way, row, parcel, assess,
legal, lot`.

---

## 7. Output contract

```ts
interface ProximityFinding {
  readonly category: EasementCategory;        // §4, aligned to EasementType in the valuation spec
  readonly distanceFt: number;                // from parcel boundary
  readonly onParcel: boolean;                 // distance 0 — intersects the parcel itself
  readonly descriptor: string;                // e.g. "220 kV transmission line"
  readonly attributes: Readonly<Record<string, string | number | null>>;
  readonly source: {
    readonly layer: string;
    readonly serviceUrl: string;
    readonly queriedOn: string;               // ISO date
  };
  /** What this does and does not imply. Never omitted. */
  readonly implication: string;
}

interface ProximityScanResult {
  readonly apn: string;
  readonly county: string;
  readonly findings: readonly ProximityFinding[];
  /** Categories not queryable in this jurisdiction. Drives the "absence proves nothing" notice. */
  readonly categoriesNotCovered: readonly EasementCategory[];
  readonly radiusFt: 500;
}
```

Requirements:
- `onParcel: true` findings sort first, then ascending distance.
- Deduplicate: a single transmission line returned as several segments is **one** finding at the
  minimum distance, not five.
- `categoriesNotCovered` must be populated honestly and surfaced in the UI. It is the difference
  between "we checked and found nothing" and "we could not check."
- Preserve source attributes verbatim — including junk. HIFLD returns `OWNER: "NOT AVAILABLE"` on real
  records; pass that through rather than blanking it, so the user sees the data quality directly.

---

## 8. Deliverables

- `src/lib/easements/proximity-scan.ts` — orchestrator: APN → geometry → fan-out → merge
- `src/lib/easements/proximity-sources.ts` — per-category layer registry with the verified `source`
  metadata from §5
- `src/lib/easements/parcel-geometry.ts` — LA and Orange geometry fetch, explicit `inSR` handling
- Tests, following existing convention:
  - fixtures captured from live responses, as in `orange-county-assessor-provider.test.ts`
  - **the verified true negative from §3** — 5,000 ft empty near Anaheim — as a regression test that
    the tool can return nothing
  - a spatial-reference mismatch test, since that failure is silent and produces wrong distances
  - an assertion that `categoriesNotCovered` is non-empty for a jurisdiction with no sewer layer, so
    the coverage gap cannot be quietly dropped

## 9. Sequencing

1. Parcel geometry for LA and Orange (everything else depends on it).
2. Category 1 end to end — the one verified source — to prove the whole pipeline.
3. §6 discovery pass for categories 2, 3, 7, 8 (national sources, one integration each).
4. Per-jurisdiction categories 4, 5, 6, 9 for LA and Orange only.
5. Category 10 stays a documented gap until a source exists. Do not fill it with a guess.
