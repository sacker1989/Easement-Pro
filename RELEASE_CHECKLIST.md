# Release Checklist — IRWA engine wiring + wildfire safety section

Branch: `muse/missing-features` (based on `74eb5a9`). Do NOT push to production until every box is checked.

## What this release changes

- **Report page** (`src/app/report/page.tsx`):
  - New section **"The same question, worked a second way"** — a second orientation-only
    range computed by the IRWA valuation engine (`EasementValuationCalculator` Summation leg
    across the mapped impact tier), wrapped in jurisdictional confidence
    (`valuationConfidenceToTieredResult`). Renders below "What this report does not tell
    you", per the ordering rule the suite asserts. 9 of 12 easement types map to a tier;
    slope / conservation / prescriptive refuse with reasons. A flagged jurisdiction
    shows the flag reason with NO number, per the bridge's structural rule.
  - New section **"Fire risk from the overhead power lines"** — CAL FIRE Fire Hazard
    Severity Zone lookup (LRA 2025 map, SRA 2024 map fallback) run in parallel with the
    FEMA query, gated on overhead-utility easements in a mapped hazard zone. Renders with
    the other value-and-protection findings, above the limits.
  - `UpstreamService` gains `calfire-fhsz` for outcome logging.
- New modules: `src/lib/proximity/fire-severity.ts`, `src/lib/valuation/engine-estimate.ts`
  (+ `engine-estimate` exports in `src/lib/valuation/index.ts`).
- `src/app/report/page-ordering.test.ts` extended for both sections.

## Pre-merge (CI)

- [ ] `npm run typecheck` green
- [ ] `npm test` green — 1140 tests / 81 files, including:
  - `src/lib/valuation/engine-estimate.test.ts` (tier mapping, range math, refusals,
    insufficient-data, mandatory caveats, no point estimate)
  - `src/lib/proximity/fire-severity.test.ts` (LRA/SRA mocked scenarios: Very High /
    High / Moderate / NonWildland / no-coverage / lookup-failed; content gating;
    headline and disclosure posture)
  - `src/app/report/page-ordering.test.ts` (engine section below limits with disclosures;
    fire section between flood panel and limits; CAL FIRE in parallel with FEMA)
- [ ] `npm run build` green (no client-component leakage of server modules)

## Post-deploy smoke test (production)

- [ ] Homepage 200
- [ ] Sample report 200 with all sections + the compliance disclaimer. Confirm:
  - an overhead-utility address in a Very High zone (e.g. Pasadena foothills) shows the
    fire section with the utility-responsibility copy;
  - a coastal address (NonWildland) shows NO fire section;
  - the engine range renders BELOW "What this report does not tell you";
  - a slope-easement report shows the engine refusal text, not a number;
  - an address with no county match shows insufficient-data messaging, not a crash;
  - a flagged jurisdiction shows the flag reason with NO engine number.
- [ ] `/privacy` 200 — lands via the PARALLEL privacy-page change (separate branch/workdir);
  verify it is live, do not assume.
- [ ] No server paths in served HTML (no `/tmp`, `/home`, `/var`, `src/lib` strings).
- [ ] Vercel Analytics confirmed receiving events (needs the dashboard toggle plus the
  already-wired code side).

## Performance

- [ ] Measure median report-generation time from Vercel function logs against the 10s Hobby cap.
- Known baseline: ~22s observed pre-change (already over the cap; `maxDuration = 30` is
  ignored on Hobby). This change adds one CAL FIRE query for geocoded reports, run IN
  PARALLEL with the FEMA query — worst case adds max(FEMA, CAL FIRE), not the sum.
- If reports fail under load: lower the fetch budget in `resilient-fetch.ts` toward ~8s
  total first; upgrade to Vercel Pro ($20/mo) only when traffic earns it. Do not raise
  per-attempt timeouts.

## Rollback

- Vercel instant rollback to the previous deployment (Deployments → … → Instant Rollback).
  No migrations, no schema changes, no new env vars — rollback is safe and complete.

## Open product/legal items (not gating, must not be forgotten)

- **SCREENING-BANDS-UNCITED**: appraiser review of wiring the percentage table into the
  handoff path is still open. This release keeps engine output OUT of the referral package
  and labels it illustrative/orientation-only per the conflict notice in
  `valuation-matrix.ts`. Merging this does not close that item.
- The Before-and-After leg is not wired (needs an appraiser's remainder read); the section
  copy says so explicitly.
- CAL FIRE FHSZ data is CC BY — the section disclosure cites CAL FIRE/OSFM with map
  vintages, satisfying the attribution obligation.
- The public-right-of-way → major tier mapping is a judgment call (basis cited in-code);
  founder review welcome.
