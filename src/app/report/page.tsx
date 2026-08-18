import { resolveAddress, zipHeuristicCountyResolver } from '@/lib/parcel-resolution';
import {
  buildRiskDisclosureReport,
  createLaCountyAssessorProvider,
  InvalidRiskDisclosureInputError,
} from '@/lib/risk-disclosure';
import type { AssessorParcelValuation, EasementPurpose } from '@/lib/risk-disclosure';
import {
  lookupParcel,
  SUPPORTED_COUNTIES,
  type CountyLookupResult,
  type UnifiedParcelValuation,
} from '@/lib/parcel-lookup/county-dispatch';
import {
  buildEncumberedArea,
  buildReferralPackage,
  renderPlainText,
  type ReferralPackage,
} from '@/lib/handoff';

interface ReportPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * Minimal, functional demo of the Step 3 module (Track 3 risk-disclosure
 * report), wired to Step 1's address resolution to derive the data-coverage
 * label — the "good first vertical slice to prove the full pipeline end to
 * end" the strategy doc describes. Not the UX Agent's polished risk card
 * (real lot diagram, expandable methodology panel) — this is a harness.
 */
export default async function ReportPage({ searchParams }: ReportPageProps) {
  const street = param(searchParams.street);
  const city = param(searchParams.city);
  const state = param(searchParams.state) || 'CA';
  const zip = param(searchParams.zip);
  const easementPurpose = (param(searchParams.easementPurpose) || 'utility') as EasementPurpose;
  const typedLotAreaSqFt = Number(param(searchParams.lotAreaSqFt) || '8000');
  const easementAreaSqFt = Number(param(searchParams.easementAreaSqFt) || '800');
  const selectedAin = param(searchParams.ain);
  const submitted = searchParams.submitted === '1';

  let report: ReturnType<typeof buildRiskDisclosureReport> | null = null;
  let isLaCounty = false;
  let error: string | null = null;
  /**
   * LA-shaped valuation, used ONLY for the economic-impact path. That path's
   * data-coverage labels in economic-impact.ts are hardcoded to "LA County
   * parcel" and "LA County assessment roll", so feeding an Orange County or
   * San Diego valuation through it would print a label naming the wrong
   * county. The unified valuation below carries those two.
   */
  let valuation: AssessorParcelValuation | null = null;
  let unified: UnifiedParcelValuation | null = null;
  let lookup: CountyLookupResult | null = null;
  let lookupNotice: string | null = null;
  let referral: ReferralPackage | null = null;
  let referralText: string | null = null;

  if (submitted) {
    try {
      const addressResult = await resolveAddress({ street, city, state, zip });
      isLaCounty = addressResult.kind === 'la-county-fallback';

      // normalizeAddress only carries a county when the CALLER supplied one —
      // resolveAddress computes one internally and does not put it back on the
      // normalized address. Passing the raw normalized value would leave the
      // dispatch with an undefined county and report every address as an
      // unsupported jurisdiction, which is exactly the false negative the
      // unsupported/not-found distinction exists to prevent.
      const resolvedCounty =
        addressResult.normalized.county ?? zipHeuristicCountyResolver.resolve(addressResult.normalized);

      // Every supported county goes through one dispatch. A lookup failure
      // must not sink the report — Track 3 is free nationwide, so it degrades
      // to national benchmarks with a coverage label saying so.
      lookup = await lookupParcel({ ...addressResult.normalized, county: resolvedCounty ?? undefined });

      switch (lookup.status) {
        case 'found':
          unified = lookup.valuation;
          break;
        case 'not-found':
          lookupNotice =
            `No ${lookup.county} parcel matched this address, so figures below use national ` +
            'benchmarks.';
          break;
        case 'unsupported-county':
          // Deliberately distinct from not-found: no search ran. Saying "no
          // parcel found" would report a search that never happened.
          lookupNotice = lookup.explanation;
          break;
        case 'service-error':
          lookupNotice =
            `${lookup.county} parcel service unavailable (${lookup.message}); figures below use ` +
            'national benchmarks.';
          break;
        default:
          break;
      }

      // LA additionally supplies the roll-shaped record the economic-impact
      // path needs, including the base year that lets a frozen Proposition 13
      // assessment be indexed forward. One call, whichever way we get there.
      if (isLaCounty) {
        try {
          const provider = createLaCountyAssessorProvider();
          if (selectedAin) {
            valuation = await provider.fetchByAin(selectedAin);
            if (valuation === null) {
              lookupNotice = `No LA County parcel found for AIN ${selectedAin}.`;
            }
          } else {
            const found = await provider.findByAddress(street, zip);
            valuation = found.status === 'found' ? found.valuation : null;
          }
        } catch {
          // The dispatch above already recorded a notice for this address; a
          // second failure here adds nothing the reader can act on.
          valuation = null;
        }
      }

      // A matched parcel supplies the real lot area, so the typed value is only
      // a fallback. Guard the easement against exceeding it — the real lot may
      // be smaller than whatever was typed.
      const lotAreaSqFt = unified?.lotAreaSqFt ?? valuation?.lotAreaSqFt ?? typedLotAreaSqFt;

      if (lookup.status !== 'ambiguous') {
        if (easementAreaSqFt > lotAreaSqFt) {
          error =
            `Easement area (${easementAreaSqFt.toLocaleString()} sq ft) exceeds this parcel's ` +
            `actual lot area of ${Math.round(lotAreaSqFt).toLocaleString()} sq ft.`;
        } else {
          report = buildRiskDisclosureReport({
            easementPurpose,
            lotAreaSqFt,
            easementAreaSqFt,
            isLaCounty,
            state,
            assessorValuation: valuation ?? undefined,
          });

          // The referral package: what a licensed appraiser or attorney would
          // actually be handed. Built for every address, including the ones
          // where nothing was found — a package listing what could not be
          // determined is the honest output, and the majority one.
          referral = buildReferralPackage({
            parcel: {
              parcelId: unified?.apn ?? valuation?.apn ?? 'not established',
              county: unified?.county ?? (isLaCounty ? 'Los Angeles County' : 'not established'),
              state: addressResult.normalized.state,
              fipsCode: unified?.fipsCode ?? null,
              routingTier: unified ? 'immediate' : 'fallback',
              situsAddress: unified?.situsAddress ?? valuation?.situsFullAddress ?? null,
              // California Government Code §7928.205 bars owner identity from
              // public parcel endpoints statewide, so this is null by law
              // rather than by omission.
              ownerName: null,
              geometrySource: unified?.serviceUrl ?? null,
              sourceVerifiedOn: unified?.queriedOn ?? null,
              landClass: null,
              landClassSource: null,
            },
            // No proximity scan is wired into this route, so there is no
            // geometric evidence to tier. An empty findings list is the honest
            // input; inventing a tier from a typed area would manufacture the
            // evidence the package exists to report on.
            findings: [],
            evidenceSummary:
              'No infrastructure proximity scan was run for this address. The easement facts below ' +
              'were supplied by the user and have not been verified against any recorded instrument ' +
              'or published layer.',
            fromRecordedEasements: false,
            provenance: { kind: 'user-asserted' },
            encumberedArea: buildEncumberedArea(
              easementAreaSqFt,
              { kind: 'user-asserted' },
              lotAreaSqFt,
            ),
            // Null on every path here. The ZIP-comparable estimator is not
            // wired into this route, and an assessed land value is not a
            // market land value — passing one through would be the substitution
            // buildLandValueSection exists to refuse.
            landValue: null,
            extraCaveats: (unified?.caveats ?? []).map((text) => ({
              text,
              sourceSymbol: `${unified?.county ?? 'county'} provider caveat`,
            })),
          });
          referralText = renderPlainText(referral);
        }
      }
    } catch (err) {
      error =
        err instanceof InvalidRiskDisclosureInputError || err instanceof Error
          ? err.message
          : 'Unknown error';
    }
  }

  const effectiveLotArea = valuation ? valuation.lotAreaSqFt : typedLotAreaSqFt;
  const lotSideLength = Math.sqrt(Math.max(effectiveLotArea, 1));
  const easementFraction = report
    ? Math.min(report.economicImpact.lostBuildableAreaSqFt / effectiveLotArea, 1)
    : 0;

  /** Preserves the current form state when linking to a specific parcel. */
  function candidateHref(apn: string): string {
    const q = new URLSearchParams({
      submitted: '1',
      street,
      city,
      state,
      zip,
      easementPurpose,
      lotAreaSqFt: String(typedLotAreaSqFt),
      easementAreaSqFt: String(easementAreaSqFt),
      ain: apn,
    });
    return `/report?${q}`;
  }

  return (
    <main>
      <h1>Track 3 — Risk Disclosure Report</h1>
      <form>
        <input type="hidden" name="submitted" value="1" />
        <fieldset>
          <legend>Address</legend>
          <label>
            Street <input name="street" defaultValue={street} required />
          </label>
          <label>
            City <input name="city" defaultValue={city} required />
          </label>
          <label>
            State <input name="state" defaultValue={state} maxLength={2} required />
          </label>
          <label>
            ZIP <input name="zip" defaultValue={zip} required />
          </label>
        </fieldset>
        <fieldset>
          <legend>Easement facts</legend>
          <label>
            Purpose
            <select name="easementPurpose" defaultValue={easementPurpose}>
              <option value="utility">Utility</option>
              <option value="drainage">Drainage</option>
              <option value="access">Access</option>
              <option value="sewer">Sewer</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            Lot area (sq ft) <input name="lotAreaSqFt" type="number" defaultValue={typedLotAreaSqFt} />
            <small>
              {' '}
              — ignored when a county parcel matches; the county&rsquo;s own geometry is used.
              Live coverage: {SUPPORTED_COUNTIES.join(', ')}.
            </small>
          </label>
          <label>
            Easement area (sq ft) <input name="easementAreaSqFt" type="number" defaultValue={easementAreaSqFt} />
          </label>
        </fieldset>
        <button type="submit">Generate report</button>
      </form>

      {error && <p role="alert">{error}</p>}

      {lookupNotice && <p role="status">{lookupNotice}</p>}

      {lookup?.status === 'ambiguous' && (
        <>
          <h2>Which parcel?</h2>
          <p>
            This address matches {lookup.candidates.length} separate parcels in the {lookup.county}{' '}
            assessor roll — typically one per unit. Each carries its own assessment, so pick the one
            you own rather than having us guess.
          </p>
          <ul>
            {lookup.candidates.map((c) => (
              <li key={c.apn}>
                <a href={candidateHref(c.apn)}>APN {c.apn}</a>{' '}
                <small>
                  {c.situsAddress}
                  {c.zip ? ` ${c.zip}` : ''}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}

      {unified && (
        <>
          <h2>Matched parcel</h2>
          <ul>
            <li>
              APN {unified.apn} — {unified.county}
            </li>
            <li>{unified.situsAddress}</li>
            <li>
              Lot area: {Math.round(unified.lotAreaSqFt).toLocaleString()} sq ft (from county parcel
              geometry)
            </li>
            <li>
              Assessed land value: ${unified.landValue.toLocaleString()}
              {unified.rollYear ? ` (${unified.rollYear} roll)` : ''}
              {unified.landBaseYear
                ? ` — Proposition 13 base year ${unified.landBaseYear}`
                : ' — this county publishes no Proposition 13 base year'}
            </li>
            <li>
              <small>
                Source: {unified.serviceUrl}, queried {unified.queriedOn}
              </small>
            </li>
          </ul>
          {unified.caveats.map((c) => (
            <p key={c} role="note">
              <strong>Caveat:</strong> {c}
            </p>
          ))}
          {report?.economicImpact.marketAdjustment && (
            <p>
              That assessment reflects a {report.economicImpact.marketAdjustment.indexed.baseYear}{' '}
              base year, so it has been indexed forward{' '}
              <strong>{report.economicImpact.marketAdjustment.indexed.indexRatio.toFixed(2)}×</strong>{' '}
              to roughly $
              {Math.round(report.economicImpact.marketAdjustment.indexed.indexedValue).toLocaleString()}{' '}
              in {report.economicImpact.marketAdjustment.indexed.indexedToYear} terms. This is a
              modelled estimate, not an appraisal.
            </p>
          )}
        </>
      )}

      {report && (
        <>
          <h2>Lot diagram</h2>
          <svg viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Lot diagram with easement footprint">
            <rect x="10" y="10" width="200" height="200" fill="none" stroke="currentColor" />
            <rect
              x="10"
              y={10 + 200 * (1 - easementFraction)}
              width="200"
              height={200 * easementFraction}
              fill="currentColor"
              opacity="0.3"
            />
            <text x="15" y="25" fontSize="10">
              Lot: {Math.round(effectiveLotArea).toLocaleString()} sq ft (~{Math.round(lotSideLength)}x
              {Math.round(lotSideLength)})
            </text>
          </svg>

          <h2>Restriction checklist</h2>
          <ul>
            {report.restrictionChecklist.map((item) => (
              <li key={item.activity}>
                <strong>{item.activity}</strong>: {item.restricted ? 'Restricted' : 'Generally permitted'} —{' '}
                {item.rationale}
              </li>
            ))}
          </ul>

          <h2>Economic impact</h2>
          <ul>
            <li>Lost buildable area: {report.economicImpact.lostBuildableAreaSqFt.toLocaleString()} sq ft</li>
            <li>
              Value at risk: ${report.economicImpact.valueAtRiskRange.low.toLocaleString()} – $
              {report.economicImpact.valueAtRiskRange.high.toLocaleString()}
            </li>
            <li>
              Rework cost (lower bound): $
              {report.economicImpact.reworkCostRange.low.toLocaleString()} – $
              {report.economicImpact.reworkCostRange.high.toLocaleString()}
              <br />
              <small>
                Based on ${report.economicImpact.constructionCost.costPerSqFt}/sq ft
                {report.economicImpact.constructionCost.isDivisionReported
                  ? ` (${report.economicImpact.constructionCost.division?.replace(/-/g, ' ')} region)`
                  : ' (national median)'}
                . Excludes demolition and site constraints, so actual rework costs more.
              </small>
            </li>
          </ul>
          <h3>Data coverage</h3>
          <p>
            <strong>
              {report.economicImpact.dataCoverage.tier === 'flagged-ambiguous'
                ? 'Flagged — ambiguous'
                : report.economicImpact.dataCoverage.tier === 'clear'
                  ? 'Clear'
                  : 'Likely, with caveat'}
            </strong>
            {report.economicImpact.dataCoverage.tier !== 'flagged-ambiguous' && (
              <> — {report.economicImpact.dataCoverage.value.label}</>
            )}
          </p>
          {report.economicImpact.dataCoverage.tier === 'likely-with-caveat' && (
            <p>{report.economicImpact.dataCoverage.caveat}</p>
          )}
          {report.economicImpact.dataCoverage.tier === 'flagged-ambiguous' && (
            <p>{report.economicImpact.dataCoverage.flagReason}</p>
          )}

          <details>
            <summary>How we calculated this</summary>
            <p>{report.economicImpact.methodology}</p>
          </details>

          <pre>{JSON.stringify(report, null, 2)}</pre>
        </>
      )}

      {referral && referralText && (
        <>
          <h2>Referral package</h2>
          <p>
            This is what a licensed appraiser or attorney would be handed. It reports what the
            public records say and how each figure was derived, and it states plainly what it does
            not determine — {referral.notDetermined.length} open items, listed before any figure.
          </p>
          <p>
            <strong>{referral.notDetermined.length} items are not determined here.</strong> That is
            the expected result rather than a failure: no formula available to this product produces
            the market value of a permanent easement.
          </p>
          <details>
            <summary>Read the full package</summary>
            <pre>{referralText}</pre>
          </details>
        </>
      )}
    </main>
  );
}
