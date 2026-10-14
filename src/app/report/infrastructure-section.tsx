import { ringCentroid } from '@/lib/geo/planar-distance';
import { currentEntitlements } from '@/lib/entitlements/search-entitlements';
import { observe } from '@/lib/observability/outcome-log';
import { lookupInfrastructure } from '@/lib/proximity/infrastructure';
import { fetchParcelGeometry } from '@/lib/proximity/parcel-geometry';
import {
  assessParcelInfrastructure,
  COVERAGE_CAVEAT,
  GEOMETRY_IS_NOT_A_DEED,
  type ParcelInfrastructure,
} from '@/lib/proximity/parcel-infrastructure';

/**
 * The infrastructure scan, as its own streamed section.
 *
 * WHY IT IS NOT IN THE PAGE BODY ANY MORE, and the reason is measured rather
 * than aesthetic. Overpass was sampled fourteen times on 2026-10-14, with the
 * exact query the report sends:
 *
 *   succeeded  6 of 14 — 1.04, 1.40, 2.26, 2.38, 2.75, 8.05 seconds
 *   failed     8 of 14 — HTTP 504, taking 8.5 to 13.4 seconds to say so
 *   mirrors    kumi and private.coffee both 0 of 6
 *
 * So the scan fails more often than it succeeds, and a failure is SLOWER than
 * a success. Awaited in the page body it added up to 3 seconds to a report
 * that otherwise takes about two — most of the time for nothing, on a feature
 * that even when it works usually reports "nothing mapped" for a residential
 * address.
 *
 * Streaming it fixes the trade rather than the service. The report renders
 * when the report is ready; this section arrives when it arrives, and a
 * reader who never scrolls to it has waited nothing for it at all. The three
 * second cap stays, because it is what turns a 13-second 504 into a
 * three-second one and it keeps five of the six observed successes.
 *
 * A SERVER COMPONENT, SO THERE IS STILL NO CLIENT JAVASCRIPT. The page's
 * no-JS rule is intact: React streams the HTML in when the await resolves.
 */

export interface InfrastructureSectionProps {
  readonly serviceUrl: string;
  readonly idQuery: { readonly field: string; readonly value: string };
  readonly county: string;
  readonly state: string;
  /** Fallback centre if the county returns no outline. */
  readonly lat: number;
  readonly lon: number;
  /** How the rest of the report refers to the land. */
  readonly propertyPhrase: string;
}

async function scan(props: InfrastructureSectionProps): Promise<ParcelInfrastructure | null> {
  try {
    /*
     * GEOMETRY FIRST. The search is centred on the parcel rather than the
     * geocoded address, so the radius means what the copy says; and without a
     * ring there is no boundary to measure against, so the Overpass call is
     * skipped entirely rather than paid for and discarded.
     */
    const geometry = await fetchParcelGeometry({
      serviceUrl: props.serviceUrl,
      idQuery: props.idQuery,
    });
    if (geometry.kind !== 'ring') return { kind: 'no-parcel-geometry' };

    const [lon, lat] = ringCentroid(geometry.ring);
    const nearby = await observe(
      'osm-infrastructure',
      (r) => ({
        result:
          r.kind === 'found'
            ? ('ok' as const)
            : r.kind === 'none-mapped'
              ? ('degraded' as const)
              : ('failed' as const),
        reason:
          r.kind === 'none-mapped'
            ? ('no-match' as const)
            : r.kind === 'lookup-failed'
              ? ('http-error' as const)
              : undefined,
        state: props.state,
        county: props.county,
      }),
      () => lookupInfrastructure({ lat, lon, radiusFt: currentEntitlements().scanRadiusFt }),
    );
    return assessParcelInfrastructure(nearby, geometry.ring);
  } catch {
    return null;
  }
}

/**
 * Shown while the scan is in flight.
 *
 * THE noscript IS NOT DECORATION. React streams the resolved section in a
 * <template> and swaps it with an inline script. With JavaScript turned off
 * that swap never happens, and the reader is left looking at "checking…"
 * forever — the waiting-forever failure this product keeps removing
 * elsewhere. The rest of the report is server-rendered and needs no script,
 * so the honest thing is to say that this one section does, rather than let
 * it spin.
 */
export function InfrastructurePending({ propertyPhrase }: { propertyPhrase: string }) {
  return (
    <>
      <h2>Infrastructure near {propertyPhrase}</h2>
      <p className="muted">Checking what is mapped around this parcel…</p>
      <noscript>
        <p role="note">
          This one section loads after the rest of the page and needs JavaScript to appear.
          Everything else in this report is already here without it. Nothing below depends on
          this scan, and what is on your deed and your plat remains the authority either way.
        </p>
      </noscript>
    </>
  );
}

export async function InfrastructureSection(props: InfrastructureSectionProps) {
  const result = await scan(props);

  return (
    <>
      <h2>Infrastructure near {props.propertyPhrase}</h2>
      {/*
        FOUR OUTCOMES, FOUR DIFFERENT SENTENCES. Found something, found
        nothing, could not look, and no outline to measure from. Collapsing
        any of them into "nothing near this property" would hand a homeowner a
        clean bill of health on the strength of a gap in a volunteer map.
      */}
      {result === null && (
        <p role="note">
          This scan did not run. It needs both a matched county parcel and a geocoded location,
          and one of them was not available for this address.
        </p>
      )}
      {result?.kind === 'lookup-failed' && (
        <p role="note">
          This scan did not complete — {result.reason}. Nothing else in this report depends on
          it, and nothing below was affected. Reloading will try again.
        </p>
      )}
      {result?.kind === 'no-parcel-geometry' && (
        <p role="note">
          The county matched this parcel but did not return its outline, so there is no boundary
          to measure distances from. Measuring from the middle of the lot instead would overstate
          how close things are, so no finding is offered.
        </p>
      )}
      {result?.kind === 'none-mapped' && (
        <>
          <p>Nothing is mapped within {result.radiusFt} ft of this parcel.</p>
          <p role="note">
            <strong>{COVERAGE_CAVEAT}</strong>
          </p>
        </>
      )}
      {result?.kind === 'assessed' && (
        <>
          <ul className="facts">
            {result.findings.map((finding) => (
              <li key={`${finding.feature.label}-${finding.assessment.distanceFt}`}>
                <span className="k">
                  {finding.feature.label}
                  {finding.feature.operator ? ` — ${finding.feature.operator}` : ''}
                </span>
                <span className="v">
                  {finding.assessment.distanceFt === 0
                    ? 'crosses the parcel'
                    : `${Math.round(finding.assessment.distanceFt)} ft away`}
                </span>
              </li>
            ))}
          </ul>
          <p>
            <strong>{result.findings[0]!.assessment.basis}</strong>{' '}
            {result.findings[0]!.assessment.implication}
          </p>
          <p role="note">{GEOMETRY_IS_NOT_A_DEED}</p>
          <p className="muted">
            <small>{COVERAGE_CAVEAT}</small>
          </p>
        </>
      )}
    </>
  );
}
