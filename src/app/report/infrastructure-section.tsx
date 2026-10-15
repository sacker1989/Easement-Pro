import { ringCentroid } from '@/lib/geo/planar-distance';
import { currentEntitlements } from '@/lib/entitlements/search-entitlements';
import { observe } from '@/lib/observability/outcome-log';
import { lookupCountyUtilities } from '@/lib/proximity/county-utilities';
import { lookupInfrastructure } from '@/lib/proximity/infrastructure';
import { fetchParcelGeometry } from '@/lib/proximity/parcel-geometry';
import {
  assessParcelInfrastructure,
  AGE_AND_CONDITION_UNKNOWN,
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

interface ScanOutcome {
  readonly assessed: ParcelInfrastructure;
  /** Named where the county supplied findings, for attribution. */
  readonly publishers: readonly string[];
  /** What a county layer does not cover, shown when it found nothing. */
  readonly coverageNotes: readonly string[];
}

async function scan(props: InfrastructureSectionProps): Promise<ScanOutcome | null> {
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
    if (geometry.kind !== 'ring') {
      return { assessed: { kind: 'no-parcel-geometry' }, publishers: [], coverageNotes: [] };
    }

    const [lon, lat] = ringCentroid(geometry.ring);

    /*
     * THE COUNTY'S OWN LAYERS FIRST, where it publishes any.
     *
     * Near four parcels in unincorporated Lakeside, OpenStreetMap returned
     * zero features and San Diego County's sewer layer returned twenty-two to
     * twenty-nine, each with a diameter, a material and a facility id. Where a
     * county publishes its network, it is both better data and faster — the
     * same servers the valuation already talks to, answering in well under a
     * second, against a public Overpass endpoint that fails more often than
     * it succeeds.
     *
     * Not a replacement: county layers cover one utility in one jurisdiction,
     * and OSM carries the transmission lines no county publishes. Both run,
     * and the findings merge.
     */
    const radiusFt = currentEntitlements().scanRadiusFt;
    const padDegrees = radiusFt / 364_000;
    const xs = geometry.ring.map((p) => p[0]);
    const ys = geometry.ring.map((p) => p[1]);
    const county = await lookupCountyUtilities({
      county: props.county,
      state: props.state,
      envelope: [
        Math.min(...xs) - padDegrees,
        Math.min(...ys) - padDegrees,
        Math.max(...xs) + padDegrees,
        Math.max(...ys) + padDegrees,
      ],
    });

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
      () => lookupInfrastructure({ lat, lon, radiusFt }),
    );

    /*
     * MERGED, WITH THE COUNTY’S FEATURES FIRST. assessParcelInfrastructure
     * sorts by tier and then distance, so ordering here only decides ties;
     * what matters is that both sources reach the tiering at all. A county
     * outage must not look like an empty street, so a failed county lookup
     * still lets the OSM result through and vice versa.
     */
    const merged =
      county.kind === 'found'
        ? nearby.kind === 'found'
          ? { ...nearby, features: [...county.features, ...nearby.features] }
          : { kind: 'found' as const, features: county.features, radiusFt, queriedOn: new Date().toISOString().slice(0, 10) }
        : nearby;

    const assessed = assessParcelInfrastructure(merged, geometry.ring);
    return {
      assessed,
      publishers: county.kind === 'found' ? county.publishers : [],
      coverageNotes: county.kind === 'none-found' ? county.coverageNotes : [],
    };
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
  const outcome = await scan(props);
  const result = outcome?.assessed ?? null;

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
        <>
          <p role="note">
            This scan did not complete — {result.reason}. Nothing else in this report depends on
            it, and nothing below was affected. Reloading will try again.
          </p>
          {/*
            THE COUNTY'S ANSWER SURVIVES THE OTHER SOURCE FAILING.

            Caught by checking a city address on production: OpenStreetMap was
            down, the county layer answered cleanly with nothing, and the
            reader saw only "the scan did not complete". That throws away the
            more useful half — the county DID answer, and it can say why it
            has nothing here. Two sources, two outcomes; collapsing them into
            one sentence loses whichever one worked.
          */}
          {outcome?.coverageNotes.map((note) => (
            <p key={note} role="note">
              {note}
            </p>
          ))}
        </>
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
          {/*
            THE COUNTY'S OWN COVERAGE STATEMENT, WHERE IT HAS ONE.

            Absence inside a service area and absence outside one look
            identical in a query result and mean opposite things. San Diego
            County DPW serves county service areas; El Cajon runs its own
            sewers and is simply not in that layer. Without this sentence a
            reader in a city is told the county found no sewer and may hear
            "there is no sewer here".
          */}
          {outcome?.coverageNotes.map((note) => (
            <p key={note} role="note">
              {note}
            </p>
          ))}
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
          {/*
            THE OBVIOUS NEXT QUESTION, ANSWERED WITH ITS ABSENCE. A reader
            looking at "vitrified clay sewer main" asks how old it is, and
            none of these sources publishes that. Saying so is better than
            leaving a gap the reader fills in for themselves.
          */}
          <p role="note">{AGE_AND_CONDITION_UNKNOWN}</p>
          {/*
            ATTRIBUTION WHERE THE COUNTY SUPPLIED SOMETHING. A reader weighing
            a finding should be able to tell a county's own record of its own
            pipes from a volunteer map, because those carry very different
            weight — and the next step differs too: a county facility id is
            something you can ring the county about.
          */}
          {outcome !== null && outcome.publishers.length > 0 && (
            <p className="muted">
              <small>
                Some of these come from {outcome.publishers.join(' and ')} — the county&rsquo;s own
                record of its own network, which is a stronger source than the volunteer map below
                and still not a record of who may cross your land.
              </small>
            </p>
          )}
          <p className="muted">
            <small>{COVERAGE_CAVEAT}</small>
          </p>
        </>
      )}
    </>
  );
}
