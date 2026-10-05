/**
 * Whether operator-only pages are reachable.
 *
 * FOUND IMMEDIATELY BEFORE THE FIRST DEPLOY, which is the right time and an
 * uncomfortably narrow margin. `/readiness` was built as an operator tool and
 * was reachable by anyone who guessed the URL. Served from a live host it
 * would have published:
 *
 *   - the server's filesystem paths, verbatim, including the operator's home
 *     directory
 *   - every open compliance gap in full, including that California operates
 *     Track 1 without a counsel opinion
 *   - every accepted-risk rationale, with its owner and date
 *
 * None of that is secret in the sense of a credential, and all of it is
 * deliberately written down — the gap registry exists precisely so these are
 * recorded rather than hidden. But recorded for an operator and published at a
 * guessable URL are different things. The third item is an admission about
 * unreviewed legal exposure, in the product's own words, ready to screenshot.
 *
 * DEFAULT CLOSED, AND THE DEFAULT IS THE POINT. The variable must be set to
 * open the page, not to close it. A gate that must be remembered in order to
 * protect something is a gate that will be forgotten on the one host where it
 * matters — and the cost of forgetting runs entirely one way here, since an
 * operator who finds the page 404ing knows immediately what to do, whereas
 * nobody notices an exposure.
 *
 * DEVELOPMENT IS OPEN, because a local server is already the operator's own
 * machine and making them set a variable to see their own readiness would
 * teach them to set it everywhere, which defeats the purpose.
 */

export const OPERATOR_PAGES_ENV = 'ENABLE_OPERATOR_PAGES';

/**
 * True when operator-only pages may be served.
 *
 * Takes `env` rather than reading `process.env` directly so the behaviour is
 * testable without mutating global state — the same reason
 * `resolveAuditStore` takes one.
 */
export function operatorPagesEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (env.NODE_ENV !== 'production') return true;
  return env[OPERATOR_PAGES_ENV] === '1';
}

/**
 * What an operator sees when they have hit the closed gate rather than a
 * genuine 404.
 *
 * Deliberately NOT rendered to the public — the page 404s instead. This string
 * exists for the deploy runbook and for the readiness check, so the fix is
 * discoverable from somewhere other than this file's source.
 */
export const OPERATOR_PAGES_CLOSED_NOTE =
  `Operator pages are not served in production unless ${OPERATOR_PAGES_ENV}=1. They expose server ` +
  'filesystem paths, every open compliance gap and every accepted-risk rationale — written down ' +
  'deliberately, and not for publication at a guessable URL. Set the variable only on a ' +
  'deployment the public cannot reach, or read the same information by running the test suite.';
