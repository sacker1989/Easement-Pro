import Link from 'next/link';

/**
 * The 404.
 *
 * REACHED MORE OFTEN THAN A 404 USUALLY IS, because `/readiness` deliberately
 * returns one in production — the operator gate renders this rather than
 * admitting a page exists and is switched off. So it has to read as an
 * ordinary missing page to someone probing, while still being useful to a
 * homeowner who mistyped or followed a stale link.
 *
 * It says nothing about what else exists. A "did you mean /readiness?" hint
 * would undo the gate.
 */
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p className="lede">There&rsquo;s nothing at this address.</p>
      <p>
        <Link href="/">Start from the beginning</Link> — enter your property address and find out
        what an easement on it means.
      </p>
    </main>
  );
}
