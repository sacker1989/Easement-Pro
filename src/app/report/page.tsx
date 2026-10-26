import Link from 'next/link';
import { resolveAddress, zipHeuristicCountyResolver } from '@/lib/parcel-resolution';
import { Suspense } from 'react';
import { audienceCopy, BUYER_DECISION_WARNING, resolveAudience } from '@/lib/audience/audience-mode';
import {
  InfrastructurePending,
  InfrastructureSection,
} from './infrastructure-section';
import { resolveStateCode } from '@/lib/parcel-resolution/us-states';
import {
  buildRiskDisclosureReport,
  createLaCountyAssessorProvider,
  InvalidRiskDisclosureInputError,
} from '@/lib/risk-disclosure';
import type { AssessorParcelValuation, EasementPurpose } from '@/lib/risk-disclosure';
import { headlinePhrase, mapEasementTypeToPurpose } from '@/lib/risk-disclosure/easement-purpose-map';
import { LANDSCAPING_ACCESS_CONDITION } from '@/lib/risk-disclosure/restriction-checklist';
import { EASEMENT_TYPES, type EasementType } from '@/lib/easements/easement-types';
import {
  screeningEstimate,
  ORIENTATION_ONLY_BANNER,
  THREE_REGIME_DISCLOSURE,
  type ScreeningResult,
} from '@/lib/valuation/screening-estimate';
import {
  areaIsEstablished,
  ASSUMED_AREA_CAVEAT,
  AREA_FIELD_HINT,
  assumedAreaFromLot,
  assumedFromLotCaveat,
  DEFAULT_EASEMENT_AREA_SQ_FT,
  easementAreaProvenance,
} from '@/lib/valuation/easement-area-provenance';
import { buildRemedyPlan, COST_TIER_LABEL, type RemedyPlan } from '@/lib/advocacy/remedy-plan';
import {
  buildValuationEstimate,
  STRIP_ONLY_WARNING,
  type ValuationEstimate,
} from '@/lib/valuation/build-valuation-estimate';
import { EXPECTATIONS, NO_LIST_NO_FEE } from '@/lib/referral-network/what-to-expect';
import {
  RESPONSIBILITIES_DISCLOSURE,
  responsibilitiesFor,
  type Party,
} from '@/lib/easements/responsibilities';
import { analyzeEasement } from '@/lib/analysis-layer';
import { GEOCODE_DISCLOSURE, geocodeAddress } from '@/lib/proximity/geocode';
import { observe } from '@/lib/observability/outcome-log';
import {
  FLOOD_ZONE_DISCLOSURE,
  floodImplication,
  lookupFloodZone,
} from '@/lib/proximity/flood-zone';
import {
  FIRE_SEVERITY_DISCLOSURE,
  buildFireSafetyContent,
  buildFireStatusNote,
  lookupFireSeverity,
  type FireSeverityResult,
} from '@/lib/proximity/fire-severity';
import {
  buildFloodVulnerabilityContent,
  FLOOD_VULNERABILITY_HEADING,
} from '@/lib/proximity/flood-vulnerability';
import type { EasementLegalCharacter } from '@/lib/analysis-layer/duration-facts';
import {
  SHOULD_EXIST_DISCLOSURE,
  THE_QUESTION_TO_ASK,
  TRIGGER_LABEL,
  whatShouldExist,
  type Posture,
} from '@/lib/easements/should-exist';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import { legalReviewDisclosure } from '@/lib/compliance/legal-review-disclosure';
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

/**
 * NOINDEX, AS A HEADER RATHER THAN ONLY A ROBOTS.TXT LINE.
 *
 * This route is reached by a GET form, so its URL carries the homeowner's
 * street address. robots.txt asks well-behaved crawlers not to index it;
 * this emits an X-Robots-Tag that is considerably harder to ignore. Neither
 * substitutes for the other, and the thing being protected is a real
 * residential address attached to a page about a dispute over someone's land.
 */
export const metadata = { robots: { index: false, follow: false } };


/**
 * THE APP'S OWN FETCH BUDGET IS 25 SECONDS, so the function must outlive it.
 *
 * `resilient-fetch.ts` allows three attempts with backoff against a county
 * ArcGIS service, under a 25s total ceiling. A serverless function that dies
 * at 10s kills the request mid-retry and the homeowner sees a failure for a
 * lookup that would have succeeded — the worst case, because the retry logic
 * exists precisely because these services are intermittently slow.
 *
 * 30 EXCEEDS VERCEL'S HOBBY LIMIT OF 10 and requires a Pro plan. On Hobby this
 * value is ignored and the 10s cap applies, so either lower the fetch budget
 * in resilient-fetch.ts to fit under it or accept that slow counties fail. The
 * runbook says so; it is not a thing to discover from a user report.
 */
export const maxDuration = 30;

interface ReportPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * A lot area the county actually published, or null.
 *
 * ZERO IS A SENTINEL IN EVERY PROVIDER, AND `??` ACCEPTS IT. That cost the
 * whole report on production: the page read `unified?.lotAreaSqFt ?? …`, got
 * the zero a county publishes for a parcel it gives no land area for, and
 * concluded an 800 sq ft easement was larger than the parcel — rendering
 * "Easement area (800 sq ft) exceeds this parcel's actual lot area of 0 sq
 * ft" in place of everything. 92,118 of Cook County's 1,865,928 parcels
 * publish no LANDSF, almost all of them exempt classes.
 *
 * MODULE SCOPE BECAUSE THERE WERE FOUR READS, NOT ONE. Fixing the comparison
 * left three more live: the IRWA estimate's input, the diagram's scale — where
 * a zero makes the easement fill the entire lot — and two panels that printed
 * "0 sq ft" as a measurement. A helper that has to be reached for is how the
 * fifth read gets written correctly.
 */
