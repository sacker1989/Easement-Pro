import Link from 'next/link';
import { EASEMENT_TYPES } from '@/lib/easements/easement-types';
import { SUPPORTED_COUNTIES } from '@/lib/parcel-lookup/county-dispatch';

/**
 * The front door.
 *
 * WHAT IT REPLACED, which is the point of this file existing. Until now `/`
 * read "Easement MVP — Phase 1 build in progress. Start at /search." Every
 * visitor to a product whose whole purpose is reaching homeowners was met with
 * a developer's placeholder and a path to a debug harness. The report page had
 * been built, rebuilt and verified a dozen times; nobody could get to it.
 *
 * THE FORM IS HERE RATHER THAN BEHIND A LINK. A landing page that explains and
 * then asks for a click loses people at the click. The address fields are the
 * first thing below the sentence that says what this is, and submitting goes
 * straight to the finished report — there is no step in between and no account.
 *
 * WHAT IT DOES NOT ASK. Lot area and easement area have sensible defaults and
 * a homeowner does not know either of them. Asking on the front door would
 * trade the one thing they definitely know — their address — for two they do
 * not. Both remain editable on the report itself, where the context makes the
 * question answerable.
 *
 * THE TYPE PICKER IS THE ONE PIECE OF REAL FRICTION and is handled rather than
 * hidden. Every section downstream is keyed by easement type, so it cannot be
 * optional — but plenty of people genuinely do not know which they have. The
 * copy says to pick the closest and that it can be changed, because a wrong
 * first guess that produces a report beats a right answer nobody reaches.
 */

const TYPE_LABELS: Record<(typeof EASEMENT_TYPES)[number], string> = {
  'utility-overhead': 'Power or phone lines overhead',
  'utility-underground': 'Power or phone lines buried',
  sewer: 'A sewer line',
  'storm-drain': 'A storm drain',
  'water-line': 'A water line',
  pipeline: 'A gas or petroleum pipeline',
  'access-ingress-egress': 'A shared driveway or access road',
  'public-right-of-way': 'A public right of way along the road',
  drainage: 'A drainage channel or ditch',
  slope: 'A slope or embankment',
  conservation: 'A conservation restriction',
  prescriptive: 'Someone has just always used part of my land',
};

export default function HomePage() {
  return (
    <main>
      <h1>What does the easement on your property actually mean?</h1>
      <p className="lede">
        Enter your address. You&rsquo;ll get what public records say about your parcel, who is
        responsible for maintaining and repairing what, how long the easement lasts, what should be
        on record and often isn&rsquo;t, and a rough sense of the money involved.
      </p>
      <p className="muted">
        Free. No account, nothing to buy, and nothing is sent to anyone on your behalf.
      </p>

      <form action="/report">
        <input type="hidden" name="submitted" value="1" />
        <fieldset>
          <legend>Your property</legend>
          <div className="field-row">
            <label style={{ flex: 2 }}>
              Street address
              <input name="street" placeholder="1200 Getty Center Dr" required />
            </label>
            <label>
              City
              <input name="city" placeholder="Los Angeles" required />
            </label>
          </div>
          <div className="field-row">
            <label>
              State
              <input name="state" defaultValue="CA" maxLength={2} required />
            </label>
            <label>
              ZIP
              <input name="zip" placeholder="90049" required />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>What&rsquo;s on the land?</legend>
          <label>
            Pick the closest — you can change it on the next page.
            <select name="easementType" defaultValue="utility-overhead">
              {EASEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <p className="muted" style={{ marginTop: '0.6rem' }}>
            <small>
              Not sure? Pick whatever is nearest to the truth. The report explains each kind, and
              changing it takes one click.
            </small>
          </p>
        </fieldset>

        <button type="submit">Show me what it means</button>
      </form>

      <h2>What you&rsquo;ll get</h2>
      <div className="panel">
        <ul>
          <li>
            <strong>What you can and can&rsquo;t do</strong> on the easement area — fencing,
            building, planting, paving.
          </li>
          <li>
            <strong>Who is responsible for what.</strong> If a crew digs up your lawn, who puts it
            back? If the pipe under your yard fails, who pays? These are the questions people
            actually arrive with, and the answers are worth real money.
          </li>
          <li>
            <strong>How long it lasts</strong>, if you can tell us what your document says.
          </li>
          <li>
            <strong>What should be on record and often isn&rsquo;t.</strong> The exposure most
            homeowners miss runs the opposite way from the one they worry about.
          </li>
          <li>
            <strong>Your flood zone</strong>, from FEMA, with what it means for insurance and
            building.
          </li>
          <li>
            <strong>A rough scale of the money</strong> — enough to tell you whether this is worth a
            professional&rsquo;s time, with the arithmetic shown.
          </li>
        </ul>
      </div>

      {/*
        THE LIMITS, ON THE FRONT PAGE RATHER THAN THE LAST ONE.
        Everything above is a promise, and a homeowner deciding whether to
        trust this deserves the shape of what it cannot do before they spend
        five minutes on it — not after. It is also the honest basis on which
        this operates: a tool that reports what records say and refuses to
        interpret rights.
      */}
      <h2>What this can&rsquo;t tell you</h2>
      <div className="undetermined">
        <p style={{ marginTop: 0 }}>
          <strong>This is not legal advice and no attorney has reviewed it.</strong> It reports what
          public records and general rules say. It cannot read your recorded easement document,
          cannot tell you what your rights are, and cannot say whether a general rule applies to
          your parcel. Only an attorney licensed in your state can do that.
        </p>
        <p>
          <strong>It is not an appraisal.</strong> The money figure is an order-of-magnitude range
          for orientation. A defensible number needs a licensed appraiser, and the report explains
          what a good one produces so you can judge a quote.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Nothing is sent for you.</strong> Any letter this prepares is handed to you, to
          read, change and send yourself if you choose to.
        </p>
      </div>

      <h2>Coverage</h2>
      <p>
        Live county parcel records for{' '}
        <strong>{SUPPORTED_COUNTIES.join(", ")}</strong>. Every other address
        in the country still produces a report — it uses national benchmarks instead of your
        county&rsquo;s own figures, and says so wherever it does. The flood zone and the easement
        guidance work everywhere.
      </p>

      <p className="muted">
        <small>
          Looking for the single-step tools? <Link href="/search">Address lookup</Link> ·{' '}
          <Link href="/analyze">Duration analysis</Link>
        </small>
      </p>
    </main>
  );
}
