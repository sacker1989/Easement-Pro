import { resolveAddress } from '@/lib/parcel-resolution';
import {
  buildRiskDisclosureReport,
  createLaCountyAssessorProvider,
  InvalidRiskDisclosureInputError,
} from '@/lib/risk-disclosure';
import type {
  AssessorParcelValuation,
  EasementPurpose,
  ParcelCandidate,
} from '@/lib/risk-disclosure';

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
  let valuation: AssessorParcelValuation | null = null;
  let candidates: ParcelCandidate[] | null = null;
  let lookupNotice: string | null = null;

  if (submitted) {
    try {
      const addressResult = await resolveAddress({ street, city, state, zip });
      isLaCounty = addressResult.kind === 'la-county-fallback';

      // Only LA County has a machine-queryable parcel source. A lookup failure
      // must not sink the report — Track 3 is free and available nationwide,
      // so it degrades to national benchmarks with a coverage label saying so.
      if (isLaCounty) {
        const provider = createLaCountyAssessorProvider();
        try {
          if (selectedAin) {
            valuation = await provider.fetchByAin(selectedAin);
            if (!valuation) lookupNotice = `No LA County parcel found for AIN ${selectedAin}.`;
          } else {
            const found = await provider.findByAddress(street, zip);
            if (found.status === 'found') {
              valuation = found.valuation;
            } else if (found.status === 'ambiguous') {
              candidates = found.candidates;
            } else {
              lookupNotice =
                'No LA County parcel matched this address, so figures below use national benchmarks.';
            }
          }
        } catch (lookupErr) {
          lookupNotice = `LA County parcel lookup unavailable (${
            lookupErr instanceof Error ? lookupErr.message : 'unknown error'
          }); figures below use national benchmarks.`;
        }
      }

      // A matched parcel supplies the real lot area, so the typed value is only
      // a fallback. Guard the easement against exceeding it — the real lot may
      // be smaller than whatever was typed.
      const lotAreaSqFt = valuation ? valuation.lotAreaSqFt : typedLotAreaSqFt;

      if (candidates === null) {
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
  function candidateHref(ain: string): string {
    const q = new URLSearchParams({
      submitted: '1',
      street,
      city,
      state,
      zip,
      easementPurpose,
      lotAreaSqFt: String(typedLotAreaSqFt),
      easementAreaSqFt: String(easementAreaSqFt),
      ain,
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
            <small> — ignored when an LA County parcel matches; the county&rsquo;s figure is used</small>
          </label>
          <label>
            Easement area (sq ft) <input name="easementAreaSqFt" type="number" defaultValue={easementAreaSqFt} />
          </label>
        </fieldset>
        <button type="submit">Generate report</button>
      </form>

      {error && <p role="alert">{error}</p>}

      {lookupNotice && <p role="status">{lookupNotice}</p>}

      {candidates && (
        <>
          <h2>Which unit?</h2>
          <p>
            This address matches {candidates.length} separate parcels in the LA County assessor
            roll — typically one per unit. Each carries its own assessment, so pick the one you
            own rather than having us guess.
          </p>
          <ul>
            {candidates.map((c) => (
              <li key={c.ain}>
                <a href={candidateHref(c.ain)}>
                  {c.unit ? `Unit ${c.unit}` : 'No unit designation'} — AIN {c.ain}
                </a>{' '}
                <small>{c.situsFullAddress}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      {valuation && (
        <>
          <h2>Matched parcel</h2>
          <ul>
            <li>AIN {valuation.ain} (APN {valuation.apn})</li>
            <li>{valuation.situsFullAddress}</li>
            <li>Lot area: {Math.round(valuation.lotAreaSqFt).toLocaleString()} sq ft (from county parcel geometry)</li>
            <li>
              {valuation.rollYear} assessed land value: ${valuation.landValue.toLocaleString()}
              {valuation.landBaseYear ? ` (Proposition 13 base year ${valuation.landBaseYear})` : ''}
            </li>
          </ul>
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
    </main>
  );
}
