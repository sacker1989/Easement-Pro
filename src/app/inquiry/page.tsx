import { analyzeEasement } from '@/lib/analysis-layer';
import {
  buildRequestForClarificationLetter,
  clarificationPointFromTieredResult,
  renderLetterAsPlainText,
} from '@/lib/letters';
import { normalizeAddress } from '@/lib/parcel-resolution';

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
        const letter = buildRequestForClarificationLetter({
          recipientName,
          senderName,
          propertyAddress,
          clarificationPoints: [point],
        });
        letterText = renderLetterAsPlainText(letter);
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

      {error && <p role="alert">{error}</p>}
      {noClarificationNeeded && (
        <p>Easement duration came back Clear — no Request for Clarification is needed.</p>
      )}
      {letterText && <pre>{letterText}</pre>}
    </main>
  );
}
