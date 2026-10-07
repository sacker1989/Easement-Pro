import Link from 'next/link';
import { CONTACT_EMAIL, PRODUCT_NAME } from '@/components/site-footer';
import { SUPPORTED_COUNTIES } from '@/lib/parcel-lookup/county-dispatch';

/**
 * The marketing homepage.
 *
 * THE ADDRESS INPUT IS THE CALL TO ACTION. It posts straight into the existing
 * report flow — no account, no interstitial, no rebuild of anything
 * downstream. Everything else on this page exists to get someone to type into
 * that one field and to tell them honestly what they will get.
 *
 * "EASEMENT" NEVER APPEARS IN A HEADING, deliberately. Most homeowners do not
 * know the word, and a headline built on it asks the reader to already
 * understand the problem before they are allowed to care about it. The
 * headings describe what is at stake — what is hiding, what it costs, who is
 * meant to maintain it — and the word is explained in body copy where it can
 * carry its own definition.
 *
 * THE TYPE PICKER IS NOT HERE, and that is a change from the plain front door
 * this replaces. It asked for an easement type before showing anything, which
 * is a question most arrivals cannot answer and the single biggest reason to
 * leave. The report page still has the picker, with every type and plain
 * labels, so the choice is made in context after there is something on screen
 * to change.
 *
 * NO NEW DEPENDENCIES. The FAQ is native `details`/`summary`, the nav is
 * sticky by CSS, and the scroll-to-hero is an anchor. Nothing here ships
 * JavaScript.
 */

export const metadata = {
  title: {
    absolute: `${PRODUCT_NAME} — what's hiding in your property?`,
  },
  description:
    'Free. Hidden utility rights-of-way and maintenance obligations affect your home’s value ' +
    'and its safety. Enter your address and see what the public record says. Not legal advice.',
};

const WAITLIST_SUBJECT = encodeURIComponent('County waitlist');

export default function HomePage() {
  return (
    <>
      {/* 1. Sticky nav */}
      <nav className="site-nav">
        <a className="wordmark" href="#top">
          {PRODUCT_NAME}
        </a>
        <a href="#how-it-works">How it works</a>
        <a href="#why-it-matters">Why it matters</a>
        <a className="nav-cta" href="#address">
          Check your address
        </a>
      </nav>

      <main className="marketing" id="top">
        {/* 2. Hero */}
        <h1>What&rsquo;s hiding in your property?</h1>
        <p className="hero-sub">
          Hidden utility rights-of-way and maintenance obligations affect your home&rsquo;s value —
          and its safety. Most homeowners never see them. Get your free report.
        </p>

        <form className="hero-form" action="/report" id="address">
          <input type="hidden" name="submitted" value="1" />
          <div className="field-row">
            <label style={{ gridColumn: '1 / -1' }}>
              Street address
              <input name="street" placeholder="12321 W Gorham Ave" required autoComplete="street-address" />
            </label>
          </div>
          <div className="field-row">
            <label>
              City
              <input name="city" placeholder="Los Angeles" required autoComplete="address-level2" />
            </label>
            <label>
              State
              <input name="state" defaultValue="CA" maxLength={2} required autoComplete="address-level1" />
            </label>
            <label>
              ZIP
              <input name="zip" placeholder="90049" required inputMode="numeric" autoComplete="postal-code" />
            </label>
          </div>
          <button type="submit">Get my free report</button>
        </form>
        <p className="muted">
          <small>Free. No account. We never log your address.</small>
        </p>

        {/* 3. Two pillars */}
        <h2 id="why-it-matters">Why it matters</h2>
        <div className="pillars">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Maximize your value</h3>
            <p>
              A strip of your land can carry someone else&rsquo;s legal right to use it — a power
              line, a sewer main, a neighbour&rsquo;s driveway. That right is called an{' '}
              <strong>easement</strong>, and it limits where you can build, what you can plant, and
              what a buyer will pay. Most of it is on the public record and almost nobody looks.
            </p>
            <p style={{ marginBottom: 0 }}>
              Your report shows what affects your parcel, a range for what it costs you, and what
              you can do about it — including the documents that should exist and usually
              don&rsquo;t.
            </p>
          </div>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Protect your home</h3>
            <p>
              When a utility runs equipment across your neighbourhood, somebody is responsible for
              keeping it clear and in repair. Often that is the utility, not you — and when it is
              neglected, the risk lands on the people living there rather than the people who owned
              the duty.
            </p>
            <p style={{ marginBottom: 0 }}>
              Your report names who is normally responsible for maintenance, repair and putting
              your land back after work — so you know whose job it is before it matters.
            </p>
          </div>
        </div>

        {/* 4. How it works */}
        <h2 id="how-it-works">How it works</h2>
        <ol className="steps">
          <li>
            <strong>Enter your address.</strong> Nothing else — no account, no email.
          </li>
          <li>
            <strong>We pull parcel, assessor and hazard data.</strong> County records where we have
            them, national sources everywhere else, and we say which you got.
          </li>
          <li>
            <strong>Get your free report.</strong> What affects the property, what it does to the
            value, what you can and cannot do there, and who is responsible for maintenance.
          </li>
        </ol>

        {/* 5. Trust strip */}
        <ul className="trust">
          <li>Free for homeowners</li>
          <li>No account needed</li>
          <li>We never log your address</li>
          <li>
            Not legal advice — <Link href="/privacy">read the full disclaimer</Link>
          </li>
        </ul>

        {/* 6. FAQ — native details, no JavaScript */}
        <h2>Questions people ask</h2>
        <div className="faq">
          <details>
            <summary>What is an easement, in plain English?</summary>
            <p>
              It is someone else&rsquo;s legal right to use part of your land for a specific
              purpose — running a power line, maintaining a sewer, crossing to reach their own
              property. You still own the land. They have a right to use that part of it, and you
              generally cannot build over it or block their access.
            </p>
          </details>
          <details>
            <summary>Is this legal advice?</summary>
            <p>
              No. This is educational information drawn from public records and general rules. It
              is not a survey, not an appraisal, and not a legal opinion, and no attorney has
              reviewed it. For anything that matters — buying, selling, building, or a dispute —
              talk to a licensed professional in your state.
            </p>
          </details>
          <details>
            <summary>Do you store my address?</summary>
            <p>
              No. It is used once to build your report and is never written to our logs — the
              system is built so it structurally can&rsquo;t be, not merely so we promise not to.{' '}
              <Link href="/privacy">The privacy page explains how.</Link>
            </p>
          </details>
          <details>
            <summary>Which areas are covered?</summary>
            <p>
              Full county records for {SUPPORTED_COUNTIES.join(', ')} today. Any other address in
              the country still produces a report — it uses national data instead of your
              county&rsquo;s own figures and says so wherever it does.
            </p>
            <p>
              Want your county next?{' '}
              <a href={`mailto:${CONTACT_EMAIL}?subject=${WAITLIST_SUBJECT}`}>
                Email us and say where you are.
              </a>{' '}
              There is no signup form here on purpose — we do not collect email addresses, so this
              goes straight to a person instead.
            </p>
          </details>
        </div>
      </main>
    </>
  );
}
