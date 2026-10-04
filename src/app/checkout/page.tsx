import { buildAdvocacyWizardState } from '@/lib/advocacy-wizard';
import { CURRENT_DISCLAIMER } from '@/lib/compliance';
import { buildCheckoutSession, StripePaymentProvider, totalLineItemsCents } from '@/lib/checkout';
import { normalizeAddress } from '@/lib/parcel-resolution';
import { getStateCompliance } from '@/config/state-tiers';
import { analyzeEasement } from '@/lib/analysis-layer';
import { resolveAttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import { AUDIT_BLOCKED_MESSAGE, recordGeneration } from '@/lib/compliance/record-generation';
import { COMMERCE_DISABLED_MESSAGE, COMMERCE_ENABLED } from '@/lib/compliance/commerce-mode';

interface CheckoutPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * Minimal, functional demo of the Step 6 module: checkout, disclaimer
 * touchpoints, and the Tier A opt-in / Tier B mandatory attorney-review
 * flows, chained onto Steps 1, 2, and 5. Checkout only appears in this
 * Track 1 flow — Track 2 and Track 3 pages never import this module.
 * Not the UX Agent's polished checkout screen — this is a harness.
 */
export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const street = param(searchParams.street);
  const city = param(searchParams.city);
  const state = param(searchParams.state) || 'CA';
  const zip = param(searchParams.zip);
  const easementType = (param(searchParams.easementType) || 'appurtenant') as
    | 'appurtenant'
    | 'in-gross'
    | 'prescriptive'
    | 'unknown';
  const hasPerpetualLanguage = param(searchParams.hasPerpetualLanguage) === 'on';
  const hasTermOrConditionSubsequent = param(searchParams.hasTermOrConditionSubsequent) === 'on';
  const attorneyReviewChoice = param(searchParams.attorneyReviewChoice) === 'added' ? 'added' : 'declined';
  const disclaimerAccepted = param(searchParams.disclaimerAccepted) === 'on';
  const submitted = searchParams.submitted === '1';

  let unavailableMessage: string | null = null;
  let blockedMessage: string | null = null;
  let error: string | null = null;
  let checkoutUrl: string | null = null;
  let totalDollars: number | null = null;
  let auditWarning: string | null = null;

  // Checked before anything else, including address validation. There is no
  // point validating input for a transaction that cannot occur, and asking for
  // details first would imply one is coming.
  if (!COMMERCE_ENABLED) {
    blockedMessage = COMMERCE_DISABLED_MESSAGE;
  } else if (submitted) {
    try {
      normalizeAddress({ street, city, state, zip });
      const wizardState = buildAdvocacyWizardState({
        state,
        duration: { easementType, hasPerpetualLanguage, hasTermOrConditionSubsequent, documentLegible: true },
      });

      if (!wizardState.access.available) {
        unavailableMessage = wizardState.access.message;
      } else if (wizardState.fields?.duration.status === 'blocked') {
        blockedMessage =
          'Easement duration is flagged as ambiguous, so this letter cannot go to checkout. ' +
          'Use the Request for Clarification (Track 2) fallback for this field instead.';
      } else {
        // RECORDED BEFORE THE SESSION EXISTS, and this is the one flow where
        // the ordering is about money rather than only about evidence.
        // buildCheckoutSession returns a payable Stripe URL; past that point
        // the user can pay and land on successUrl, and we may never execute
        // another line for them. An artefact they paid for with no record of
        // the basis it was prepared under is the worst version of the gap this
        // control exists to close, so the session is not created at all if the
        // record cannot be written.
        const analysis = analyzeEasement({
          state,
          duration: {
            easementType,
            hasPerpetualLanguage,
            hasTermOrConditionSubsequent,
            documentLegible: true,
          },
        });
        const audit = await recordGeneration({
          letterType: 'maintenance-request',
          stateCompliance: getStateCompliance(state),
          attorneyReviewDecision: resolveAttorneyReviewDecision(
            wizardState.access.requiredFlow,
            attorneyReviewChoice,
          ),
          ruleSet: analysis.ruleSet,
          firedRule: analysis.firedRule ?? undefined,
        });
        if (!audit.ok) {
          // No session is created. checkoutUrl stays null, so the page renders
          // the blocked message and no payment link.
          blockedMessage = AUDIT_BLOCKED_MESSAGE;
        } else {
          auditWarning = audit.warning;
          const result = await buildCheckoutSession(
            {
              requiredFlow: wizardState.access.requiredFlow,
              attorneyReviewChoice,
              disclaimerAccepted,
              successUrl: 'http://localhost:3000/checkout?success=1',
              cancelUrl: 'http://localhost:3000/checkout?canceled=1',
            },
            new StripePaymentProvider(),
          );
          checkoutUrl = result.session.url;
          totalDollars = totalLineItemsCents(result.lineItems) / 100;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  return (
    <main>
      <h1>Track 1 — Checkout</h1>
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
            Easement type
            <select name="easementType" defaultValue={easementType}>
              <option value="appurtenant">Appurtenant</option>
              <option value="in-gross">In gross</option>
              <option value="prescriptive">Prescriptive</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            <input type="checkbox" name="hasPerpetualLanguage" defaultChecked={hasPerpetualLanguage} />
            Document contains perpetual language
          </label>
          <label>
            <input
              type="checkbox"
              name="hasTermOrConditionSubsequent"
              defaultChecked={hasTermOrConditionSubsequent}
            />
            Document contains a specific term or condition subsequent
          </label>
        </fieldset>
        <fieldset>
          <legend>Attorney review</legend>
          <label>
            <input
              type="radio"
              name="attorneyReviewChoice"
              value="declined"
              defaultChecked={attorneyReviewChoice === 'declined'}
            />
            Send without review
          </label>
          <label>
            <input
              type="radio"
              name="attorneyReviewChoice"
              value="added"
              defaultChecked={attorneyReviewChoice === 'added'}
            />
            Add attorney review
          </label>
        </fieldset>
        <fieldset>
          <legend>Disclaimer</legend>
          <label>
            <input type="checkbox" name="disclaimerAccepted" defaultChecked={disclaimerAccepted} />
            {CURRENT_DISCLAIMER.checkoutCheckboxText}
          </label>
        </fieldset>
        <button type="submit">Continue to payment</button>
      </form>

      {/* Operator-facing: says records are landing somewhere that works
          locally and will not survive a serverless host. */}
      {auditWarning && (
        <p role="status">
          <small>{auditWarning}</small>
        </p>
      )}

      {error && <p role="alert">{error}</p>}

      {unavailableMessage && (
        <>
          <h2>Track 1 not available</h2>
          <p>{unavailableMessage}</p>
        </>
      )}

      {blockedMessage && (
        <>
          <h2>Duration field blocked</h2>
          <p>{blockedMessage}</p>
        </>
      )}

      {checkoutUrl && (
        <>
          <h2>Checkout session created</h2>
          <p>Total: ${totalDollars?.toFixed(2)}</p>
          <p>
            <a href={checkoutUrl}>Continue to Stripe Checkout →</a>
          </p>
        </>
      )}
    </main>
  );
}
