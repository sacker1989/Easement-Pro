'use client';

import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

/**
 * Vercel Web Analytics, with the address stripped out of the URL first.
 *
 * THE DEFECT THIS FIXES. `/report` carries the user's street address in its
 * query string — `?street=8321+Faust+Ave&city=…&zip=…` — and Web Analytics
 * reports the page URL. Read the shipped script and the relevant function is:
 *
 *     function n(t){ let e=location.href;
 *       if(t){ let n=new URL(e); if(n.pathname!==t){ n.pathname=t; n.search=""; return n.href } }
 *       return e }
 *
 * The query string is cleared only on the branch where a parameterised route
 * was supplied AND differs from the real pathname. We mount
 * `@vercel/analytics/react` — confirmed live from the script tag's
 * `data-sdkn` — which supplies no route at all, so `t` is undefined and the
 * function returns `location.href` entire. For `/report` that is the
 * homeowner's address, sent to a third party on every report.
 *
 * WHICH CONTRADICTS THE PRODUCT'S LOUDEST PROMISE. The homepage trust strip
 * says "We never log your address", and the FAQ goes further: "it is never
 * written to our logs — the system is built so it structurally can't be, not
 * merely so we promise not to." outcome-log.ts really does make that true for
 * our own logging, with a closed union that will not accept free text. None
 * of that reaches a third-party beacon fired from the browser.
 *
 * WHY A CLIENT COMPONENT. `beforeSend` is a function prop, and the root
 * layout is a Server Component, which cannot pass functions across the
 * boundary. The wrapper exists for that reason alone.
 *
 * WHAT THIS DOES NOT FIX, and it is the larger half: the address is still in
 * the URL, so it is still in the browser's history and in the host's own
 * request logs. Keeping it out of those means not putting it in a URL at all
 * — a POST form, or a server-side exchange — which is a change to how the
 * report is reached and is not a thing to do unsupervised. Recorded here and
 * raised rather than attempted.
 */
export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        /*
         * STRIP RATHER THAN DROP. Returning null would discard the event and
         * lose the pageview count for the one page that matters most to the
         * product. The count is not the sensitive part; the query string is.
         *
         * Defensive about parsing: if the URL will not parse for any reason,
         * send nothing rather than risk sending it intact. A missing data
         * point costs an operator a number. The other way costs a homeowner
         * their address.
         */
        try {
          const url = new URL(event.url);
          url.search = '';
          url.hash = '';
          return { ...event, url: url.toString() };
        } catch {
          return null;
        }
      }}
    />
  );
}
