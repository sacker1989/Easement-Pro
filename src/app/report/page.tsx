import { resolveAddress } from '@/lib/parcel-resolution';
import { buildRiskDisclosureReport, InvalidRiskDisclosureInputError } from '@/lib/risk-disclosure';
import type { EasementPurpose } from '@/lib/risk-disclosure';

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
  const lotAreaSqFt = Number(param(searchParams.lotAreaSqFt) || '8000');
  const easementAreaSqFt = Number(param(searchParams.easementAreaSqFt) || '800');
  const submitted = searchParams.submitted === '1';

  let report: ReturnType<typeof buildRiskDisclosureReport> | null = null;
  let isLaCounty = false;
  let error: string | null = null;

  if (submitted) {
    try {
      const addressResult = await resolveAddress({ street, city, state, zip });
      isLaCounty = addressResult.kind === 'la-county-fallback';
      report = buildRiskDisclosureReport({
        easementPurpose,
        lotAreaSqFt,
        easementAreaSqFt,
        isLaCounty,
      });
    } catch (err) {
      error =
        err instanceof InvalidRiskDisclosureInputError || err instanceof Error
          ? err.message
          : 'Unknown error';
    }
  }

  const lotSideLength = Math.sqrt(Math.max(lotAreaSqFt, 1));
  const easementFraction = report ? Math.min(report.economicImpact.lostBuildableAreaSqFt / lotAreaSqFt, 1) : 0;

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
            Lot area (sq ft) <input name="lotAreaSqFt" type="number" defaultValue={lotAreaSqFt} />
          </label>
          <label>
            Easement area (sq ft) <input name="easementAreaSqFt" type="number" defaultValue={easementAreaSqFt} />
          </label>
        </fieldset>
        <button type="submit">Generate report</button>
      </form>

      {error && <p role="alert">{error}</p>}

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
              Lot: {lotAreaSqFt.toLocaleString()} sq ft (~{Math.round(lotSideLength)}x{Math.round(lotSideLength)})
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
              Rework cost: ${report.economicImpact.reworkCostRange.low.toLocaleString()} – $
              {report.economicImpact.reworkCostRange.high.toLocaleString()}
            </li>
          </ul>
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