function measuredArea(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Minimal, functional demo of the Step 3 module (Track 3 risk-disclosure
 * report), wired to Step 1's address resolution to derive the data-coverage
 * label — the "good first vertical slice to prove the full pipeline end to
 * end" the strategy doc describes. Not the UX Agent's polished risk card
 * (real lot diagram, expandable methodology panel) — this is a harness.
 */
/**
 * Badge text for who typically bears a duty.
 *
 * "USUALLY" on every one of them, including the two that look definite. The
 * badge is the part a skimming reader takes away, so it has to carry the
 * hedge that the surrounding prose carries.
 */
/**
 * Which side of an undocumented arrangement the homeowner is on.
 *
 * "YOU ARE THE EXPOSED PARTY" is deliberately blunt for the benefited case.
 * The neutral label would be "you benefit", which reads as good news and is
 * precisely the misreading the module exists to correct.
 */
const POSTURE_LABEL: Record<Posture, string> = {
  burdened: 'SOMETHING CROSSES YOUR LAND',
  benefited: 'YOU ARE THE EXPOSED PARTY',
  mutual: 'SHARED WITH A NEIGHBOUR',
};

const PARTY_LABEL: Record<Party, string> = {
  holder: 'USUALLY THE HOLDER',
  owner: 'USUALLY YOU',
  shared: 'USUALLY SHARED',
  'depends-on-document': 'DEPENDS ON THE DOCUMENT',
};

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const street = param(searchParams.street);
  const city = param(searchParams.city);
  /*
   * BOTH OF THESE ARE VALIDATED HERE, AT THE BOUNDARY, because both reached
   * library code entitled to assume they already had been.
   *
   * `state` went straight to analyzeEasementAt, whose contract is a
   * two-letter code and which throws on anything else — correctly calling it
   * "a programmer error rather than an unsupported jurisdiction". It was
   * right about its contract; this page was the programmer error. Measured on
   * a production build, `?state=California` returned HTTP 500, and the state
   * field carries autoComplete="address-level1", which browsers routinely
   * fill with the full name.
   *
   * `easementType` was HALF validated, which is worse than not at all: the
   * conditional below guarded typeMapping and nothing else, so the
   * unvalidated value still went to responsibilitiesFor, whatShouldExist,
   * buildRemedyPlan, buildFireSafetyContent, buildFloodVulnerabilityContent
   * and the picker's defaultValue. `?easementType=anything` returned HTTP 500
   * on "Cannot read properties of undefined (reading 'heading')" — one
   * guarded call site and six unguarded ones, which is exactly the shape a
   * local fallback produces.
   *
   * Validating once and using the result everywhere makes the second class of
   * bug impossible rather than fixed.
   */
  const state = resolveStateCode(param(searchParams.state)) ?? 'CA';
  const zip = param(searchParams.zip);
  /*
   * WHO IS READING. The facts are identical either way — same parcel, same
   * restrictions, same duties, same county figures. What changes is what the
   * reader can do about them: an owner already has the encumbrance and moves
   * slowly, a buyer can still walk away or push it into the contract and has
   * a contingency window that expires. Resolved rather than validated,
   * because unknown input must land on the owner view that every existing
   * link already means.
   */
  const audience = resolveAudience(param(searchParams.audience));
  const copy = audienceCopy(audience);
  // The interface now selects a physical easement TYPE (twelve of them) and
  // derives the purpose, rather than offering the five purposes directly.
  // Seven types were previously unreachable from this page.
  const requestedType = param(searchParams.easementType);
  const easementType: EasementType = EASEMENT_TYPES.includes(requestedType as EasementType)
    ? (requestedType as EasementType)
    : 'utility-overhead';
  const typeMapping = mapEasementTypeToPurpose(easementType);
  const easementPurpose: EasementPurpose = typeMapping.purpose;
  const typedLotAreaSqFt = Number(param(searchParams.lotAreaSqFt) || '8000');
  /*
   * THE AREA'S PROVENANCE IS READ BEFORE THE AREA ITSELF, because once the
   * default has been substituted there is no way to tell the two apart — and
   * the difference is the difference between a figure about this property and
   * a figure about 800 sq ft. The homepage posts an address and nothing else,
   * so the primary funnel is always 'assumed-default'.
   */
  const areaProvenance = easementAreaProvenance(param(searchParams.easementAreaSqFt));
  let easementAreaSqFt =
    areaProvenance === 'assumed-default'
      ? DEFAULT_EASEMENT_AREA_SQ_FT
      : Number(param(searchParams.easementAreaSqFt));
  /*
   * DURATION FACTS, read separately from the physical easement type above.
   *
   * `legalCharacter` rather than reusing `easementType`: the two are
   * orthogonal axes that were once both called "easement type" in this
   * codebase, and a sewer easement (physical) may be appurtenant or in gross
   * (legal). Sharing a query parameter would have silently merged them.
   *
   * ILLEGIBLE IS THE CHECKBOX, NOT LEGIBLE. An unchecked box is the default,
   * and the default has to be the common case — most people can read their
   * document. Asking "is it legible?" and defaulting to unchecked would make
   * every untouched form claim an unreadable document and flag every report.
   */
  const legalCharacter = (param(searchParams.legalCharacter) || 'unknown') as EasementLegalCharacter;
  const hasPerpetualLanguage = param(searchParams.hasPerpetualLanguage) === '1';
  const hasTermOrConditionSubsequent = param(searchParams.hasTermOrConditionSubsequent) === '1';
  const documentLegible = param(searchParams.documentIllegible) !== '1';

  const selectedAin = param(searchParams.ain);
  const submitted = searchParams.submitted === '1';

  /*
   * FLOOD ZONE, FROM THE ADDRESS ALONE.
   *
   * Two sequential upstream calls, and both are allowed to fail without
   * affecting anything else on the page — geocode, then FEMA. Neither throws;
   * the result types carry the degraded states. Run only on submit, and only
   * when there is an address to work from.
   *
   * NATIONAL, which is the point. Live parcel data exists for three counties.
   * This answers something real for every address in the country, which is the
   * difference between a product for Los Angeles and a product.
   */
  const geocoded =
    submitted && street.trim() !== '' && zip.trim() !== ''
      ? await observe(
          'census-geocoder',
          (r) => ({
            result: r.kind === 'matched' ? 'ok' : r.kind === 'no-match' ? 'degraded' : 'failed',
            reason: r.kind === 'no-match' ? 'no-match' : r.kind === 'lookup-failed' ? 'http-error' : undefined,
            state,
          }),
          () => geocodeAddress({ street, city, state, zip }),
        )
      : null;

  /*
   * FIRE HAZARD SEVERITY, FROM THE ADDRESS ALONE — CAL FIRE FHSZ, run in
   * PARALLEL with the FEMA query. Both are additive panels: an upstream
   * failure in either must not affect the other or anything else on the page.
   * The two lookups share only the geocoded coordinates, so running them
   * together adds max(FEMA, CAL FIRE), not the sum.
   */
  const [floodZone, fireSeverity] =
    geocoded?.kind === 'matched'
      ? await Promise.all([
          observe(
            'fema-nfhl',
            (r) => ({
              result:
                r.kind === 'found' ? 'ok' : r.kind === 'no-map-coverage' ? 'degraded' : 'failed',
              reason:
                r.kind === 'no-map-coverage'
                  ? 'no-coverage'
                  : r.kind === 'lookup-failed'
                    ? 'http-error'
                    : undefined,
              state,
            }),
            () => lookupFloodZone({ lat: geocoded.lat, lon: geocoded.lon }),
          ),
          observe(
            'calfire-fhsz',
            (r) => ({
              result:
                r.kind === 'in-hazard-zone' || r.kind === 'not-in-hazard-zone'
                  ? 'ok'
                  : r.kind === 'no-map-coverage'
                    ? 'degraded'
                    : 'failed',
              reason: r.kind === 'lookup-failed' ? 'http-error' : undefined,
              state,
            }),
            () => lookupFireSeverity({ lat: geocoded.lat, lon: geocoded.lon }),
          ),
        ])
      : [null, null];

  const durationAnalysis = submitted
    ? analyzeEasement({
        state,
        duration: {
          easementType: legalCharacter,
          hasPerpetualLanguage,
          hasTermOrConditionSubsequent,
          documentLegible,
        },
      })
    : null;

  /*
   * ONE LOT AREA FOR THE WHOLE PAGE.
   *
   * There were two. The calculations read "unified ?? valuation ?? typed";
   * the diagram read "valuation ?? typed" and nothing else. For a parcel
   * where the unified dispatch carried county geometry but the LA-shaped
   * valuation did not — every Orange, San Diego and Cook match — the figures
   * used the county's lot while the diagram drew the 8,000 sq ft form
   * default. Observed on 2026-10-21: Newport Beach rendered "Lot: 8,000 sq
   * ft" against a county lot of 3,184, while Koreatown rendered its 16,269
   * correctly, from the same build.
   */
  let resolvedLotAreaSqFt: number | null = null;
  /** True when the assumed area was derived from the matched lot. */
  let assumedFromLot = false;
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
  let screening: ScreeningResult | null = null;
  let irwa: ValuationEstimate | null = null;
  let remedy: RemedyPlan | null = null;
  const acquisitionPending = searchParams.acquisitionPending === '1';

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

      /*
       * A matched parcel supplies the real lot area, so the typed value is
       * only a fallback. Guard the easement against exceeding it — the real
       * lot may be smaller than whatever was typed.
       *
       * ?? WAS THE WRONG OPERATOR AND IT COST EVERY AFFECTED ADDRESS ITS
       * WHOLE REPORT. The providers return 0 for a lot area the county does
       * not publish, not null, so `??` accepted the zero as a measurement.
       * The comparison below then fired on every one of them — 800 sq ft is
       * greater than 0 — producing "exceeds this parcel's actual lot area of
       * 0 sq ft" and no report. 92,118 Cook parcels publish no LANDSF.
       *
       * Checking for a POSITIVE number rather than a non-null one is the fix,
       * and it belongs here as well as in the Cook provider: this line is the
       * single place every county's area converges, so a sentinel from any
       * future provider is caught once rather than per county.
       */
      const lotAreaSqFt =
        measuredArea(unified?.lotAreaSqFt) ?? measuredArea(valuation?.lotAreaSqFt) ?? typedLotAreaSqFt;
      resolvedLotAreaSqFt = lotAreaSqFt;

      /*
       * THE ASSUMED EASEMENT AREA SCALES WITH THE PARCEL, once there is one.
       *
       * The flat 800 sq ft default was 10% of the form's own default lot
       * (8,000) — a proportion resolved against a placeholder and then
       * frozen. Against real geometry it lands anywhere: 25% of a 3,184 sq ft
       * Newport Beach lot, 4.9% of a 16,269 sq ft Koreatown one, from one
       * constant.
       *
       * ONLY WHEN THE COUNTY ACTUALLY PUBLISHED AN AREA. measuredArea already
       * rejects the 0 that providers emit for "not published", so an
       * unmeasured lot keeps the flat placeholder rather than taking 10% of a
       * fallback — which would be the original mistake with extra steps.
       */
      const lotIsMeasured =
        measuredArea(unified?.lotAreaSqFt) !== null || measuredArea(valuation?.lotAreaSqFt) !== null;
      if (areaProvenance === 'assumed-default' && lotIsMeasured) {
        easementAreaSqFt = assumedAreaFromLot(lotAreaSqFt);
        assumedFromLot = true;
      }

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
            /*
             * THE OTHER THREE COUNTIES' LAND VALUE, which was being read and
             * then dropped. `valuation` above is the LA-shaped record, so
             * Orange, San Diego and Cook reached the economic impact with no
             * price at all — even though `unified.landValuePerSqFt` is right
             * here and is rendered in the parcel panel a few hundred lines
             * below.
             *
             * It did not look like a bug while an invented national average
             * stood in for it. Once that was deleted the report started
             * saying "No land value is published for this address" directly
             * under a panel showing the published land value, which is how it
             * was finally noticed.
             *
             * Guarded on a positive number: a roll can carry 0 for an exempt
             * parcel, and dividing a report's headline figure by a zero land
             * value is worse than declining to price it.
             */
            countyLandValue:
              unified && unified.landValuePerSqFt > 0
                ? { county: unified.county, perSqFt: unified.landValuePerSqFt }
                : undefined,
            /*
             * WHY, NOT JUST WHETHER. Without this the condominium case got
             * the "no land value is published for this address… your county
             * assessor publishes one" sentence, directly beneath a panel
             * displaying the land value the county published. The county has
             * the figure; what it does not have is a lot area belonging to
             * this owner alone.
             */
            noPriceReason:
              unified?.lotTenure === 'undivided-interest' ? 'undivided-interest' : undefined,
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

          // The screening range. Refusal and insufficient-data are ordinary
          // outcomes here, not errors — four of the twelve types have no
          // citable band, and a parcel with no county match has no land value.
          screening = screeningEstimate({
            easementType,
            landValuePerSqFt: unified?.landValuePerSqFt ?? valuation?.landValuePerSqFt ?? null,
            encumberedAreaSqFt: easementAreaSqFt,
            totalPropertyValue:
              unified !== null ? unified.landValue + unified.improvementValue : null,
            valueSource:
              unified !== null
                ? `${unified.county} assessor${unified.rollYear ? `, ${unified.rollYear} roll` : ''}, queried ${unified.queriedOn}`
                : 'No county assessment matched this address.',
            // LA publishes a base year; Orange and San Diego do not, and the
            // range inherits that uncertainty in full.
            assessmentVintageUnknown: unified === null || unified.landBaseYear === null,
          });


          /*
           * THE IRWA ESTIMATE, alongside the screening range rather than
           * replacing it. The two answer the same question by different
           * routes and on the same underlying assessed figures — the value is
           * in a homeowner seeing a named method and its bounds, not in a
           * second number implying a second source.
           *
           * It refuses for exactly the four types the screening range refuses,
           * by reading that module's own refusal text, so the page can never
           * show "no estimate is possible" beside an estimate.
           */
          irwa = buildValuationEstimate({
            easementType,
            // Same sentinel, same fix: an unpublished area must not reach the
            // valuation as a measured zero. lotAreaSqFt above already
            // resolved the fallback chain.
            lotAreaSqFt,
            easementAreaSqFt,
            landValuePerSqFt: unified?.landValuePerSqFt ?? valuation?.landValuePerSqFt ?? null,
            valueSource:
              unified !== null
                ? `${unified.county} assessor${unified.rollYear ? `, ${unified.rollYear} roll` : ''}, queried ${unified.queriedOn}`
                : 'No county assessment matched this address.',
          });

          remedy = buildRemedyPlan({
            easementType,
            instrumentInHand: false,
            easementConfirmed: false,
            /*
             * FROM THE AREA'S OWN PROVENANCE, never from the parcel match.
             * This read `unified !== null` — the county PARCEL match — which
             * establishes the LOT area and says nothing about the easement
             * footprint, so the step telling the reader to go and measure it
             * was suppressed precisely where the county data was good. See
             * easement-area-provenance.ts.
             */
            areaEstablished: areaIsEstablished(areaProvenance),
            acquisitionPending,
            hasScreeningRange: screening.status === 'range',
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

  /*
   * DRIVES THE DIAGRAM'S SCALE, so a zero here makes the easement fill the
   * whole lot. measured() is applied for the same reason as above: the
   * providers publish 0 for an area the county does not give.
   */
  // The single source hoisted above, so the diagram and the figures cannot
  // disagree. Falls back only when no lookup ran at all.
  const effectiveLotArea = resolvedLotAreaSqFt ?? measuredArea(valuation?.lotAreaSqFt) ?? typedLotAreaSqFt;
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

  /**
   * The same report, read as the other party.
   *
   * REBUILT FROM THE RESOLVED VALUES rather than by editing the incoming
   * query string, so a reader who arrived with `?state=California` or an
   * unknown easementType gets the corrected ones carried across instead of
   * the input that produced them. Everything the reader supplied survives the
   * switch; only the audience flips.
   */
  const switchAudienceHref = (() => {
    const q = new URLSearchParams({
      submitted: '1',
      street,
      city,
      state,
      zip,
      easementType,
      lotAreaSqFt: String(typedLotAreaSqFt),
      easementAreaSqFt: String(easementAreaSqFt),
      audience: audience === 'owner' ? 'buyer' : 'owner',
    });
    return `/report?${q}`;
  })();

  /*
   * THE ADDRESS PROBABLY DOES NOT EXIST, and saying so beats a confident
   * report about nowhere.
   *
   * A production sweep on 2026-10-21 put "99999 Zzzqqq Ln, Xyz, CA 00000"
   * through the site and got a full report with national-benchmark dollar
   * figures and no error anywhere on the page. Nothing was wrong with any
   * component: the county correctly found no parcel, the benchmarks
   * correctly applied, and the sum of two correct behaviours was a confident
   * document about a place that is not real.
   *
   * TWO SOURCES MUST BOTH FAIL, which is the part worth keeping. The Census
   * geocoder interpolates along published address ranges and genuinely
   * misses real places — new construction, rural routes, recently annexed
   * streets. Blocking on it alone would turn away people whose addresses are
   * fine. And the county is the stronger witness: if it matched a parcel,
   * the address exists whatever Census thinks.
   *
   * So this fires only when the geocoder found nothing AND no county parcel
   * matched. Either one alone is a miss; both together is an address.
   *
   * Verified against the negative case: Census returns 0 matches for the
   * nonsense address and 1 for 3375 Marengo Ave, Altadena.
   */
  const geocodeMissed = geocoded !== null && geocoded.kind === 'no-match';
  /*
   * NOT JUST 'not-found'. The nonsense address from the sweep — ZIP 00000 —
   * resolves to 'unsupported-county', because no county owns that ZIP. A
   * check keyed on 'not-found' alone never fired for the exact input that
   * prompted it, which is how a guard passes its own test and misses its own
   * case. What matters is that NO county confirmed the address, however the
   * dispatch describes the reason.
   */
  const parcelConfirmed = lookup?.status === 'found' || lookup?.status === 'ambiguous';
  const addressLooksUnreal = submitted && geocodeMissed && !parcelConfirmed;


  return (
    <main>
      {/*
        THE HEADLINE USED TO PRESUME THE EASEMENT EXISTS.
        "What an easement on your property means" asserts there is one. The
        tool cannot establish that and never tries: the visitor picks a type
        from a dropdown — defaulted to overhead utility — and everything below
        explains that type. A live test ran nine addresses and not one report
        named a recorded easement, a holder or an instrument, because there is
        no code path that could.

        The report's own open-questions list already conceded it at item five
        ("Whether an easement encumbers this parcel at all… resolved by: title
        company"), which is the right admission in the wrong place: a reader
        who believes the headline has no reason to scroll to the caveat that
        withdraws it.

        So the headline is now CONDITIONAL and names the type the reader chose,
        and the premise line directly under it says whose claim this is. That
        is also what makes the rest of the page honest rather than merely
        hedged — everything downstream genuinely is "what this type means".
      */}
      <h1>What {headlinePhrase(easementType)} would mean for {copy.propertyPhrase}</h1>
      <p role="note">
        <strong>You chose {headlinePhrase(easementType)}.</strong> This report
        explains what that kind of easement means — it does not check whether one is recorded
        against {copy.propertyPhrase}, and it has read no deed, plat or title report. Establishing
        that an easement exists takes a title search. If you are not sure which kind you have, or
        whether you have one,{' '}
        <Link href={`/learn/${easementType}`}>the guide for this type</Link> covers how to find out.
      </p>
      {/*
        THE COVERAGE NOTICE SITS HERE, NOT 300 LINES DOWN.

        It used to render below the summary block, on the reasoning that a
        notice describes the report that follows and so belongs beside it.
        That is true and it was still too low: a production sweep on
        2026-10-21 found parcel data returned for two of nine addresses, and
        the seven failures read as ordinary reports because the one sentence
        saying the figures were national benchmarks was below the fold.

        A reader who never scrolls to it treats a benchmark figure as their
        county's own number. That is the difference between a report that
        degraded honestly and one that quietly made something up, and it
        cannot depend on scroll depth.
      */}
      {/*
        WE COULD NOT FIND THIS ADDRESS AT ALL — shown instead of the coverage
        notice, because "figures below use national benchmarks" is the wrong
        thing to say about a place that may not exist. See addressLooksUnreal.
      */}
      {addressLooksUnreal && (
        <div className="notice notice-warn" role="alert">
          <p style={{ marginTop: 0 }}>
            <strong>We couldn&rsquo;t find that address.</strong> Neither the national address
            index nor any county assessor we cover has a record matching{' '}
            <strong>
              {street}, {city} {zip}
            </strong>
            .
          </p>
          <p style={{ marginBottom: 0 }}>
            Check the street number, spelling and ZIP and{' '}
            <a href="#address">try again</a>. Everything below is general information about{' '}
            {headlinePhrase(easementType)} — <strong>none of the figures describe this
            address</strong>, because we found nothing to describe.
          </p>
        </div>
      )}
      {!addressLooksUnreal && lookupNotice && (
        <p className="notice notice-warn" role="status">
          {lookupNotice}
        </p>
      )}
      <p className="lede">{copy.standfirst}</p>
      <p className="lede">
        This reads public parcel, assessment and infrastructure records and reports what they say:
        which activities are typically restricted, what the county publishes about the lot, a rough
        sense of the scale of money involved, and a plan for what to do next. It also states what it
        cannot determine, which for an easement is a great deal. The range it gives is for
        orientation — enough to tell you whether this is worth a professional&rsquo;s time. It is not
        a valuation, and the report is explicit about why not.
      </p>

      {/*
        THE BUYER WARNING SITS ABOVE EVERYTHING, not beside the figures.

        A buyer can act on this report in ways an owner cannot — by pricing an
        offer, waiving a contingency, or walking away — and all three are
        expensive to get wrong on the strength of a tool that has read no
        documents. The owner path has no equivalent because its mistakes are
        slower and cheaper to undo.
      */}
      {audience === 'buyer' && (
        <p role="note">
          <strong>{BUYER_DECISION_WARNING}</strong>
        </p>
      )}

      {/*
        The switch is a link rather than a control, so it works with no
        JavaScript and so the two modes are separately linkable — an agent can
        send a client the buyer view directly.
      */}
      <p className="muted">
        <small>
          Reading this as{' '}
          <strong>{audience === 'owner' ? 'the owner' : 'someone considering buying'}</strong>.{' '}
          <a href={switchAudienceHref}>
            {audience === 'owner'
              ? 'I am considering buying this property instead'
              : 'I own this property instead'}
          </a>
        </small>
      </p>

      {/*
        ABOVE THE FORM, BECAUSE THAT IS WHERE SOMEONE WHO JUST SUBMITTED
        LOOKS. This block used to render after the form and after the summary
        panel, so a request that failed validation showed the form again with
        "city is required" below the easement-type explanation and level with
        the footer links. role="alert" meant screen readers were told; sighted
        readers saw a form that had silently done nothing.

        Found by experiments/report-sweep.mjs on 648 San Ysidro Blvd, where
        the county publishes a blank SITUS_COMMUNITY so the sweep sent no
        city. The City input carries `required`, so an ordinary submission
        cannot reach this — it needs a hand-edited or truncated URL. That is
        a narrow path and it is also exactly the path that produced this
        project's two live 500s.

        Safe to move: `error` is only ever set where no report was built, and
        the page-ordering tests key on h2 headings rather than on this.
      */}
      {error && <p role="alert">{error}</p>}

      <form id="address">
        <input type="hidden" name="submitted" value="1" />
        <fieldset>
          <legend>Property address</legend>
          <div className="field-row">
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
          </div>
          {/*
            THE SAME STALE CLAIM THE HOMEPAGE CARRIED, one page over. It said
            an uncovered address "uses national benchmarks and says so", which
            stopped being true when the invented national land value was
            deleted: for a land value the report now substitutes nothing and
            says it cannot price the easement. The homepage was corrected on
            2026-10-11 and this line was missed, which is the ordinary way a
            claim survives its own correction — it was not where anyone looked.
          */}
          <p className="muted" style={{ marginTop: '0.6rem' }}>
            Live county records: {SUPPORTED_COUNTIES.join(', ')}. Anywhere else still produces a
            report — the restrictions, the maintenance duties and the hazard data are the same
            everywhere. Without a published land value it tells you it cannot price the easement,
            rather than reaching for a national average.
          </p>
        </fieldset>

        <fieldset>
          <legend>The easement</legend>
          <label>
            What kind of easement is it?
            <select name="easementType" defaultValue={easementType}>
              {EASEMENT_TYPES.map((t) => {
                const m = mapEasementTypeToPurpose(t);
                return (
                  <option key={t} value={t}>
                    {m.label}
                    {m.reviewed ? '' : ' — treated conservatively'}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="field-row" style={{ marginTop: '0.75rem' }}>
            <label>
              Lot area (sq ft)
              <input name="lotAreaSqFt" type="number" defaultValue={typedLotAreaSqFt} />
            </label>
            <label>
              Easement area (sq ft)
              {/*
                PLACEHOLDER, NOT defaultValue, when nothing was supplied. A
                defaultValue puts 800 in the box as though the reader had typed
                it, which is how the assumption stayed invisible: the figure
                below said 800 and so did the field, and nothing distinguished
                that from a number they had chosen. An empty field with a greyed
                hint reads as the open question it is.
              */}
              <input
                name="easementAreaSqFt"
                type="number"
                {...(areaProvenance === 'assumed-default'
                  ? { placeholder: `e.g. ${DEFAULT_EASEMENT_AREA_SQ_FT}` }
                  : { defaultValue: easementAreaSqFt })}
              />
            </label>
          </div>
          <label style={{ marginTop: '0.9rem' }}>
            <input
              type="checkbox"
              name="acquisitionPending"
              value="1"
              defaultChecked={acquisitionPending}
              style={{ width: 'auto', marginRight: '0.5rem' }}
            />
            A utility or agency has contacted me about acquiring an easement
          </label>
          <p className="muted" style={{ marginTop: '0.6rem' }}>
            Lot area is ignored when a county parcel matches — the county&rsquo;s own geometry is
            used instead. {AREA_FIELD_HINT}
          </p>
        </fieldset>

        {/*
          ITS OWN FIELDSET, AND A DIFFERENT AXIS FROM THE ONE ABOVE. The
          easement fieldset asks what the easement CARRIES — sewer, overhead
          line, driveway. This one asks what the recorded DOCUMENT says. The
          two were once both called "easement type" in this codebase and the
          collision is documented at length in duration-facts.ts; keeping them
          in separate fieldsets with different words is the user-facing half of
          not repeating it.

          Everything here is optional and defaults to "I don't know", because a
          homeowner who has not dug out their deed should still get a report.
        */}
        <fieldset>
          <legend>Your easement document (optional)</legend>
          <p className="muted" style={{ marginTop: 0 }}>
            If you have the recorded document in front of you, these three answers let the report
            say more. Skip them if you don&rsquo;t — everything above still works.
          </p>
          <label>
            Who holds it?
            <select name="legalCharacter" defaultValue={legalCharacter}>
              <option value="unknown">I don&rsquo;t know</option>
              <option value="appurtenant">
                A neighbouring property (appurtenant — it goes with their land)
              </option>
              <option value="in-gross">
                A company or person (in gross — e.g. a utility, not tied to land)
              </option>
              <option value="prescriptive">
                Nobody — it&rsquo;s been used for years with no document (prescriptive)
              </option>
            </select>
          </label>
          <label style={{ marginTop: '0.9rem' }}>
            <input
              type="checkbox"
              name="hasPerpetualLanguage"
              value="1"
              defaultChecked={hasPerpetualLanguage}
              style={{ width: 'auto', marginRight: '0.5rem' }}
            />
            It says &ldquo;perpetual&rdquo;, &ldquo;forever&rdquo; or &ldquo;runs with the
            land&rdquo;
          </label>
          <label>
            <input
              type="checkbox"
              name="hasTermOrConditionSubsequent"
              value="1"
              defaultChecked={hasTermOrConditionSubsequent}
              style={{ width: 'auto', marginRight: '0.5rem' }}
            />
            It states a time limit or an ending condition (&ldquo;for 20 years&rdquo;,
            &ldquo;until X happens&rdquo;)
          </label>
          <label>
            <input
              type="checkbox"
              name="documentIllegible"
              value="1"
              defaultChecked={!documentLegible}
              style={{ width: 'auto', marginRight: '0.5rem' }}
            />
            My copy is too poor to read reliably
          </label>
        </fieldset>

        <button type="submit">Generate report</button>
      </form>

      {/*
        Shown for every selection, not only the conservative ones. A homeowner
        choosing "pipeline" needs to know the answer is deliberately cautious
        BEFORE they read four "restricted" rows and conclude the tool is broken.
      */}
      {submitted && (
        <p role={typeMapping.reviewed ? 'status' : 'note'}>
          <strong>{typeMapping.label}.</strong> {typeMapping.note}
        </p>
      )}

      {/*
        THE SHORT VERSION, AND WHY IT IS ALLOWED TO BE FIRST.

        Measured on a real report: 7,552 words, a 38-minute read at ordinary
        speed, across fifteen sections — and a third of the paragraph text is
        caveats and fine print. Every one of those was added for a reason and
        none should go. But a homeowner who typed an address and pressed a
        button is owed an answer before they are owed the footnotes, and
        nothing here was answering them in the first screen.

        FACTS ONLY, WHICH IS WHAT MAKES IT LEGAL TO SIT ABOVE THE LIMITS.
        page-ordering.test.ts holds the rule: no ESTIMATE renders above "What
        this report does not tell you", and the county parcel panel is
        exempted because an assessed value is a published figure rather than
        something this product produced. The same reasoning covers this
        summary — a parcel size, a restriction, a distance and a maintenance
        duty are all published facts or doctrine. Not one money figure appears
        here, and the ordering test would catch it if one did.
      */}
      {submitted && report !== null && (
        <div className="panel" aria-labelledby="short-version">
          <h2 id="short-version" style={{ marginTop: 0 }}>
            The short version
          </h2>
          <ul className="facts">
            <li>
              <span className="k">This parcel</span>
              <span className="v">
                {unified === null
                  ? 'Not matched to a county record'
                  : unified.lotAreaSqFt > 0
                    ? `${Math.round(unified.lotAreaSqFt).toLocaleString()} sq ft, ${unified.county}`
                    : `${unified.county} — lot area not published`}
              </span>
            </li>
            <li>
              <span className="k">What this easement restricts</span>
              <span className="v">
                {report.restrictionChecklist.filter((i) => i.restricted).length > 0
                  ? report.restrictionChecklist
                      .filter((i) => i.restricted)
                      .map((i) => i.activity)
                      .join(', ')
                  : 'Nothing on the standard list'}
              </span>
            </li>
            <li>
              <span className="k">Who normally maintains it</span>
              <span className="v">{responsibilitiesFor(easementType).heading}</span>
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            <small>
              Everything below expands on those three. The money questions come after{' '}
              <a href="#limits">what this report cannot tell you</a>, which is deliberate — the
              limits matter more than the figures.
            </small>
          </p>
        </div>
      )}

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
          <h2>Your parcel, according to the county</h2>
          <div className="panel">
            <ul className="facts">
              <li>
                <span className="k">Parcel number</span>
                <span className="v">{unified.apn}</span>
              </li>
              <li>
                <span className="k">County</span>
                <span className="v">{unified.county}</span>
              </li>
              <li>
                <span className="k">Address of record</span>
                <span className="v">{unified.situsAddress}</span>
              </li>
              {/*
                ZERO MEANS NOT PUBLISHED, AND IS SAID THAT WAY. The row read
                "0 sq ft" on production for an exempt Cook parcel, which is a
                measurement of a lot that has an area. The Proposition 13 row
                two below has always handled its own absence like this; these
                two rows were asserting a zero instead.
              */}
              {/*
                THE LABEL CARRIES THE DISTINCTION, not just the caveat below.
                For a condominium unit this figure is the whole development's
                area — every unit in the 930-18 book publishes 135,871 sq ft —
                and a row headed "Lot area" reads as the reader's own lot
                whatever the caveat further down says.
              */}
              <li>
                <span className="k">
                  {unified.lotTenure === 'undivided-interest'
                    ? 'Shared lot area (whole development)'
                    : 'Lot area (county geometry)'}
                </span>
                <span className="v">
                  {unified.lotAreaSqFt > 0
                    ? `${Math.round(unified.lotAreaSqFt).toLocaleString()} sq ft`
                    : 'not published for this parcel'}
                </span>
              </li>
              <li>
                <span className="k">Assessed land value</span>
                <span className="v">
                  {unified.landValue > 0
                    ? `$${unified.landValue.toLocaleString()}${unified.rollYear ? ` (${unified.rollYear} roll)` : ''}`
                    : 'not published for this parcel'}
                </span>
              </li>
              <li>
                <span className="k">Proposition 13 base year</span>
                <span className="v">
                  {unified.landBaseYear ?? 'not published by this county'}
                </span>
              </li>
            </ul>
            <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              Source: {unified.serviceUrl} — queried {unified.queriedOn}
            </p>
          </div>
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

          <h2>What you can and cannot do here</h2>
          <div className="panel">
            <ul className="checks">
              {report.restrictionChecklist.map((item) => (
                <li key={item.activity}>
                  <span className={item.restricted ? 'badge badge-stop' : 'badge badge-ok'}>
                    {item.restricted ? 'Restricted' : 'Usually OK'}
                  </span>
                  <strong style={{ textTransform: 'capitalize' }}>{item.activity}</strong>
                  <br />
                  <small>{item.rationale}</small>
                </li>
              ))}
            </ul>
          </div>
          {report.restrictionChecklist.some(
            (i) => i.activity === 'landscaping' && !i.restricted,
          ) && (
            <p role="note">
              <strong>{LANDSCAPING_ACCESS_CONDITION}</strong>
            </p>
          )}
          <p className="muted">
            These are general rules for this kind of easement, not a reading of your easement
            document. The document itself controls, and it can be stricter or looser than this.
          </p>

          {/*
            The economic-impact block MOVED BELOW the not-determined panel.
            It was rendering "Value at risk: $78,934 - $118,400" above every
            caveat on the page, with no three-regime disclosure attached —
            an older and less-qualified range sitting above the carefully
            qualified one, which is worse than either alone. The referral
            package has enforced "no dollar figure before the limits" since it
            was written; the page now follows the same rule. The county's own
            published assessment stays above, because that is a recorded fact
            rather than an estimate.
          */}

          {/*
            Was a bare <pre> in the page flow, from when this route was a
            developer harness. On a page a homeowner reads, a raw JSON dump
            between two prose sections reads as a malfunction.
          */}
          {/*
            WHO IS RESPONSIBLE FOR WHAT. Placed directly after the restriction
            checklist because the two are halves of one question: that section
            says what the homeowner may not do, this one says what they are
            owed and what falls to them. The restrictions alone read as pure
            bad news, which is both discouraging and incomplete — most of what
            matters financially here is on this side.
          */}
          {/*
            FLOOD, placed with the other value-and-protection facts rather than
            with the easement findings. It is not an easement and is never
            presented as one — it sits here because it is the same KIND of
            thing the responsibilities section is: money and risk a homeowner
            can act on, and it connects directly to the drainage questions.
          */}
          {floodZone?.kind === 'found' && geocoded?.kind === 'matched' && (
            <>
              <h2>Flood risk, and what it costs</h2>
              <div className="panel">
                <p style={{ marginTop: 0 }}>
                  <span
                    className={
                      floodZone.inSpecialFloodHazardArea ? 'badge badge-stop' : 'badge badge-ok'
                    }
                    style={{ marginRight: '0.5rem' }}
                  >
                    ZONE {floodZone.zone}
                  </span>
                  {floodZone.description && <small>{floodZone.description}</small>}
                </p>
                <p>{floodImplication(floodZone)}</p>
                {floodZone.baseFloodElevationFt !== null && (
                  <p>
                    <small className="muted">
                      FEMA publishes a base flood elevation of{' '}
                      <strong>{floodZone.baseFloodElevationFt} ft</strong> here. That is the level
                      local rules generally measure against when they say how low you may build.
                    </small>
                  </p>
                )}
                <p className="muted" style={{ marginBottom: 0 }}>
                  <small>
                    Matched to <strong>{geocoded.matchedAddress}</strong>. {GEOCODE_DISCLOSURE}
                  </small>
                </p>
              </div>
              <p className="muted">
                <small>{FLOOD_ZONE_DISCLOSURE}</small>
              </p>
            </>
          )}

          {/*
            FIRE, placed with the other value-and-protection facts rather than
            with the easement findings — the same reasoning as the flood
            panel. It renders only for overhead-utility easements in a mapped
            hazard zone; buildFireSafetyContent returns null for every other
            combination, so there is no placeholder and no hedging paragraph.
          */}
          {(() => {
            const fire =
              fireSeverity !== null ? buildFireSafetyContent(easementType, fireSeverity) : null;
            if (fire === null) return null;
            return (
              <>
                <h2>{fire.headline}</h2>
                <div className="panel">
                  <p style={{ marginTop: 0 }}>
                    <span
                      className={
                        fire.severity === 'Very High'
                          ? 'badge badge-stop'
                          : fire.severity === 'High'
                            ? 'badge badge-warn'
                            : 'badge badge-ok'
                      }
                      style={{ marginRight: '0.5rem' }}
                    >
                      {fire.severity.toUpperCase()} FIRE HAZARD SEVERITY
                    </span>
                  </p>
                  <p>{fire.whatItIs}</p>
                  <p>{fire.whyItMatters}</p>
                  <p>
                    <strong>Who is responsible for what:</strong> {fire.whoIsResponsible}
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    <strong>Worth doing now, at no cost:</strong> {fire.freeNextStep}
                  </p>
                </div>
                <p className="muted">
                  <small>{FIRE_SEVERITY_DISCLOSURE}</small>
                </p>
              </>
            );
          })()}

          {/*
            WHAT CAL FIRE SAYS, FOR EVERY PARCEL — not only the ones in a
            hazard zone with an overhead line.

            The rich panel above is gated twice: overhead-utility easements,
            in a mapped hazard zone. Everything else rendered nothing, and
            from the reader's side "not in a mapped zone" and "we never
            looked" are the same blank page. Reported from production on
            2026-10-21 in the sharpest form available: a Studio City report
            carried a VERY HIGH panel while an Altadena address inside the
            Eaton Fire burn scar carried nothing at all.

            The product was reporting CAL FIRE faithfully — queried
            2026-10-25, the layer returns "NonWildland" for southern Altadena
            and "Very High" a mile north — so the fix is not to invent a
            hazard the map does not assert. It is to say what the map says,
            and to say what it does not cover, which is the part that
            reconciles "not in a mapped zone" with a neighbourhood that
            burned.

            Suppressed when the rich panel already rendered, so a hazard-zone
            parcel does not get the same fact twice.
          */}
          {(() => {
            if (fireSeverity === null) return null;
            if (buildFireSafetyContent(easementType, fireSeverity) !== null) return null;
            const note = buildFireStatusNote(fireSeverity);
            return (
              <>
                <h2>Fire hazard</h2>
                <div className="panel">
                  <p style={{ marginTop: 0 }}>
                    <strong>{note.heading}</strong>
                  </p>
                  <p>{note.body}</p>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    <small>{note.limit}</small>
                  </p>
                </div>
              </>
            );
          })()}

          {/*
            FLOOD VULNERABILITY WHERE EASEMENTS MEET WATER. The panel above
            says what FEMA mapped. This one says how the easement on this
            property changes what water does — a blocked storm drain or a
            failed lateral floods homes far from any river, which is exactly
            the flooding a zone map does not price. Reuses the FEMA result
            fetched above: no new upstream query. Renders only for the five
            flood-relevant types; the builder returns null otherwise, so a
            non-relevant type never duplicates the zone panel.
          */}
          {floodZone !== null &&
            (() => {
              const vuln = buildFloodVulnerabilityContent(easementType, floodZone);
              if (!vuln) return null;
              return (
                <>
                  <h2>{FLOOD_VULNERABILITY_HEADING}</h2>
                  <div className="panel">
                    {vuln.zoneFraming && <p style={{ marginTop: 0 }}>{vuln.zoneFraming}</p>}
                    {vuln.zoneUnknownNote && (
                      <p style={{ marginTop: 0 }} className="muted">
                        <small>{vuln.zoneUnknownNote}</small>
                      </p>
                    )}
                    <p>
                      <strong>{vuln.typeAngle.whatItIs}</strong>
                    </p>
                    <p>{vuln.typeAngle.whyItMatters}</p>
                    <p>
                      <strong>Who maintains what:</strong> {vuln.typeAngle.whoMaintains}
                    </p>
                  </div>
                  <div className="panel">
                    <h3 style={{ marginTop: 0 }}>Free things you can do</h3>
                    <ul>
                      {vuln.freeThingsYouCanDo.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="muted">
                    <small>{vuln.disclosure}</small>
                  </p>
                </>
              );
            })()}

          <h2>Who is responsible for what</h2>
          <p>
            These are the arrangements usual for this kind of easement. Use them to work out which
            questions are worth asking about your own.
          </p>
          {(() => {
            const resp = responsibilitiesFor(easementType);
            return (
              <>
                <div className="panel">
                  <h3 style={{ marginTop: 0 }}>{resp.heading}</h3>
                  {resp.responsibilities.map((r) => (
                    <div key={r.question} style={{ marginBottom: '1.1rem' }}>
                      <strong>{r.question}</strong>
                      <br />
                      <span className="badge badge-warn" style={{ marginRight: '0.5rem' }}>
                        {PARTY_LABEL[r.typically]}
                      </span>
                      <small>{r.answer}</small>
                      <br />
                      <small className="muted">
                        <strong>What would change it:</strong> {r.whatWouldChangeIt}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="panel">
                  <h3 style={{ marginTop: 0 }}>What this means for your property</h3>
                  <p>{resp.valueAndProtection}</p>
                  <p>
                    <strong>Worth doing now, at no cost:</strong> {resp.freeNextStep}
                  </p>
                </div>
                <p className="muted">
                  <small>{RESPONSIBILITIES_DISCLOSURE}</small>
                </p>
              </>
            );
          })()}

          {/*
            HOW LONG IT LASTS. Only rendered when the homeowner actually told
            us something — an untouched form means legalCharacter 'unknown' and
            no language flags, which produces a flag about a document nobody
            described. Showing that would read as a finding about THEIR
            easement rather than an absence of input, which is the worst of
            both: alarming and uninformative.
          */}
          {durationAnalysis && (hasPerpetualLanguage || hasTermOrConditionSubsequent || legalCharacter !== 'unknown') && (
            <>
              <h2>How long does it last?</h2>
              {durationAnalysis.duration.tier !== 'flagged-ambiguous' && (
                <div className="panel">
                  <p style={{ marginTop: 0 }}>
                    <strong>{durationAnalysis.duration.value.summary}</strong>
                  </p>
                  {durationAnalysis.duration.tier === 'likely-with-caveat' && (
                    <p>
                      <small className="muted">{durationAnalysis.duration.caveat}</small>
                    </p>
                  )}
                  <p className="muted">
                    <small>
                      This is a reading of what you told us the document says, not an opinion about
                      your legal position. It would hold the same in any state.
                    </small>
                  </p>
                </div>
              )}

              {/*
                The advisory. This is the path that lets a free analysis say
                something useful where the answer depends on doctrine nobody
                has reviewed — a general proposition and the question, never a
                determination. See confidence-tiering.ts for why those are
                different speech acts.
              */}
              {durationAnalysis.advisory && (
                <div className="undetermined">
                  <p style={{ marginTop: 0 }}>
                    <strong>Your document didn&rsquo;t state a duration</strong>, so the answer
                    depends on what the law presumes. This tool does not apply law to your
                    situation. Here is the general position and the question worth asking.
                  </p>
                  <h3>The general rule</h3>
                  <p>{durationAnalysis.advisory.generalPosition}</p>
                  <h3>Ask an attorney</h3>
                  <p>
                    <em>&ldquo;{durationAnalysis.advisory.askYourAttorney}&rdquo;</em>
                  </p>
                  <h3>Why this isn&rsquo;t an answer</h3>
                  <p>{durationAnalysis.advisory.whyNotDetermined}</p>
                  <p className="muted">
                    <small>
                      Nothing above is legal advice and no attorney has reviewed it. An attorney
                      licensed in your state can tell you whether the general rule applies to your
                      parcel; this tool cannot, and does not try.
                    </small>
                  </p>
                </div>
              )}

              {durationAnalysis.duration.tier === 'flagged-ambiguous' &&
                !durationAnalysis.advisory && (
                  <div className="undetermined">
                    <p style={{ marginTop: 0 }}>{durationAnalysis.duration.flagReason}</p>
                  </div>
                )}
            </>
          )}

          {/*
            WHAT SHOULD EXIST. Follows responsibilities because the order is
            what exists, what it means for you, and then what is missing. The
            benefited-and-unrecorded item leads every list by construction —
            see should-exist.ts for why that exposure is the one worth putting
            first even though it is not what the reader came in asking about.
          */}
          <h2>What should be on record, and often isn&rsquo;t</h2>
          <div className="undetermined">
            <p style={{ marginTop: 0 }}>
              <strong>Before the detail, the question worth asking:</strong>
            </p>
            <p>
              <em>{THE_QUESTION_TO_ASK}</em>
            </p>
          </div>
          {whatShouldExist(easementType).map((d) => (
            <div className="panel" key={d.id}>
              <h3 style={{ marginTop: 0 }}>{d.situation}</h3>
              <p>
                <span className="badge badge-warn" style={{ marginRight: '0.5rem' }}>
                  {POSTURE_LABEL[d.posture]}
                </span>
                <span className="badge">{TRIGGER_LABEL[d.becomesUrgent]}</span>
              </p>
              <p>
                <strong>What should exist:</strong> {d.whatShouldExist}
              </p>
              <p>
                <small>{d.whyItMatters}</small>
              </p>
              <p>
                <small className="muted">
                  <strong>If nobody does anything:</strong> {d.ifYouDoNothing}
                </small>
              </p>
              <p>
                <small>
                  <strong>Where to start, at no cost:</strong> {d.howToStart}
                </small>
              </p>
            </div>
          ))}
          <p className="muted">
            <small>{SHOULD_EXIST_DISCLOSURE}</small>
          </p>

          <details>
            <summary>Raw report data (JSON)</summary>
            <pre>{JSON.stringify(report, null, 2)}</pre>
          </details>
        </>
      )}

      {referral && referralText && (
        <>
          <h2 id="limits">What this report does not tell you</h2>
          <p>
            This is the part most worth reading. Each item below is a question this report does not
            answer, why it cannot, and who can. It is not a disclaimer bolted onto the end — it is
            the finding.
          </p>

          <div className="undetermined">
            <h3>{referral.notDetermined.length} open questions</h3>
            <ol>
              {referral.notDetermined.map((item) => (
                <li key={item.key}>
                  {item.what}
                  <span className="why">{item.why}</span>
                  <span className="who">Resolved by: {item.whoResolves}</span>
                </li>
              ))}
            </ol>
          </div>

          <p>
            The most important one is the first: <strong>no dataset can tell you what a permanent
            easement is worth.</strong> The controlling federal standard measures it as the value of
            the whole property before the easement minus its value afterwards, and it specifically
            rejects the shortcuts — a percentage of your land value, a customary per-foot rate, or
            pricing the strip on its own. That comparison requires a licensed appraiser looking at
            your specific property.
          </p>

          {/*
            The screening range renders AFTER the open-questions panel, never
            before it. The ordering rule that governs the referral package
            applies with more force here: a reader who meets a dollar figure
            first has anchored on it before reading a word of what it is not.
          */}
          {screening && (
            <>
              <h2>Roughly what scale of question is this?</h2>

              {screening.status === 'range' && (
                <>
                  <p role="note">
                    <strong>{ORIENTATION_ONLY_BANNER}</strong>
                  </p>
                  <div className="panel">
                    <p style={{ fontSize: '1.35rem', margin: '0 0 0.5rem' }}>
                      <strong>
                        ${screening.range.low.toLocaleString()} – $
                        {screening.range.high.toLocaleString()}
                      </strong>
                    </p>
                    <p className="muted" style={{ marginBottom: '0.75rem' }}>
                      {(screening.range.lowPercent * 100).toFixed(0)}–
                      {(screening.range.highPercent * 100).toFixed(0)}% of the{' '}
                      {screening.range.appliedToLabel}
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      <strong>How this was calculated:</strong> {screening.range.derivation}
                    </p>
                    {/*
                      INSIDE THE PANEL, under the number. The range is a
                      percentage of the easement area, so when that area is a
                      placeholder the figure is a statement about 800 sq ft
                      rather than about this property. A caveat further down
                      the page is read by whoever scrolls; this has to be read
                      by whoever looks at the number.
                    */}
                    {areaProvenance === 'assumed-default' && (
                      <p role="note" style={{ margin: '0.75rem 0 0' }}>
                        <strong>
                          {assumedFromLot && resolvedLotAreaSqFt !== null
                            ? assumedFromLotCaveat(resolvedLotAreaSqFt, easementAreaSqFt)
                            : ASSUMED_AREA_CAVEAT}
                        </strong>
                      </p>
                    )}
                  </div>

                  <h3>The three limits on this number</h3>
                  <p role="note">
                    <strong>Valuation.</strong> {THREE_REGIME_DISCLOSURE.valuation}
                  </p>
                  <p role="note">
                    <strong>Legal.</strong> {THREE_REGIME_DISCLOSURE.legal}
                  </p>
                  <p role="note">
                    <strong>Advertising and substantiation.</strong>{' '}
                    {THREE_REGIME_DISCLOSURE.advertising}
                  </p>
                  {screening.range.caveats
                    .filter(
                      (c) =>
                        c !== ORIENTATION_ONLY_BANNER &&
                        !Object.values(THREE_REGIME_DISCLOSURE).includes(
                          c as (typeof THREE_REGIME_DISCLOSURE)[keyof typeof THREE_REGIME_DISCLOSURE],
                        ),
                    )
                    .map((c) => (
                      <p key={c} className="muted">
                        {c}
                      </p>
                    ))}
                </>
              )}

              {screening.status === 'refused' && (
                <p role="note">
                  <strong>No range is offered for this easement type.</strong> {screening.reason}
                </p>
              )}

              {screening.status === 'insufficient-data' && (
                <p role="note">
                  <strong>No range could be produced.</strong> {screening.reason} Missing:{' '}
                  {screening.missing.join('; ')}.
                </p>
              )}
            </>
          )}


          {/*
            THE IRWA ESTIMATE, after the screening range and still after the
            open-questions panel. Two figures on one page is a risk — a reader
            can take the second as independent corroboration of the first — so
            the copy says plainly that both rest on the same assessed land
            value and the same unverified percentages. What the named method
            adds is a stated basis and bounds, not a second source.
          */}
          {irwa?.kind === 'estimated' && (
            <>
              <h2>The same question, by the IRWA method</h2>
              <div className="panel">
                <p style={{ fontSize: '1.35rem', margin: '0 0 0.5rem' }}>
                  <strong>
                    ${Math.round(irwa.low.result.totalCompensation).toLocaleString()} – $
                    {Math.round(irwa.high.result.totalCompensation).toLocaleString()}
                  </strong>
                </p>
                <p className="muted" style={{ marginBottom: '0.75rem' }}>
                  {irwa.tier.lowPercent}–{irwa.tier.highPercent}% of the land value of{' '}
                  {Math.round(irwa.low.result.easementArea).toLocaleString()} sq ft, at the{' '}
                  <strong>{irwa.tier.name}</strong> impact level.
                </p>
                <p>
                  <small>
                    <strong>Why {irwa.tier.name.toLowerCase()}:</strong> {irwa.tier.description}
                  </small>
                </p>
                <p className="muted">
                  <small>Land value from: {irwa.valueSource}</small>
                </p>
                {/*
                  REPEATED HERE RATHER THAN SAID ONCE ABOVE. Two figures on one
                  page already risk reading as corroboration; if only the first
                  carried the assumption, the second would look like the
                  independent check it is not. Both rest on the same area.
                */}
                {areaProvenance === 'assumed-default' && (
                  <p role="note" style={{ margin: '0.75rem 0 0' }}>
                    <strong>
                          {assumedFromLot && resolvedLotAreaSqFt !== null
                            ? assumedFromLotCaveat(resolvedLotAreaSqFt, easementAreaSqFt)
                            : ASSUMED_AREA_CAVEAT}
                        </strong>
                  </p>
                )}
              </div>

              {irwa.stripOnly && (
                <div className="undetermined">
                  <p style={{ margin: 0 }}>{STRIP_ONLY_WARNING}</p>
                </div>
              )}

              <h3>The other half of the method</h3>
              {irwa.beforeAndAfter.kind === 'needs-appraiser' ? (
                <div className="panel">
                  <p style={{ marginTop: 0 }}>
                    The IRWA methodology runs two methods and compares them. The second —
                    Before-and-After — needs something this tool cannot produce:{' '}
                    <strong>{irwa.beforeAndAfter.missingInput}</strong>
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    <small className="muted">{irwa.beforeAndAfter.whyNotDerived}</small>
                  </p>
                </div>
              ) : (
                <div className="panel">
                  <p style={{ marginTop: 0 }}>
                    Before-and-After, using an appraised remainder value of $
                    {irwa.beforeAndAfter.remainderValuePerSqFt.toLocaleString()} per sq ft:{' '}
                    <strong>
                      ${Math.round(irwa.beforeAndAfter.totalCompensation).toLocaleString()}
                    </strong>
                  </p>
                </div>
              )}

              <p className="muted">
                <small>{irwa.methodDisclosure}</small>
              </p>
            </>
          )}

          {irwa?.kind === 'refused' && (
            <>
              <h2>Why no valuation is offered for this easement</h2>
              <div className="undetermined">
                <p style={{ margin: 0 }}>{irwa.reason}</p>
              </div>
            </>
          )}

          {report && (
            <>
              <h2>What the easement costs you in use</h2>
              <div className="panel">
                <ul className="facts">
                  <li>
                    <span className="k">Buildable area lost</span>
                    <span className="v">
                      {report.economicImpact.lostBuildableAreaSqFt.toLocaleString()} sq ft
                    </span>
                  </li>
                  {/*
                    THE ROW STAYS WHEN THERE IS NO FIGURE, carrying the reason
                    where the number would be. Dropping it would leave a reader
                    outside the covered counties with no sign that a value at
                    risk exists as a question — which reads as "nothing at
                    risk" rather than "we cannot say".
                  */}
                  <li>
                    <span className="k">Value at risk</span>
                    <span className="v">
                      {report.economicImpact.valueAtRisk.status === 'range' ? (
                        <>
                          ${report.economicImpact.valueAtRisk.range.low.toLocaleString()} – $
                          {report.economicImpact.valueAtRisk.range.high.toLocaleString()}
                        </>
                      ) : (
                        <em>Not available</em>
                      )}
                    </span>
                  </li>
                  <li>
                    <span className="k">Rework cost if you build and must undo it</span>
                    <span className="v">
                      ${report.economicImpact.reworkCostRange.low.toLocaleString()} – $
                      {report.economicImpact.reworkCostRange.high.toLocaleString()}
                    </span>
                  </li>
                </ul>
                {report.economicImpact.valueAtRisk.status === 'unavailable' && (
                  <p role="note" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                    <strong>Value at risk: </strong>
                    {report.economicImpact.valueAtRisk.reason}
                  </p>
                )}
                <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  Rework is based on ${report.economicImpact.constructionCost.costPerSqFt}/sq ft
                  {report.economicImpact.constructionCost.isDivisionReported
                    ? ` (${report.economicImpact.constructionCost.division?.replace(/-/g, ' ')} region)`
                    : ' (national median)'}
                  . It excludes demolition and site constraints, so real rework costs more.
                </p>
              </div>
              <p className="muted">
                <strong>Data coverage: </strong>
                {report.economicImpact.dataCoverage.tier === 'flagged-ambiguous'
                  ? report.economicImpact.dataCoverage.flagReason
                  : report.economicImpact.dataCoverage.value.label}
                {report.economicImpact.dataCoverage.tier === 'likely-with-caveat' &&
                  ` ${report.economicImpact.dataCoverage.caveat}`}
              </p>
              <details>
                <summary>How this was calculated</summary>
                <p>{report.economicImpact.methodology}</p>
              </details>
            </>
          )}

          {/*
            STREAMED, NOT AWAITED. Measured 2026-10-14: Overpass succeeded 6
            of 14 times, and a failure (HTTP 504) took 8.5 to 13.4 seconds to
            arrive while a success took 1 to 8. Awaited in the page body it
            added up to 3 seconds to a ~2 second report, most of the time for
            nothing. Suspense puts the wait where it belongs — on the section
            that is waiting — and a reader who never scrolls this far has
            waited nothing for it.
          */}
          {unified !== null && geocoded?.kind === 'matched' && (
            <Suspense fallback={<InfrastructurePending propertyPhrase={copy.propertyPhrase} />}>
              <InfrastructureSection
                serviceUrl={unified.serviceUrl}
                idQuery={unified.idQuery}
                county={unified.county}
                state={state}
                lat={geocoded.lat}
                lon={geocoded.lon}
                propertyPhrase={copy.propertyPhrase}
              />
            </Suspense>
          )}

          {/*
            THE AUDIENCE'S OWN STEPS, ABOVE THE GENERAL REMEDY PLAN.

            The remedy plan below is about the easement — establish the area,
            read the instrument, speak to the holder. These are about the
            READER'S POSITION, and for a buyer they are time-limited in a way
            nothing else on the page is. Putting them first is the whole point
            of having two modes: a buyer who reads only the top of the report
            should still come away knowing to order the title report.
          */}
          <h2>
            {audience === 'buyer' ? 'What to do before you commit' : 'Where to look first'}
          </h2>
          <ol className="steps">
            {copy.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p role="note">
            <strong>{audience === 'buyer' ? 'The clock: ' : 'On timing: '}</strong>
            {copy.timingNote}
          </p>

          {remedy && (
            <>
              <h2>What to do about it, in order</h2>
              {/* Recommendations, not a legal opinion — and the universal
                  not-legal-counsel line, which every communication carries. */}
              <p role="note">
                <strong>{CURRENT_DISCLAIMER.recommendationsNotOpinionText}</strong>
              </p>
              <p role="note">{CURRENT_DISCLAIMER.notLegalCounselText}</p>
              {legalReviewDisclosure(state).text !== null && (
                <p role="note">{legalReviewDisclosure(state).text}</p>
              )}
              <p>{remedy.sequencingNote}</p>
              {remedy.urgencyNote && (
                <p role="alert">
                  <strong>{remedy.urgencyNote}</strong>
                </p>
              )}
              <div className="panel">
                <ol style={{ paddingLeft: '1.1rem', margin: 0 }}>
                  {remedy.steps.map((s) => (
                    <li key={s.order} style={{ marginBottom: '1.1rem' }}>
                      <strong>{s.title}</strong>
                      {s.weCanProvide && <span className="badge badge-ok" style={{ marginLeft: '0.5rem' }}>We provide this</span>}
                      <br />
                      <small>{s.outcome}</small>
                      <br />
                      <small className="muted">
                        Who: {s.actor} · Cost: {COST_TIER_LABEL[s.cost]}
                      </small>
                      <br />
                      <small className="muted">Why now: {s.whyNow}</small>
                      {s.skipIf && (
                        <>
                          <br />
                          <small className="muted">Skip if: {s.skipIf}</small>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          <h2>What to expect from a professional</h2>
          <p>
            Most people hire an appraiser once in their life, so here is roughly what you are
            buying. Use it to judge a quote before you pay for one.
          </p>
          {EXPECTATIONS.map((e) => (
            <div className="panel" key={e.kind}>
              <h3 style={{ marginTop: 0 }}>{e.heading}</h3>
              <p>{e.whatTheyDo}</p>
              <p className="muted" style={{ marginBottom: '0.3rem' }}>
                <strong>At best</strong>
              </p>
              <ul>
                {e.bestCase.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="muted" style={{ marginBottom: '0.3rem' }}>
                <strong>At worst</strong>
              </p>
              <ul>
                {e.worstCase.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="muted">{NO_LIST_NO_FEE}</p>

          <h2>Taking this to a professional</h2>
          <p>
            The package below is written for an appraiser or attorney. It gathers the parcel record,
            the geometry, the sources queried and the dates, so the person you hire starts from
            evidence instead of from scratch.
          </p>
          <details>
            <summary>Read the full referral package</summary>
            <pre>{referralText}</pre>
          </details>
        </>
      )}
    </main>
  );
}
