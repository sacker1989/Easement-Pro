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
import {
  LETTER_DISCLOSURE,
  LETTER_HEADLINE,
  LETTER_STEPS,
  STAGE_LABEL,
  stepsFor,
  type LetterStage,
} from '@/lib/easements/sending-the-letter';

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
      {/* HOMEOWNER-FACING AS OF 2026-11-21, because it is now linked from the
          report. Until then this page was reachable only by typing /advocacy
          into the address bar, so the only people who ever saw it were the
          ones who built it — and it read like it: "Track 1 — Advocacy
          Wizard", a "Run wizard" button, and a checkbox asking a homeowner
          whether their document contains a condition subsequent.

          The internal names are still correct and still used in the audit
          records and the gating layer. They just are not what you put in
          front of someone who came here from a report about their house. */}
      <h1>Write a maintenance request letter</h1>
      <p className="lede">
        This produces a letter you can print, sign and send to the utility or agency responsible for
        the easement, asking them to maintain it. You send it yourself — nothing is sent on your
        behalf. It is free.
      </p>
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
            My easement document says it lasts forever — &ldquo;perpetual&rdquo;, &ldquo;in
            perpetuity&rdquo;, or similar
          </label>
          <label>
            <input
              type="checkbox"
              name="hasTermOrConditionSubsequent"
              defaultChecked={hasTermOrConditionSubsequent}
            />
            My easement document gives it an end date, or says it ends if something happens
          </label>
          <p className="muted">
            <small>
              Leave both unchecked if you have not read the document or cannot find it. The letter
              still works; it just will not refer to how long the easement lasts.
            </small>
          </p>
        </fieldset>
        <button type="submit">Write my letter</button>
      </form>

      {auditBlocked && <p role="alert">{auditBlocked}</p>}

      {/* Operator-facing, not homeowner-facing. It says the records are going
          somewhere that works locally and will not survive a serverless host. */}
      {auditWarning && <p role="status"><small>{auditWarning}</small></p>}

      {error && <p role="alert">{error}</p>}

      {unavailableMessage && (
        <>
          <h2>Not available for your state</h2>
          <p>{unavailableMessage}</p>
        </>
      )}

      {fallbackLetterText && (
        <>
          {/* The duration finding was not confident enough to assert, so this
              asks the holder for their document instead of telling them what
              it says. Internally Track 2; to the reader it is just the letter
              that fits what is actually known. */}
          <h2>Your letter — a request for the easement document</h2>
          <p>
            Your answers did not establish how long the easement lasts, so rather than assert
            something uncertain, this letter asks the holder for a copy of the document itself. That
            is the stronger request anyway: it gets you the thing every other question depends on.
          </p>
          <pre>{fallbackLetterText}</pre>
        </>
      )}

      {letterText && (
        <>
          <h2>Your maintenance request letter</h2>
          <pre>{letterText}</pre>
        </>
      )}

      {(letterText || fallbackLetterText) && <WhatToDoWithIt />}
    </main>
  );
}

/**
 * What to do with the letter, rendered beneath it.
 *
 * WHY IT IS HERE AND NOT IN A GUIDE. Before this, the page produced a letter
 * in a <pre> and stopped. The letter's value is almost entirely in the record
 * it leaves — how it was sent, what was kept, whether anyone replied — and
 * none of that was said anywhere the person holding the letter would see it.
 * A reader who has just been handed a letter is the only reader who will act
 * on instructions for sending one.
 */
function WhatToDoWithIt() {
  // Stage order comes from the data rather than a second list here, so adding
  // a step cannot leave it rendered in the wrong place or not at all.
  const stages = [...new Set(LETTER_STEPS.map((s) => s.stage))] as LetterStage[];
  return (
    <section>
      <h2>What to do with it</h2>
      <p className="lede">{LETTER_HEADLINE}</p>
      {stages.map((stage) => (
        <div className="panel" key={stage}>
          <h3 style={{ marginTop: 0 }}>
            <span className="badge badge-ok" style={{ marginRight: '0.5rem' }}>
              {STAGE_LABEL[stage]}
            </span>
          </h3>
          {stepsFor(stage).map((s) => (
            <div key={s.id} style={{ marginBottom: '1.1rem' }}>
              <strong>{s.what}</strong>
              {s.costsMoney && (
                <>
                  {' '}
                  <span className="badge">costs a few dollars</span>
                </>
              )}
              <br />
              <small>{s.whyItMatters}</small>
              <br />
              <small className="muted">
                <strong>How:</strong> {s.how}
              </small>
            </div>
          ))}
        </div>
      ))}
      <p className="muted">
        <small>{LETTER_DISCLOSURE}</small>
      </p>
    </section>
  );
}
