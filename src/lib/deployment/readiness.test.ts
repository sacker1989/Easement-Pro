import { describe, expect, it } from 'vitest';
import { COMMERCE_ENABLED } from '@/lib/compliance/commerce-mode';
import { AUDIT_PATH_ENV } from '@/lib/compliance/audit-store-config';
import { assessDeploymentReadiness, blockingChecks, gapsForState } from './readiness';

const DEV = { NODE_ENV: 'development' } as const;
const PROD = { NODE_ENV: 'production' } as const;
const PROD_CONFIGURED = { NODE_ENV: 'production', [AUDIT_PATH_ENV]: '/var/lib/app/sends.jsonl' };

describe('assessDeploymentReadiness — California', () => {
  it('can deploy in development with nothing configured', () => {
    const r = assessDeploymentReadiness('CA', DEV);
    expect(r.canDeploy).toBe(true);
    expect(blockingChecks(r)).toHaveLength(0);
  });

  it('CANNOT deploy to production without an audit path, and that is the only blocker', () => {
    // THE ANSWER THIS MODULE EXISTS TO GIVE. Every other open question in this
    // product ships — unreviewed rule sets degrade, uncited bands carry their
    // arithmetic, placeholder disclaimer copy still says the true thing. One
    // config line stops the product working at all, and it is not a legal
    // question.
    const r = assessDeploymentReadiness('CA', PROD);
    expect(r.canDeploy).toBe(false);
    expect(blockingChecks(r).map((c) => c.id)).toEqual(['audit-store-configured']);
  });

  it('can deploy to production once the audit path is set', () => {
    const r = assessDeploymentReadiness('CA', PROD_CONFIGURED);
    expect(r.canDeploy).toBe(true);
    expect(blockingChecks(r)).toHaveLength(0);
  });

  it('names the fix for the blocker rather than only the problem', () => {
    const blocker = blockingChecks(assessDeploymentReadiness('CA', PROD))[0]!;
    expect(blocker.fix).toContain(AUDIT_PATH_ENV);
    // Serverless is the case where setting the variable is NOT enough, and a
    // fix line that omitted it would send someone to a silent data loss.
    expect(blocker.fix).toMatch(/serverless/i);
    expect(blocker.detail).toMatch(/no letters|refuse/i);
  });

  it('does not let an open legal question masquerade as a blocker', () => {
    const r = assessDeploymentReadiness('CA', PROD_CONFIGURED);
    const unreviewed = r.checks.find((c) => c.id === 'gap-CA-TRACK1-UNREVIEWED')!;
    expect(unreviewed.status).toBe('open');
    expect(r.canDeploy).toBe(true);
  });

  it('reports the analysis layer as open, not met, while CA is unreviewed', () => {
    const check = assessDeploymentReadiness('CA', DEV).checks.find(
      (c) => c.id === 'analysis-rule-set',
    )!;
    expect(check.status).toBe('open');
    // The detail has to say the useful half: observations still run.
    expect(check.detail).toMatch(/observation/i);
  });

  it('reports free mode as met and says why that matters', () => {
    const check = assessDeploymentReadiness('CA', DEV).checks.find(
      (c) => c.id === 'commerce-mode-coherent',
    )!;
    expect(check.status).toBe(COMMERCE_ENABLED ? 'open' : 'met');
    expect(check.status).toBe('met');
  });

  it('shows the LA recorder data as met now that it was verified', () => {
    // Closed 2026-10-05 against lavote.gov. Before that it was open, and the
    // verification found three wrong figures — so this moving to 'met' is a
    // real change in the world rather than a reclassification.
    const check = assessDeploymentReadiness('CA', DEV).checks.find(
      (c) => c.id === 'gap-LA-FALLBACK-UNVERIFIED',
    )!;
    expect(check.status).toBe('met');
    expect(check.detail).toMatch(/Closed 2026-10-05/);
    // A closed gap that cannot come back is a lie about perishable data.
    expect(check.detail).toMatch(/Reopens/);
  });
});

describe('assessDeploymentReadiness — a state that is not California', () => {
  it('reports Track 1 as open rather than blocking, since Tracks 2 and 3 work', () => {
    const r = assessDeploymentReadiness('TX', PROD_CONFIGURED);
    const track1 = r.checks.find((c) => c.id === 'track1-available')!;
    expect(track1.status).toBe('open');
    // Deploying to a state with no Track 1 is a normal condition, not a fault.
    expect(r.canDeploy).toBe(true);
  });

  it('carries only the gaps that apply there', () => {
    const txIds = gapsForState('TX').map((g) => g.id);
    const caIds = gapsForState('CA').map((g) => g.id);
    expect(txIds).toContain('SCREENING-BANDS-UNCITED');
    expect(txIds).not.toContain('CA-TRACK1-UNREVIEWED');
    expect(caIds).toContain('CA-TRACK1-UNREVIEWED');
    expect(caIds.length).toBeGreaterThan(txIds.length);
  });

  it('shows Florida with a registered-but-unreviewed rule set', () => {
    const check = assessDeploymentReadiness('FL', DEV).checks.find(
      (c) => c.id === 'analysis-rule-set',
    )!;
    expect(check.status).toBe('open');
    // Distinct from TX, which has no entry at all. The two gate the same and
    // are different facts.
    expect(check.detail).toMatch(/Registered but/);
    expect(
      assessDeploymentReadiness('TX', DEV).checks.find((c) => c.id === 'analysis-rule-set')!.detail,
    ).toMatch(/No rule set registered/);
  });
});

describe('the shape of the report', () => {
  it('gives every check an id, a requirement and a status', () => {
    for (const state of ['CA', 'FL', 'TX']) {
      for (const c of assessDeploymentReadiness(state, DEV).checks) {
        expect(c.id).toMatch(/^[a-z0-9-]+$/i);
        expect(c.what.length).toBeGreaterThan(10);
        expect(['met', 'blocking', 'accepted', 'open']).toContain(c.status);
        // A met check has nothing to do; everything else names an action.
        if (c.status === 'met') expect(c.fix).toBeNull();
        else expect(c.fix).not.toBeNull();
      }
    }
  });

  it('gives each check a unique id within a report', () => {
    const ids = assessDeploymentReadiness('CA', DEV).checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
