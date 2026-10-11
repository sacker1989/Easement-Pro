import Link from 'next/link';
import type { Metadata } from 'next';
import { CONTACT_EMAIL, PRODUCT_NAME } from '@/components/site-footer';

/**
 * The privacy page.
 *
 * WHAT IT PROMISES, in plain order. The address a homeowner types is used
 * once to build their report and is never written to a log. There are no
 * accounts and no passwords. The only measurement is
 * privacy-friendly aggregate analytics — counts of visits and reports, never
 * who asked for what. Nothing is sold, rented, or shared, and there are no
 * advertising trackers. Reports are generated in the moment; no copy is kept
 * tied to the person who asked.
 *
 * THE ONE EXCEPTION IS THE COUNTY WAITLIST, added 2026-10-07 at the founder's
 * direction, and it is written as narrowly as it actually is. An optional
 * email, used for one message when that county goes live, never sold or
 * shared, deletable on request. Stated as a PURPOSE rather than as a
 * permission: 'we may contact you about our services' is the sentence that
 * turns a waitlist into a mailing list, and it is not here.
 *
 * IT IS ALSO WRITTEN CONDITIONALLY — 'if you join' — so the page is accurate
 * whether or not a capture form exists yet. Nothing on the site collects an
 * email today; see the homepage FAQ, which still routes the request through a
 * mailto.
 *
 * WHAT IT DOES NOT PROMISE. The tool gives property information for learning
 * purposes only. It is not a survey, not an appraisal, and not legal advice.
 *
 * THE "NEVER WRITTEN TO OUR LOGS" CLAIM IS STRUCTURAL, which is why it can be
 * stated this plainly. `src/lib/observability/outcome-log.ts` records upstream
 * outcomes with a CLOSED UNION for the failure reason rather than a string, so
 * `log(err.message)` does not compile — and the geocoder is called with the
 * address in the URL, which is exactly how an address would otherwise reach a
 * log. There is no ZIP field either. The page is describing a property of the
 * code, not an intention.
 *
 * INDEXABLE, unlike the report. A report URL carries the user's address in its
 * query string and is noindex for that reason; this page carries nothing and
 * is one of the two pages a search engine should find.
 */

export const metadata: Metadata = {
  /*
   * ABSOLUTE, so the layout's suffix is not appended. The brief specifies this
   * title exactly, and a privacy policy is the one page where the title should
   * read as the document's own name rather than as site furniture.
   */
  title: { absolute: `Privacy Policy — ${PRODUCT_NAME}` },
  /*
   * THE DESCRIPTION CARRIED THE OVERSTATEMENT TOO, which is the easiest place
   * for one to survive a correction: nobody rereads the meta tag. It said the
   * address "is never written to our logs" — the absolute the body text
   * stopped making on 2026-10-11. A search result is where most readers meet
   * a privacy claim first, so it is the last place an overstatement should
   * outlive the page.
   */
  description:
    'The address you enter is used once to build your report. Our records are built so it ' +
    'cannot get into them. No accounts, no cookies, no email, nothing sold or shared.',
};

