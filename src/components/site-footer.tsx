import Link from 'next/link';

/**
 * The site footer.
 *
 * BUILT ONCE AND RENDERED FROM THE ROOT LAYOUT, because two briefs call for
 * the same three things — a Privacy link, a contact address, and the "not a
 * survey, appraisal, or legal opinion" line — and a footer duplicated per page
 * is a footer that will say different things on different pages within a
 * month.
 *
 * IN THE LAYOUT RATHER THAN PER PAGE means it also lands on the report, which
 * already carries far longer disclaimers. That is the right outcome rather
 * than a collision: the long ones explain what a particular finding does not
 * establish, and this one states the standing limit on everything, including
 * the pages that carry no other disclaimer at all.
 *
 * THE CONTACT ADDRESS IS A REAL ONE, supplied by the founder on 2026-10-05.
 * It is written here once and imported wherever it is needed, so there is no
 * second copy to go stale — and no invented one, which is what the placeholder
 * was protecting against.
 */

export const PRODUCT_NAME = 'SafeHomeValue';
export const CONTACT_EMAIL = 'help@safehomevalue.com';

/**
 * The standing limit, stated wherever the product is.
 *
 * Deliberately the same words in the footer and the privacy page: a reader who
 * notices the two differ has been given a reason to wonder which one counts.
 */
export const NOT_A_SURVEY_LINE =
  'Not a survey, appraisal, or legal opinion.';

export function SiteFooter() {
  return (
    <footer>
      <hr />
      <p className="muted">
        <small>
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </small>
      </p>
      <p className="muted">
        <small>{NOT_A_SURVEY_LINE}</small>
      </p>
    </footer>
  );
}
