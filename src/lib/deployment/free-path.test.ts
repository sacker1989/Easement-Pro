import { describe, expect, it } from 'vitest';
import { assessDeploymentReadiness, blockingChecks } from './readiness';
import { FREE_SURFACES, surfaceReadiness } from './surfaces';

const PROD_UNCONFIGURED = { NODE_ENV: 'production' } as const;
const PROD_CONFIGURED = { NODE_ENV: 'production', AUDIT_LOG_PATH: '/var/lib/app/sends.jsonl' };

/**
 * THE QUESTION THIS FILE ANSWERS: can the free product ship before anybody
 * configures durable storage?
 *
 * It matters because the previous readiness check said no, flatly, and that
 * was wrong in a way that would have delayed a deployable product. The audit
 * store gates ARTEFACTS — letters, referral packages, records requests —
 * because those go to third parties and the trail has to say what governed
 * them. It does not gate the analysis, which is a page the homeowner reads.
 *
 * A reader of the old check would have concluded the whole product was dead
 * without an env var. In fact the surface the free tier is built around works
 * perfectly, and only the artefact surfaces degrade.
 */
describe('the free analysis does not depend on the audit store', () => {
  it('is reported as working in production with nothing configured', () => {
    const report = surfaceReadiness('CA', PROD_UNCONFIGURED);
    const analysis = report.find((s) => s.id === 'report')!;
    expect(analysis.works).toBe(true);
  });

  it('degrades only the surfaces that produce artefacts', () => {
    const report = surfaceReadiness('CA', PROD_UNCONFIGURED);
    const broken = report.filter((s) => !s.works).map((s) => s.id).sort();
    // Letters and the handoff package go to a utility, an agency or a
    // professional. The analysis page does not leave the browser.
    expect(broken).toEqual(['advocacy', 'inquiry']);
  });

  it('works everywhere once the audit path is set', () => {
    expect(surfaceReadiness('CA', PROD_CONFIGURED).every((s) => s.works)).toBe(true);
  });

  it('names every free surface as free', () => {
    for (const s of FREE_SURFACES) {
      expect(s.costsTheUser).toBe(false);
    }
  });
});

describe('readiness reports the distinction rather than one flat verdict', () => {
  it('no longer claims the whole product fails', () => {
    // THE CORRECTION. The old detail said "the product generates no letters
    // for anyone" and was classified blocking, which reads as "do not deploy".
    // For a free tier whose core surface is the analysis page, that was the
    // wrong call and would have withheld a working product.
    const check = assessDeploymentReadiness('CA', PROD_UNCONFIGURED).checks.find(
      (c) => c.id === 'audit-store-configured',
    )!;
    expect(check.detail).toMatch(/analysis|report/i);
    expect(check.status).not.toBe('blocking');
  });

  it('reports the free tier as deployable unconfigured', () => {
    const report = assessDeploymentReadiness('CA', PROD_UNCONFIGURED);
    expect(blockingChecks(report)).toHaveLength(0);
    expect(report.canDeploy).toBe(true);
  });

  it('still says plainly that letters will not generate', () => {
    // Deployable is not the same as fully working, and the check must not
    // become so relaxed that an operator misses what IS degraded.
    const check = assessDeploymentReadiness('CA', PROD_UNCONFIGURED).checks.find(
      (c) => c.id === 'audit-store-configured',
    )!;
    expect(check.status).toBe('open');
    expect(check.detail).toMatch(/letter/i);
    expect(check.fix).toMatch(/AUDIT_LOG_PATH/);
  });
});
