import Link from 'next/link';

/**
 * The privacy page.
 *
 * WHAT IT PROMISES, in plain order. The address a homeowner types is used
 * once to build their report and is never written to a log. There are no
 * accounts, no passwords, no email collection. The only measurement is
 * privacy-friendly aggregate analytics — counts of visits and reports, never
 * who asked for what. Nothing is sold, rented, or shared, and there are no
 * advertising trackers. Reports are generated in the moment; no copy is kept
 * tied to the person who asked.
 *
 * WHAT IT DOES NOT PROMISE. The tool gives property information for learning
 * purposes only. It is not a survey, not an appraisal, and not legal advice.
 *
 * CONTACT EMAIL is still the founder's decision — the placeholder below is
 * deliberate, not an oversight. Nothing here invents one.
 */
export default function PrivacyPage() {
  return (
    <main>
      <h1>How your privacy works here</h1>
      <p className="lede">
        The short version: type an address, get a report, and we keep nothing
        about you.
      </p>

      <h2>What happens to the address you enter</h2>
      <p>
        It is used once, to generate your report, and never written to our
        logs. We do not store the addresses people look up, and we do not keep
        a copy of your report tied to you. Each report is generated in the
        moment you ask for it.
      </p>

      <h2>What we never ask for</h2>
      <p>
        There are no accounts, no passwords, and no email addresses on this
        site. You cannot sign up for anything because there is nothing to sign
        up for — the tool works the same for everyone, anonymously.
      </p>

      <h2>What we measure</h2>
      <p>
        We use privacy-friendly aggregate analytics: how many people visit, how
        many reports get generated. Counts, not identities. There are no
        advertising trackers on this site, and we do not sell, rent, or share
        any data — there is nothing personal to sell in the first place.
      </p>

      <h2>What this tool is, and is not</h2>
      <p>
        SafeHomeValue gives property information for educational purposes only.
        It is not a survey of your land, not an appraisal of its value, and
        not legal advice. If a decision matters — buying, selling, building, or
        disputing something — confirm it against the recorded documents or with
        a licensed professional.
      </p>

      <h2>Questions</h2>
      <p>
        If you have a question about any of this, write to [CONTACT EMAIL].
      </p>

      <p>
        <Link href="/">Back to the start</Link>
      </p>
    </main>
  );
}
