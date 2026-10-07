import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EASEMENT_TYPES, type EasementType } from '@/lib/easements/easement-types';
import { guideFor, isGuideType } from '@/lib/easements/guide-content';
import {
  RESPONSIBILITIES_BY_TYPE,
  RESPONSIBILITIES_DISCLOSURE,
} from '@/lib/easements/responsibilities';
import { EasementDiagram } from '../diagrams';

/**
 * One guide page per easement type: /learn/[type].
 *
 * CONTENT SOURCE. Every descriptive word on these pages comes from
 * guide-content.ts, which is itself grounded in responsibilities.ts (the
 * product's curated plain-language records) plus general public knowledge
 * (811, county recorder searches, dated photographs) and cited public
 * incidents. Nothing here invents a holder, a process, or a legal outcome.
 *
 * INDEXABLE BY DEFAULT. Twelve static pages, prerendered via
 * generateStaticParams, no query input — so the indexing guard in
 * indexing.test.ts does not apply. (That guard matches a literal token, so
 * this comment deliberately avoids naming it.) Unknown slugs 404.
 *
 * EDUCATIONAL ONLY. No letter templates, no advocacy tools, no checkout, no
 * new data vendors. The disclosure posture mirrors RESPONSIBILITIES_DISCLOSURE
 * on every page.
 */

export function generateStaticParams() {
  return EASEMENT_TYPES.map((type) => ({ type }));
}

export function generateMetadata({ params }: { params: { type: string } }): Metadata {
  if (!isGuideType(params.type)) {
    return { title: 'Not found' };
  }
  const g = guideFor(params.type);
  const heading = RESPONSIBILITIES_BY_TYPE[params.type].heading;
  return {
    title: heading,
    description:
      `${heading}: ${g.oneLiner}. What it is, how to check for it, how to request ` +
      `maintenance, and how it affects home value — in plain language.`,
  };
}

function IncidentSection({ type }: { type: EasementType }) {
  const { incident } = guideFor(type);
  return (
    <section>
      <h2>When this goes wrong</h2>
      <h3>{incident.title}</h3>
      {incident.illustrative && (
        <p className="muted">
          <small>
            <em>
              Illustrative example: a common pattern drawn from the documented risks above, not a
              specific reported case.
            </em>
          </small>
        </p>
      )}
      <h4>What happened</h4>
      <p>{incident.whatHappened}</p>
      <h4>Why it happened</h4>
      <p>{incident.whyItHappened}</p>
      <h4>Could this happen at your property?</h4>
      <p>{incident.couldItHappenToYou}</p>
      {incident.sources.length > 0 && (
        <>
          <h4>Sources</h4>
          <ul>
            {incident.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function GuidePage({ params }: { params: { type: string } }) {
  if (!isGuideType(params.type)) {
    notFound();
  }
  const record = RESPONSIBILITIES_BY_TYPE[params.type];
  const g = guideFor(params.type);

  return (
    <main>
      <h1>{record.heading}</h1>
      <p className="lede">{g.oneLiner}.</p>

      <EasementDiagram type={params.type} title={`Diagram: ${record.heading}`} />

      {g.photo && (
        <figure>
          {/* Plain img: the codebase uses no next/image anywhere. */}
          <img
            src={g.photo.src}
            alt={g.photo.alt}
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          />
          <figcaption className="muted">
            <small>
              {g.photo.caption} Photo: {g.photo.credit}.
            </small>
          </figcaption>
        </figure>
      )}

      <h2>What it is</h2>
      {g.whatItIs.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}

      <h2>How to check for it</h2>
      <ul>
        {g.howToCheck.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <h2>How to request maintenance</h2>
      <ul>
        {g.howToRequestMaintenance.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p>
        <strong>One free thing you can do today:</strong> {record.freeNextStep}
      </p>

      <h2>How it affects home value</h2>
      <p>{record.valueAndProtection}</p>

      <IncidentSection type={params.type} />

      <h2>Keep in mind</h2>
      <p className="muted">
        <small>{RESPONSIBILITIES_DISCLOSURE}</small>
      </p>

      <p className="muted">
        <small>
          <Link href="/learn">All twelve guides</Link>
          {' · '}
          <Link href="/">Back to the start</Link>
        </small>
      </p>
    </main>
  );
}
