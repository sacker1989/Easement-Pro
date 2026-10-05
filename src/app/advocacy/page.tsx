import { buildAdvocacyWizardState } from '@/lib/advocacy-wizard';
import { getStateCompliance } from '@/config/state-tiers';
import { analyzeEasement } from '@/lib/analysis-layer';
import {
  AUDIT_BLOCKED_MESSAGE,
  recordGeneration,
} from '@/lib/compliance/record-generation';
import { resolveAttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import {
  buildMaintenanceRequestLetter,
  buildRequestForClarificationLetter,
  renderLetterAsPlainText,
} from '@/lib/letters';
import { normalizeAddress } from '@/lib/parcel-resolution';

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


interface AdvocacyPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * Minimal, functional demo of the Step 5 module (Advocacy Wizard, Track 1)
 * chained onto Steps 1, 2, and 4. Proves both gating layers end to end: the
 * whole-feature state gate (is Track 1 offered here at all) and the
 * per-field gate (is this specific finding confident enough to assert in a
 * paid letter, or does it fall back to the free Track 2 letter instead).
 * Not the UX Agent's polished wizard UI — this is a harness.
 */
export default async function AdvocacyPage({ searchParams }: AdvocacyPageProps) {
  const street = param(searchParams.street);
  const city = param(searchParams.city);
  const state = param(searchParams.state) || 'CA';
  const zip = param(searchParams.zip);
  const recipientName = param(searchParams.recipientName);
  const senderName = param(searchParams.senderName);
  const maintenanceDescription = param(searchParams.maintenanceDescription);
  const easementType = (param(searchParams.easementType) || 'appurtenant') as
    | 'appurtenant'
    | 'in-gross'
    | 'prescriptive'
    | 'unknown';
  const hasPerpetualLanguage = param(searchParams.hasPerpetualLanguage) === 'on';
  const hasTermOrConditionSubsequent = param(searchParams.hasTermOrConditionSubsequent) === 'on';
  const submitted = searchParams.submitted === '1';

  let unavailableMessage: string | null = null;
  let auditBlocked: string | null = null;
  let auditWarning: string | null = null;
  let letterText: string | null = null;
  let fallbackLetterText: string | null = null;
  let error: string | null = null;

  if (submitted) {
    try {
      const propertyAddress = normalizeAddress({ street, city, state, zip });
      const wizardState = buildAdvocacyWizardState({
        state,
        duration: { easementType, hasPerpetualLanguage, hasTermOrConditionSubsequent, documentLegible: true },
      });

      if (!wizardState.access.available) {
        unavailableMessage = wizardState.access.message;
      } else if (wizardState.fields?.duration.status === 'blocked') {
        // The clarification letter is the free fallback. It is still audited —
        // it carries the same disclaimer version and tier — and it is still
        // withheld if the record cannot be written, because the reason to
        // record is not that money changed hands.
        const audit = await recordGeneration({
          letterType: 'request-for-clarification',
          stateCompliance: getStateCompliance(state),
          ruleSet: analyzeEasement({
            state,
            duration: {
              easementType,
              hasPerpetualLanguage,
              hasTermOrConditionSubsequent,
              documentLegible: true,
            },
          }).ruleSet,
        });
        if (!audit.ok) {
          auditBlocked = AUDIT_BLOCKED_MESSAGE;
        } else {
          auditWarning = audit.warning;
          const fallbackLetter = buildRequestForClarificationLetter({
            recipientName,
            senderName,
            propertyAddress,
            clarificationPoints: [wizardState.fields.duration.clarificationOffer],
          });
          fallbackLetterText = renderLetterAsPlainText(fallbackLetter);
        }
      } else if (wizardState.fields) {
        // Track 1, the paid letter. Recorded BEFORE it is rendered: an
        // artefact that exists without a trail is the case this whole control
        // is for, and producing it first and logging after would leave exactly
        // that gap on any failure.
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
            'declined',
          ),
          ruleSet: analysis.ruleSet,
          firedRule: analysis.firedRule ?? undefined,
        });
        if (!audit.ok) {
          auditBlocked = AUDIT_BLOCKED_MESSAGE;
        } else {
          auditWarning = audit.warning;
          const letter = buildMaintenanceRequestLetter({
            state,
            recipientName,
            senderName,
            propertyAddress,
            durationGate: wizardState.fields.duration,
            attorneyReviewDecision: resolveAttorneyReviewDecision(wizardState.access.requiredFlow, 'declined'),
            maintenanceDescription,
          });
          letterText = renderLetterAsPlainText(letter);
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  return (
    <main>
      <h1>Track 1 — Advocacy Wizard</h1>
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
          <legend>Letter parties</legend>
          <label>
            Recipient name <input name="recipientName" defaultValue={recipientName} required />
          </label>
          <label>
            Your name <input name="senderName" defaultValue={senderName} required />
          </label>
          <label>
            Maintenance requested{' '}
            <input name="maintenanceDescription" defaultValue={maintenanceDescription} />
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
        <button type="submit">Run wizard</button>
      </form>

      {auditBlocked && <p role="alert">{auditBlocked}</p>}

      {/* Operator-facing, not homeowner-facing. It says the records are going
          somewhere that works locally and will not survive a serverless host. */}
      {auditWarning && <p role="status"><small>{auditWarning}</small></p>}

      {error && <p role="alert">{error}</p>}

      {unavailableMessage && (
        <>
          <h2>Track 1 not available</h2>
          <p>{unavailableMessage}</p>
        </>
      )}

      {fallbackLetterText && (
        <>
          <h2>Duration field blocked — Track 2 fallback offered instead</h2>
          <pre>{fallbackLetterText}</pre>
        </>
      )}

      {letterText && (
        <>
          <h2>Maintenance Request Letter (Track 1)</h2>
          <pre>{letterText}</pre>
        </>
      )}
    </main>
  );
}
