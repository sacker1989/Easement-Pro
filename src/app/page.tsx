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
  /*
   * THE TITLE NAMES THE JOB, which is a different job from the headline's.
   *
   * It was "what's hiding in your property?" — the old h1, carried into the
   * tab. A question is good copy on the page, where the reader has already
   * arrived, and poor copy in a search result, where it competes with ten
   * other blue links and has to say what the thing IS. Someone types "property
   * easement report", not "what's hiding in my property".
   *
   * "easement" appears here and never in a heading on the page. That is not a
   * contradiction: the heading rule exists because a visitor may not know the
   * word, and this string is matched against a query from someone who typed
   * it.
   *
   * Absolute, so the layout's "· SafeHomeValue" suffix is not appended on top
   * of a name the string already carries.
   */
  title: {
    absolute: `${PRODUCT_NAME} — free property easement & risk report`,
  },
  description:
    'Free. Hidden utility rights-of-way and maintenance obligations affect your home’s value ' +
    'and its safety. Enter your address and see what the public record says. Not legal advice.',
};

/**
 * The county waitlist is a mailto, and the prefill is what makes that work.
 *
 * NO CAPTURE FORM BY CHOICE, not by omission. A form needs somewhere to put
 * the address, and there is no datastore here — Vercel's filesystem is
 * ephemeral, so a form would accept an email and silently drop it at the next
 * cold start, which is worse than not offering one. An inbox is a real store
 * that already exists.
 *
 * THE PREFILL IS THE WHOLE TRICK. Free-prose requests arrive as "any chance
 * you'll do Travis County?" and "we're in 78704" and have to be read one at a
 * time. Two labeled lines make the pile sortable by eye and countable without
 * opening anything, which is the difference between a rule somebody follows
 * and one they abandon in week three. See docs/waitlist-triage.md.
 *
 * It stays short on purpose: a long template reads as a form in disguise and
 * gets deleted.
 */
const WAITLIST_SUBJECT = encodeURIComponent('County waitlist');
const WAITLIST_BODY = encodeURIComponent(
  'County: \nState: \n\nAnything else you want to tell us is welcome.\n',
);

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
        {/*
          2. Hero — SEARCH FIRST.

          The address input sits directly under the headline, before any
          explanatory copy, the way Zillow and Redfin arrange it. Someone who
          already knows what they want should be able to act without reading a
          paragraph first, and someone who does not will scroll to the copy
          below. Explanation above the input taxes the people most ready to
          convert.
        */}
        <h1>
          Hidden risks. Silent damage. Thousands in lost value. What&rsquo;s hiding on your
          property? Get your free home report.
        </h1>

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
          {/*
            TWO BUTTONS, ONE FORM, AND THE SAME SEARCH.

            `audience` is a submit button with a value, so each posts the same
            address to the same place and differs only in who the report
            addresses. A dropdown would have made the reader choose before
            they understood there was a choice; two labeled buttons state the
            two situations and let them recognize theirs.

            The owner button is first and is the primary, because owners are
            who the product was built for and the overwhelming majority of the
            traffic. The buyer path is an addition, not a reframing.
          */}
          <div className="field-row" style={{ marginTop: '0.25rem' }}>
            <button type="submit" name="audience" value="owner">
              I own it — show my report
            </button>
            <button type="submit" name="audience" value="buyer" className="secondary">
              I&rsquo;m thinking of buying it
            </button>
          </div>
        </form>
        <p className="muted">
          <small>Free. No account. We never log your address.</small>
        </p>

        {/*
          The explanatory copy, moved below the input. The closing CTA it used
          to carry ("Get your free report") is gone, because the headline now
          says it — repeating it two lines apart would read as a stutter rather
          than as emphasis.
        */}
        <p className="hero-sub">
          Hidden utility rights-of-way and maintenance obligations affect your home&rsquo;s value —
          and its safety. Most homeowners never see them.
        </p>

        {/* 3. Two pillars */}
        <h2 id="why-it-matters">Why it matters</h2>
        <div className="pillars">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Maximize your value</h3>
            <p>
              A strip of your land can carry someone else&rsquo;s legal right to use it — a power
              line, a sewer main, a neighbor&rsquo;s driveway. That right is called an{' '}
              <strong>easement</strong>, and it limits where you can build, what you can plant, and
              what a buyer will pay. Most of it is on the public record and almost nobody looks.
            </p>
            {/*
              THE RANGE CLAIM IS CONDITIONAL, and saying so is not modesty.
              The dollar range needs a published land value, and outside the
              counties with live records there is none — the report refuses
              rather than substituting a national average, because land prices
              vary by more than an order of magnitude between neighborhoods.
              An unconditional promise here would send most visitors looking
              for a figure the product deliberately declines to invent.
            */}
            <p style={{ marginBottom: 0 }}>
              Your report shows what affects your parcel, what you can and cannot do there, and
              what to do about it — including the documents that should exist and usually
              don&rsquo;t. Where your county publishes an assessed land value, it also puts a range
              on what the easement costs you.
            </p>
          </div>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Protect your home</h3>
            <p>
              When a utility runs equipment across your neighborhood, somebody is responsible for
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
            <strong>Get your free report.</strong> What affects the property, what you can and
            cannot do there, who is responsible for maintenance, and — where your county publishes
            the figures — what it does to the value.
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
            {/*
              PRECISE, BECAUSE THE PRIVACY PAGE IS. This repeated the absolute
              "never written to our logs". True of the application — the
              operational log takes a closed set of values and will not accept
              free text — and not the whole story, because the address is in
              this page's URL and a URL reaches the browser's history and a
              host's automatic request records. Two pages making different
              strength claims about the same fact is how a reader learns to
              trust neither.
            */}
            <p>
              We don&rsquo;t store it. It is used once to build your report, and our own records
              are built so it cannot get into them — that is a property of the code, not a promise
              someone has to keep. One honest limit: the address is in this page&rsquo;s web
              address, so it reaches your browser history like any URL.{' '}
              <Link href="/privacy">The privacy page sets out exactly what that means.</Link>
            </p>
          </details>
          <details>
            <summary>Which areas are covered?</summary>
            {/*
              THIS USED TO SAY the report "uses national data instead of your
              county's own figures", which stopped being true on 2026-10-11.
              For a land value it does not substitute anything: an invented
              national median was removed, and the report now says it cannot
              say rather than quoting a number that would be wrong by an order
              of magnitude either way. Promising a substitute that no longer
              exists is the same defect as the substitute was.
            */}
            <p>
              Full county records for {SUPPORTED_COUNTIES.join(', ')} today. Any other address in
              the country still produces a report — the restrictions, the maintenance duties and
              the hazard data are the same everywhere.
            </p>
            <p>
              What needs your county&rsquo;s own figures is the money. Without a published land
              value the report tells you it cannot price the easement, rather than reaching for a
              national average — land is not worth the same per square foot in two places, and a
              figure that ignores that is worse than no figure.
            </p>
            <p>
              Want your county next?{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${WAITLIST_SUBJECT}&body=${WAITLIST_BODY}`}
              >
                Email us and say where you are.
              </a>{' '}
              We use your address for one thing — a single note when your county goes live. Never
              sold, never shared, never a newsletter, and deleted the moment you ask.{' '}
              <Link href="/privacy">The privacy page says so in full.</Link>
            </p>
          </details>
        </div>
      </main>
    </>
  );
}
