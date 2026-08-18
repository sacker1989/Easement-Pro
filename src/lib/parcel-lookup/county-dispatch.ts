/**
 * One address in, one parcel valuation out, across the counties that have a
 * live provider.
 *
 * WHY A DISPATCH RATHER THAN THREE CALL SITES. `/report` previously called the
 * LA provider directly and branched on `isLaCounty`. Orange County and San
 * Diego providers existed, were tested against live services, and no route
 * could reach them. Adding a second `if` per county does not scale past the
 * third, and it puts the decision of WHICH county is supported into the page.
 *
 * THE COUNTY-SPECIFIC CAVEATS SURVIVE. This is the part worth care. The three
 * providers return three different shapes because the three counties publish
 * different things, and the differences are not cosmetic:
 *
 *   - LA publishes `Roll_LandBaseYear`, so a frozen Proposition 13 assessment
 *     can be indexed forward.
 *   - Orange publishes NO base year and no roll year. Two comparable ~6,200 sq
 *     ft lots on the same street carry land values of $243,414 and $531,538.
 *     The distortion is visible and uncorrectable, so the figure travels with
 *     ORANGE_COUNTY_STALENESS_CAVEAT attached.
 *   - San Diego has no base-year column either, but DOCDATE recovers a vintage
 *     with a reliability grade, and that grade is the caveat.
 *
 * A unified shape that dropped those would produce three numbers that look
 * equally solid and are not. `landBaseYear` is therefore nullable and never
 * defaulted, and `caveats` carries the county's own warning verbatim.
 *
 * UNSUPPORTED IS A DISTINCT OUTCOME FROM NOT-FOUND. Most counties have no
 * provider. Saying "no parcel found" there would report a search that never
 * happened — the same distinction `registry.ts` draws for records requests,
 * and the same one `ACQUIRED = "N/A"` turns on: unknown is not no.
 */

import {
  createLaCountyAssessorProvider,
  createOrangeCountyAssessorProvider,
  createSanDiegoAssessorProvider,
  ORANGE_COUNTY_STALENESS_CAVEAT,
} from '@/lib/risk-disclosure';
import { COUNTY_AGENT_ROUTES } from '@/lib/jurisdiction/county-database';
import { createResilientFetch } from '@/lib/net/resilient-fetch';
import type { NormalizedAddress } from '@/lib/parcel-resolution/types';

/** A valuation normalised across counties, with the differences preserved. */
export interface UnifiedParcelValuation {
  readonly apn: string;
  readonly county: string;
  readonly state: string;
  readonly fipsCode: string | null;
  readonly situsAddress: string;
  readonly zip: string | null;
  readonly lotAreaSqFt: number;
  readonly landValue: number;
  readonly improvementValue: number;
  readonly landValuePerSqFt: number;
  /**
   * Null where the county publishes none. NEVER defaulted to the roll year:
   * the roll year says when a figure was published, the base year says what
   * market it reflects, and they are frequently decades apart.
   */
  readonly landBaseYear: string | null;
  readonly rollYear: string | null;
  /** The county's own warnings, verbatim. */
  readonly caveats: readonly string[];
  readonly serviceUrl: string;
  readonly queriedOn: string;
}

export interface ParcelCandidateRef {
  readonly apn: string;
  readonly situsAddress: string;
  readonly zip: string | null;
}

export type CountyLookupResult =
  | { readonly status: 'found'; readonly valuation: UnifiedParcelValuation }
  | { readonly status: 'ambiguous'; readonly county: string; readonly candidates: readonly ParcelCandidateRef[] }
  | { readonly status: 'not-found'; readonly county: string; readonly serviceUrl: string }
  | { readonly status: 'unsupported-county'; readonly county: string | null; readonly state: string; readonly explanation: string }
  | { readonly status: 'service-error'; readonly county: string; readonly message: string };

/** Counties with a live provider. Three, and the list is the honest scope. */
export const SUPPORTED_COUNTIES = ['Los Angeles County', 'Orange County', 'San Diego County'] as const;
export type SupportedCounty = (typeof SUPPORTED_COUNTIES)[number];

function routeFor(county: string): { fipsCode: string | null; serviceUrl: string } {
  const route = COUNTY_AGENT_ROUTES.find((r) => r.county === county);
  // AgentConfig is a union; only the gis-explorer arm carries a service URL.
  // Narrowing rather than casting means a county later routed to an
  // api-extractor reports an honest 'unknown' instead of undefined-as-string.
  const agent = route?.agent;
  const serviceUrl =
    agent !== undefined && agent.type === 'gis-explorer' && agent.esriServiceUrl !== undefined
      ? agent.esriServiceUrl
      : 'unknown';
  return { fipsCode: route?.fipsCode ?? null, serviceUrl };
}

/** Matches a resolved county name against the supported set, tolerantly. */
export function normaliseCountyName(county: string | undefined): SupportedCounty | null {
  if (county === undefined) return null;
  const c = county.trim().toLowerCase().replace(/\s+county$/, '');
  if (c === 'los angeles') return 'Los Angeles County';
  if (c === 'orange') return 'Orange County';
  if (c === 'san diego') return 'San Diego County';
  return null;
}

export interface CountyDispatchOptions {
  /** Injectable for tests. Defaults to the shared resilient wrapper. */
  readonly fetchImpl?: typeof fetch;
  readonly today?: string;
}

