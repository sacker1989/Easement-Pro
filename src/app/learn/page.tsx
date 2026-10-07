import type { Metadata } from 'next';
import Link from 'next/link';
import { EASEMENT_TYPES } from '@/lib/easements/easement-types';
import { guideFor } from '@/lib/easements/guide-content';
import { RESPONSIBILITIES_BY_TYPE } from '@/lib/easements/responsibilities';

/**
 * The /learn index: plain-language guides to all twelve easement types.
 *
 * WHY A GUIDES SECTION EXISTS. Most homeowners have never heard the word
 * "easement" — the product's own naming research confirmed it — so the report
 * alone asks them to absorb a new concept at the exact moment they are
 * worried about their house. These guides let someone learn first, in words
 * that assume nothing, and arrive at the report already oriented.
 *
 * INDEXABLE BY DEFAULT, deliberately. Nothing here is personal. This page
 * takes no query input, so the indexing guard in indexing.test.ts does not
 * apply to it. (That guard matches a literal token, so this comment
 * deliberately avoids naming it.)
 *
 * The headline never leads with the word "easement": the people this is for
 * do not know the word yet, and a headline is not the place to teach it.
 */

export const metadata: Metadata = {
  title: 'Learn',
  description:
    'Plain-language guides to the twelve things that can cross your property — what they are, how to check for them, how to get them maintained, and how they affect home value.',
};

export default function LearnPage() {
  return (
    <main>
      <h1>What else is on your property — and what it means for you</h1>
      <p className="lede">
        Your deed may give someone else the right to use part of your land: a utility’s wires or
        pipes, a neighbor’s driveway, a drainage path, a pipeline corridor. These guides explain
        each one in plain language — what it is, how to check whether you have it, how to get it
        maintained, and what it does to your home’s value.
      </p>

      <ul className="guide-list">
        {EASEMENT_TYPES.map((type) => {
          const g = guideFor(type);
          const heading = RESPONSIBILITIES_BY_TYPE[type].heading;
          return (
            <li key={type}>
              <Link href={`/learn/${type}`}>{heading}</Link>
              <p>{g.oneLiner}.</p>
            </li>
          );
        })}
      </ul>

      <h2>A note on what these guides are</h2>
      <p className="muted">
        <small>
          These guides describe the arrangements that are usual for each kind of easement. They
          are not a reading of your easement document and not legal advice — your recorded
          document controls, and it can say the opposite of anything here. When it matters,
          confirm against the recorded instrument or with an attorney licensed in your state.
        </small>
      </p>

      <p className="muted">
        <small>
          <Link href="/">Back to the start</Link>
        </small>
      </p>
    </main>
  );
}
