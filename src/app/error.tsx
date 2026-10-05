'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * What a homeowner sees when the report throws.
 *
 * WHAT THEY SAW BEFORE: Next's default, which in production is a bare
 * "Application error: a server-side exception has occurred" and a digest hash.
 * For a consumer product that reads as broken-and-abandoned, and it tells
 * someone who came with a real problem nothing about what to do next.
 *
 * NO ERROR DETAIL IS RENDERED, and not only for tidiness. An upstream error
 * message routinely quotes the request URL, and this product's request URLs
 * carry the user's street address — printing `error.message` on a page the
 * user might screenshot into a forum post is the same leak the outcome log is
 * built to avoid, in a more public place. `digest` is a hash Next generates for
 * correlating with server logs and is safe to show.
 *
 * THE RETRY IS OFFERED FIRST because the realistic cause is a county GIS
 * service having a bad minute, which is exactly the kind of failure that
 * succeeds on a second attempt.
 */
export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // One line, no message, no stack. The outcome log already recorded which
    // upstream failed; this records that it reached the user.
    try {
      console.log(
        JSON.stringify({ evt: 'render-error', ts: new Date().toISOString(), digest: error.digest }),
      );
    } catch {
      /* diagnostics must not cause a second failure */
    }
  }, [error.digest]);

  return (
    <main>
      <h1>That didn&rsquo;t work</h1>
      <div className="undetermined">
        <p style={{ marginTop: 0 }}>
          Something went wrong putting your report together. The most likely cause is a county
          records service being temporarily unavailable — they go down more often than you would
          expect, and usually come back within minutes.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Nothing you entered was saved</strong>, and nothing was sent to anyone.
        </p>
      </div>

      <p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </p>

      <p>
        If it keeps failing, your county recorder&rsquo;s office can answer the same questions
        directly — and <Link href="/">starting over</Link> with a different easement type sometimes
        works, since the sections draw on different services.
      </p>

      {error.digest && (
        <p className="muted">
          <small>
            Reference: <code>{error.digest}</code>
          </small>
        </p>
      )}
    </main>
  );
}