/**
 * ONE resilient fetch for the process, created lazily.
 *
 * Constructing it per lookup — which is what the first version of this file
 * did — gives every request a private cache that is empty on arrival and
 * discarded on return, so the cache never records a hit and the per-host
 * concurrency gate never sees the concurrency it exists to limit. Both of the
 * behaviours the Orange County 503 finding called for were silently inert.
 *
 * Lazy rather than eager because `createResilientFetch` throws in a browser,
 * and a module-level call would run during any accidental client import.
 */
let sharedFetch: typeof fetch | null = null;
function getSharedFetch(): typeof fetch {
  if (sharedFetch === null) sharedFetch = createResilientFetch();
  return sharedFetch;
}

/**
 * Looks a parcel up in whichever county provider covers the address.
 *
 * Every provider is constructed with the resilient fetch, so retry, backoff,
 * per-host concurrency and caching apply uniformly — Orange County in
 * particular returned 503 under modest load without it.
 */
export async function lookupParcel(
  address: NormalizedAddress,
  options: CountyDispatchOptions = {},
): Promise<CountyLookupResult> {
  const county = normaliseCountyName(address.county);
  const queriedOn = options.today ?? new Date().toISOString().slice(0, 10);

  if (county === null) {
    return {
      status: 'unsupported-county',
      county: address.county ?? null,
      state: address.state,
      explanation:
        `No live parcel provider has been built for ${address.county ?? 'this county'}, ` +
        `${address.state}. Three California counties are covered: ` +
        `${SUPPORTED_COUNTIES.join(', ')}. This is not a statement that no parcel exists — no ` +
        'search was performed, and the two outcomes must not be reported as one.',
    };
  }

  const fetchImpl = options.fetchImpl ?? getSharedFetch();
  const { fipsCode, serviceUrl } = routeFor(county);

  try {
    if (county === 'Los Angeles County') {
      const provider = createLaCountyAssessorProvider({ fetchImpl });
      const found = await provider.findByAddress(address.street, address.zip);
      if (found.status === 'ambiguous') {
        return {
          status: 'ambiguous',
          county,
          candidates: found.candidates.map((c) => ({
            apn: c.ain,
            situsAddress: c.situsFullAddress,
            zip: null,
          })),
        };
      }
      if (found.status !== 'found') return { status: 'not-found', county, serviceUrl };
      const v = found.valuation;
      return {
        status: 'found',
        valuation: {
          apn: v.apn,
          county,
          state: 'CA',
          fipsCode,
          situsAddress: v.situsFullAddress,
          zip: address.zip,
          lotAreaSqFt: v.lotAreaSqFt,
          landValue: v.landValue,
          improvementValue: v.improvementValue,
          landValuePerSqFt: v.landValuePerSqFt,
          landBaseYear: v.landBaseYear,
          rollYear: v.rollYear,
          caveats: [],
          serviceUrl,
          queriedOn,
        },
      };
    }

    if (county === 'Orange County') {
      const provider = createOrangeCountyAssessorProvider({ fetchImpl });
      const found = await provider.findByAddress(address.street, address.zip);
      if (found.status === 'ambiguous') {
        return {
          status: 'ambiguous',
          county,
          candidates: found.candidates.map((c) => ({
            apn: c.assessmentNo,
            situsAddress: c.siteAddress,
            zip: c.zip,
          })),
        };
      }
      if (found.status !== 'found') return { status: 'not-found', county, serviceUrl };
      const v = found.valuation;
      return {
        status: 'found',
        valuation: {
          apn: v.assessmentNo,
          county,
          state: 'CA',
          fipsCode,
          situsAddress: v.siteAddress,
          zip: v.zip,
          lotAreaSqFt: v.lotAreaSqFt,
          landValue: v.landValue,
          improvementValue: v.improvementValue,
          landValuePerSqFt: v.landValuePerSqFt,
          // Structurally null, not missing. The county publishes no base year.
          landBaseYear: null,
          rollYear: null,
          caveats: [ORANGE_COUNTY_STALENESS_CAVEAT],
          serviceUrl,
          queriedOn,
        },
      };
    }

    const provider = createSanDiegoAssessorProvider({ fetchImpl });
    const found = await provider.findByAddress(address.street, address.zip);
    if (found.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        county,
        candidates: found.candidates.map((c) => ({
          apn: c.apn,
          situsAddress: c.situsFullAddress,
          zip: c.zip,
        })),
      };
    }
    if (found.status !== 'found') return { status: 'not-found', county, serviceUrl };
    const v = found.valuation;
    return {
      status: 'found',
      valuation: {
        apn: v.apn,
        county,
        state: 'CA',
        fipsCode,
        situsAddress: v.situsFullAddress,
        zip: v.zip,
        lotAreaSqFt: v.lotAreaSqFt,
        landValue: v.landValue,
        improvementValue: v.improvementValue,
        landValuePerSqFt: v.landValuePerSqFt,
        // DOCDATE recovers a vintage but is not a published base year, so it
        // travels as a caveat carrying its own reliability grade rather than
        // being promoted into the base-year field.
        landBaseYear: null,
        rollYear: null,
        caveats: [
          `Assessment vintage recovered from DOCDATE: ${v.vintage.year ?? 'unparseable'} ` +
            `(reliability: ${v.vintage.reliability}). ${v.vintage.explanation}`,
        ],
        serviceUrl,
        queriedOn,
      },
    };
  } catch (err) {
    // A lookup failure must not sink the page. The caller degrades to a report
    // with no parcel figure, which is a supported state rather than an error.
    return {
      status: 'service-error',
      county,
      message: err instanceof Error ? err.message : 'Unknown lookup error',
    };
  }
}
