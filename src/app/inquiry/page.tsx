import { analyzeEasement } from '@/lib/analysis-layer';
import { getStateCompliance } from '@/config/state-tiers';
import { AUDIT_BLOCKED_MESSAGE, recordGeneration } from '@/lib/compliance/record-generation';
import {
  buildRequestForClarificationLetter,
  clarificationPointFromTieredResult,
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


interface InquiryPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * Minimal, functional demo of the Step 4 module (Track 2 Request for
 * Clarification letter), chained onto Step 1 (address normalization) and
 * Step 2 (Analysis Layer). This is the UX Agent's "Request for Clarification
 * fallback offer when a needed field is flagged," proved end to end as a
 * harness — not the polished send flow.
 */
export default async function InquiryPage({ searchParams }: InquiryPageProps) {
  const street = param(searchParams.street);
  const city = param(searchParams.city);
  const state = param(searchParams.state) || 'CA';
  const zip = param(searchParams.zip);
  const recipientName = param(searchParams.recipientName);
  const senderName = param(searchParams.senderName);
  const easementType = (param(searchParams.easementType) || 'appurtenant') as
    | 'appurtenant'
    | 'in-gross'
    | 'prescriptive'
    | 'unknown';
  const hasPerpetualLanguage = param(searchParams.hasPerpetualLanguage) === 'on';
  const hasTermOrConditionSubsequent = param(searchParams.hasTermOrConditionSubsequent) === 'on';
  const submitted = searchParams.submitted === '1';

  let letterText: string | null = null;
  let noClarificationNeeded = false;
  let error: string | null = null;
  let auditBlocked: string | null = null;
  let auditWarning: string | null = null;

  if (submitted) {
    try {
      const propertyAddress = normalizeAddress({ street, city, state, zip });
      const analysis = analyzeEasement({
        state,
        duration: {
          easementType,
          hasPerpetualLanguage,
          hasTermOrConditionSubsequent,
          documentLegible: true,
        },
      });

      const point = clarificationPointFromTieredResult('Easement duration', analysis.duration);
      if (!point) {
        noClarificationNeeded = true;
      } else {
        // Track 2 is free, and it is audited on the same terms as Track 1. The
        // reason to record is the compliance basis an artefact was prepared
        // under, which does not change with the price.
        const audit = await recordGeneration({
          letterType: 'request-for-clarification',
          stateCompliance: getStateCompliance(state),
          ruleSet: analysis.ruleSet,
          firedRule: analysis.firedRule ?? undefined,
        });
        if (!audit.ok) {
          auditBlocked = AUDIT_BLOCKED_MESSAGE;
        } else {
          auditWarning = audit.warning;
          const letter = buildRequestForClarificationLetter({
            recipientName,
            senderName,
            propertyAddress,
            clarificationPoints: [point],
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
      <h1>Track 2 — Request for Clarification</h1>
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
        <button type="submit">Generate letter</button>
      </form>

      {auditBlocked && <p role="alert">{auditBlocked}</p>}

      {/* Operator-facing. */}
      {auditWarning && (
        <p role="status">
          <small>{auditWarning}</small>
        </p>
      )}

      {error && <p role="alert">{error}</p>}
      {noClarificationNeeded && (
        <p>Easement duration came back Clear — no Request for Clarification is needed.</p>
      )}
      {letterText && <pre>{letterText}</pre>}
    </main>
  );
}
