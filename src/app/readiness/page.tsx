import { assessDeploymentReadiness, blockingChecks, type CheckStatus } from '@/lib/deployment/readiness';

interface ReadinessPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * Operator-facing deployment readiness. Not linked from the product.
 *
 * WHY A PAGE AND NOT ONLY A TEST. The question "would this deploy right now"
 * gets asked by whoever is about to deploy, usually not from a terminal with
 * the repo checked out, and often about an environment other than the one in
 * front of them. `?env=production` answers that from anywhere.
 *
 * IT SHOWS NO USER DATA. Every value here is configuration and compliance
 * state — which statutes apply, which gaps are open, whether an audit path is
 * set. The audit path's VALUE is shown because an operator needs to confirm it
 * points where they think; it is a path, not a secret, and no secret is read
 * by this page at all.
 */
export default async function ReadinessPage({ searchParams }: ReadinessPageProps) {
  const state = (param(searchParams.state) || 'CA').toUpperCase();
  const envOverride = param(searchParams.env);
  const env = envOverride ? { ...process.env, NODE_ENV: envOverride } : process.env;

  const report = assessDeploymentReadiness(state, env);
  const blockers = blockingChecks(report);

  const badge: Record<CheckStatus, { label: string; className: string }> = {
    met: { label: 'MET', className: 'badge badge-ok' },
    blocking: { label: 'BLOCKING', className: 'badge badge-stop' },
    accepted: { label: 'ACCEPTED RISK', className: 'badge badge-warn' },
    open: { label: 'OPEN', className: 'badge badge-warn' },
  };

  return (
    <main>
      <h1>Deployment readiness — {report.state}</h1>
      <p className="muted">
        Reading <code>{report.environment}</code>. Switch with <code>?env=production</code> or{' '}
        <code>?state=FL</code>.
      </p>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>
          {report.canDeploy ? 'Clear to deploy' : `Blocked — ${blockers.length} item`}
          {!report.canDeploy && blockers.length === 1 ? '' : report.canDeploy ? '' : 's'}
        </h2>
        <p>
          {report.canDeploy
            ? 'No check reports that the product would fail to work as configured. Open and ' +
              'accepted items below ship knowingly — they are not launch blockers, and treating ' +
              'them as such would withhold the whole product to improve its footnotes.'
            : 'At least one check says the product does not work as configured. Open and accepted ' +
              'items are not the problem; the blocking ones below are.'}
        </p>
      </div>

      {blockers.length > 0 && (
        <>
          <h2>Blocking</h2>
          {blockers.map((c) => (
            <div className="panel" key={c.id}>
              <h3 style={{ marginTop: 0 }}>{c.id}</h3>
              <p>
                <strong>Required:</strong> {c.what}
              </p>
              <p>
                <strong>Actual:</strong> {c.detail}
              </p>
              <p>
                <strong>Fix:</strong> {c.fix}
              </p>
            </div>
          ))}
        </>
      )}

      <h2>All checks</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Check</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {report.checks.map((c) => (
            <tr key={c.id}>
              <td>
                <span className={badge[c.status].className}>{badge[c.status].label}</span>
              </td>
              <td>
                <code>{c.id}</code>
                <br />
                <small className="muted">{c.what}</small>
              </td>
              <td>
                <small>{c.detail}</small>
                {c.fix && (
                  <>
                    <br />
                    <small className="muted">
                      <strong>Fix:</strong> {c.fix}
                    </small>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
