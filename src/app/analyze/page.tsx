import { analyzeEasement, UnsupportedStateRuleSetError } from '@/lib/analysis-layer';

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


interface AnalyzePageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * Minimal, functional demo of the Step 2 module (Analysis Layer confidence
 * tiering). Like /search, this is a harness to prove src/lib/analysis-layer
 * end to end behind a real route, not the UX Agent's polished three-state
 * confidence UI — that's separate scope.
 */
export default async function AnalyzePage({ searchParams }: AnalyzePageProps) {
  const state = param(searchParams.state) || 'CA';
  const easementType = param(searchParams.easementType) || 'appurtenant';
  const hasPerpetualLanguage = param(searchParams.hasPerpetualLanguage) === 'on';
  const hasTermOrConditionSubsequent = param(searchParams.hasTermOrConditionSubsequent) === 'on';
  const submitted = searchParams.submitted === '1';
  const documentLegible = submitted ? param(searchParams.documentLegible) === 'on' : true;

  let result: ReturnType<typeof analyzeEasement> | null = null;
  let error: string | null = null;

  if (submitted) {
    try {
      result = analyzeEasement({
        state,
        duration: {
          easementType: easementType as 'appurtenant' | 'in-gross' | 'prescriptive' | 'unknown',
          hasPerpetualLanguage,
          hasTermOrConditionSubsequent,
          documentLegible,
        },
      });
    } catch (err) {
      error = err instanceof UnsupportedStateRuleSetError ? err.message : 'Unknown error';
    }
  }

  return (
    <main>
      <h1>Analysis Layer — Duration Confidence Tiering</h1>
      <form>
        <input type="hidden" name="submitted" value="1" />
        <div>
          <label>
            State <input name="state" defaultValue={state} maxLength={2} />
          </label>
        </div>
        <div>
          <label>
            Easement type
            <select name="easementType" defaultValue={easementType}>
              <option value="appurtenant">Appurtenant</option>
              <option value="in-gross">In gross</option>
              <option value="prescriptive">Prescriptive</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" name="hasPerpetualLanguage" defaultChecked={hasPerpetualLanguage} />
            Document contains perpetual language
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="hasTermOrConditionSubsequent"
              defaultChecked={hasTermOrConditionSubsequent}
            />
            Document contains a specific term or condition subsequent
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" name="documentLegible" defaultChecked={documentLegible} />
            Document is legible
          </label>
        </div>
        <button type="submit">Analyze</button>
      </form>

      {error && <p role="alert">{error}</p>}

      {result?.duration.tier === 'clear' && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>What your document says</h2>
          <p>{result.duration.value.summary}</p>
          <p className="muted">
            <small>
              This is a reading of the document you described, not an opinion about your legal
              position. It holds whatever state you are in.
            </small>
          </p>
        </div>
      )}

      {/*
        THE ADVISORY PANEL. This is what a free analysis can offer when the
        answer depends on doctrine nobody has reviewed: the general rule, the
        question, and a plain statement that it has not been applied to this
        user. The heading says "could" and the closing line says to check with
        an attorney, because the whole panel is a pointer to a conversation
        rather than a finding.
      */}
      {result?.advisory && (
        <div className="undetermined">
          <h2 style={{ marginTop: 0 }}>What this could turn on</h2>
          <p>
            <strong>Your document did not state a duration</strong>, so the answer depends on what
            the law presumes. This tool does not apply law to your situation. Here is the general
            position and the question worth putting to an attorney.
          </p>
          <h3>The general rule</h3>
          <p>{result.advisory.generalPosition}</p>
          <h3>Ask an attorney</h3>
          <p>
            <em>&ldquo;{result.advisory.askYourAttorney}&rdquo;</em>
          </p>
          <h3>Why this is not an answer</h3>
          <p>{result.advisory.whyNotDetermined}</p>
          <p className="muted">
            <small>
              Nothing above is legal advice and no attorney has reviewed it. An attorney licensed
              in your state can tell you whether the general rule applies to your parcel; this tool
              cannot, and does not try.
            </small>
          </p>
        </div>
      )}

      {result && (
        <details>
          <summary>Raw analysis output (JSON)</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}
