import { resolveAddress, zipHeuristicCountyResolver } from '@/lib/parcel-resolution';
import {
  buildRiskDisclosureReport,
  createLaCountyAssessorProvider,
  InvalidRiskDisclosureInputError,
} from '@/lib/risk-disclosure';
import type { AssessorParcelValuation, EasementPurpose } from '@/lib/risk-disclosure';
import { mapEasementTypeToPurpose } from '@/lib/risk-disclosure/easement-purpose-map';
import { LANDSCAPING_ACCESS_CONDITION } from '@/lib/risk-disclosure/restriction-checklist';
import { EASEMENT_TYPES, type EasementType } from '@/lib/easements/easement-types';
import {
  screeningEstimate,
  ORIENTATION_ONLY_BANNER,
  THREE_REGIME_DISCLOSURE,
  type ScreeningResult,
} from '@/lib/valuation/screening-estimate';
import { buildRemedyPlan, COST_TIER_LABEL, type RemedyPlan } from '@/lib/advocacy/remedy-plan';
import { EXPECTATIONS, NO_LIST_NO_FEE } from '@/lib/referral-network/what-to-expect';
import {
  RESPONSIBILITIES_DISCLOSURE,
  responsibilitiesFor,
  type Party,
} from '@/lib/easements/responsibilities';
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
/**
 * Badge text for who typically bears a duty.
 *
 * "USUALLY" on every one of them, including the two that look definite. The
 * badge is the part a skimming reader takes away, so it has to carry the
 * hedge that the surrounding prose carries.
 */
const PARTY_LABEL: Record<Party, string> = {
  holder: 'USUALLY THE HOLDER',
  owner: 'USUALLY YOU',
  shared: 'USUALLY SHARED',
  'depends-on-document': 'DEPENDS ON THE DOCUMENT',
};

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const street = param(searchParams.street);
  const city = param(searchParams.city);
  const state = param(searchParams.state) || 'CA';
  const zip = param(searchParams.zip);
  // The interface now selects a physical easement TYPE (twelve of them) and
  // derives the purpose, rather than offering the five purposes directly.
  // Seven types were previously unreachable from this page.
  const easementType = (param(searchParams.easementType) || 'utility-overhead') as EasementType;
  const typeMapping = EASEMENT_TYPES.includes(easementType)
    ? mapEasementTypeToPurpose(easementType)
    : mapEasementTypeToPurpose('utility-overhead');
  const easementPurpose: EasementPurpose = typeMapping.purpose;
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
  let screening: ScreeningResult | null = null;
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

          remedy = buildRemedyPlan({
            easementType,
            instrumentInHand: false,
            easementConfirmed: false,
            areaEstablished: unified !== null,
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
      <h1>What an easement on your property means</h1>
      <p className="lede">
        This reads public parcel, assessment and infrastructure records and reports what they say:
        which activities are typically restricted, what the county publishes about your lot, a rough
        sense of the scale of money involved, and a plan for what to do next. It also states what it
        cannot determine, which for an easement is a great deal. The range it gives is for
        orientation — enough to tell you whether this is worth a professional&rsquo;s time. It is not
        a valuation, and the report is explicit about why not.
      </p>

      <form>
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
          <p className="muted" style={{ marginTop: '0.6rem' }}>
            Live county records: {SUPPORTED_COUNTIES.join(', ')}. Anywhere else still produces a
            report — it uses national benchmarks and says so.
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
              <input name="easementAreaSqFt" type="number" defaultValue={easementAreaSqFt} />
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
            used instead. If you don&rsquo;t know the easement area, put your best guess; the report
            will record that you did.
          </p>
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
              <li>
                <span className="k">Lot area (county geometry)</span>
                <span className="v">{Math.round(unified.lotAreaSqFt).toLocaleString()} sq ft</span>
              </li>
              <li>
                <span className="k">Assessed land value</span>
                <span className="v">
                  ${unified.landValue.toLocaleString()}
                  {unified.rollYear ? ` (${unified.rollYear} roll)` : ''}
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

          <details>
            <summary>Raw report data (JSON)</summary>
            <pre>{JSON.stringify(report, null, 2)}</pre>
          </details>
        </>
      )}

      {referral && referralText && (
        <>
          <h2>What this report does not tell you</h2>
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
                  <li>
                    <span className="k">Value at risk</span>
                    <span className="v">
                      ${report.economicImpact.valueAtRiskRange.low.toLocaleString()} – $
                      {report.economicImpact.valueAtRiskRange.high.toLocaleString()}
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