export default function PrivacyPage() {
  return (
    <main>
      <h1>How your privacy works here</h1>
      <p className="lede">
        The short version: type an address, get a report, and we keep nothing about you.
      </p>

      <h2>What happens to the address you enter</h2>
      <p>
        It is used once, to generate your report. We do not store the addresses people look up, we
        do not keep a copy of your report tied to you, and each report is generated in the moment
        you ask for it.
      </p>
      <p>
        Our own records are built so the address cannot get into them. The thing that writes our
        operational log will not accept free text at all — it takes a fixed list of outcomes, a
        state, and a county — so an address has nowhere to go even by mistake. That is a property
        of the code, not a policy someone has to remember.
      </p>
      {/*
        PRECISE RATHER THAN ABSOLUTE, AND IT USED TO BE ABSOLUTE.

        This section said the address is "never written to our logs", full
        stop. That is true of the application — outcome-log.ts enforces it
        with a closed union — and it was not the whole picture, because the
        address travels in the page's own URL. A URL reaches the browser's
        history and the automatic request records that any web host keeps,
        neither of which the application controls.

        Saying so costs a strong sentence and is the right trade on a privacy
        page: a reader who later notices the address in their address bar has
        no way to tell an overstatement from a lie. The honest version is also
        the one that explains what we are doing about it.
      */}
      <p>
        One honest limit. Your address travels in this page&rsquo;s own web address — you can see
        it in your browser&rsquo;s address bar while you read the report. That means it can appear
        in places the tool does not control: your own browser history, and the automatic request
        records that any web host keeps. We do not use those records to look up who searched for
        what, and nothing in the product reads them. Getting the address out of the URL entirely
        is the fix, and it is work in progress rather than something we can claim today.
      </p>

      <h2>What we never ask for</h2>
      <p>
        There are no accounts and no passwords. You cannot sign up for anything to use the tool —
        it works the same for everyone, anonymously, and you never have to tell us who you are to
        get a report.
      </p>

      <h2>The one time we ask for an email</h2>
      <p>
        If your county isn&rsquo;t covered yet, you can ask us to tell you when it is. That is the
        only thing on this site that takes an email address, it is entirely optional, and the tool
        works exactly the same whether or not you give one.
      </p>
      <p>
        <strong>We use it for that one message and nothing else.</strong> If you join the county
        waitlist, your address goes on a list of counties people have asked for, and your email is
        used to send you a single note when yours is live. No newsletter, no marketing, no
        &ldquo;while we have you&rdquo; — those are different purposes and we did not ask you about
        them.
      </p>
      <p>
        <strong>We never sell, rent, trade, or share it.</strong> Not with advertisers, not with
        data brokers, not with partners. It is not combined with anything else about you, because
        there is nothing else about you — we do not store the addresses people look up, so there is
        nothing to connect an email to.
      </p>
      <p>
        Ask us to delete it at any time, at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, and it is gone. You do not have to
        explain why.
      </p>

      <h2>What we measure</h2>
      <p>
        We count visits and reports, and that is all. The analytics are Vercel Web Analytics —
        Vercel also hosts the site — and we name them because &ldquo;privacy-friendly&rdquo; is
        not something you should have to take on trust without knowing who receives the data.
      </p>
      <p>
        This site sets <strong>no cookies at all</strong>, stores nothing in your browser, and
        loads no scripts from anyone else. You can check: open your browser&rsquo;s developer
        tools on this page and look at Storage and Network.
      </p>
      {/*
        THE QUERY STRING IS STRIPPED BEFORE THE EVENT IS SENT, and this
        paragraph exists because it was not always. Vercel Web Analytics
        reports location.href when no parameterised route is supplied, which
        is the case for the React integration this site mounts — so every
        report pageview was sending the address while the page said "counts,
        not identities". See components/analytics.tsx. Describing the measure
        here is what keeps the claim checkable rather than reassuring.
      */}
      <p>
        One detail that matters, because the address is in the page&rsquo;s URL: the analytics
        event is sent with the address stripped out of it. What gets counted is that someone
        viewed a report, not which property. There are no advertising trackers here, and we do
        not sell, rent, or share any data — including a waitlist email, which is the only
        personal thing we ever hold.
      </p>

      <h2>What this tool is, and is not</h2>
      <p>
        {PRODUCT_NAME} gives property information for educational purposes only. It is not a survey
        of your land, not an appraisal of its value, and not legal advice. If a decision matters —
        buying, selling, building, or disputing something — confirm it against the recorded
        documents or with a licensed professional.
      </p>

      <h2>Questions</h2>
      <p>
        If you have a question about any of this, write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p>
        <Link href="/">Back to the start</Link>
      </p>
    </main>
  );
}
