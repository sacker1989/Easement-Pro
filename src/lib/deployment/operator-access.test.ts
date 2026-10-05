import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assessDeploymentReadiness, blockingChecks } from './readiness';
import {
  OPERATOR_PAGES_CLOSED_NOTE,
  OPERATOR_PAGES_ENV,
  operatorPagesEnabled,
} from './operator-access';

const DEV = { NODE_ENV: 'development' } as const;
const PROD = { NODE_ENV: 'production' } as const;
const PROD_OPEN = { NODE_ENV: 'production', [OPERATOR_PAGES_ENV]: '1' };

describe('operatorPagesEnabled', () => {
  it('is closed in production by default', () => {
    // THE ASSERTION THAT MATTERS. The variable must be set to OPEN the page.
    // A gate that must be remembered in order to protect something is a gate
    // that gets forgotten on the one host where forgetting costs anything.
    expect(operatorPagesEnabled(PROD)).toBe(false);
  });

  it('is open in development without any configuration', () => {
    // A local server is already the operator's own machine. Making them set a
    // variable to see their own readiness teaches them to set it everywhere.
    expect(operatorPagesEnabled(DEV)).toBe(true);
    expect(operatorPagesEnabled({})).toBe(true);
  });

  it('opens in production only on an exact "1"', () => {
    expect(operatorPagesEnabled(PROD_OPEN)).toBe(true);
    for (const value of ['true', 'yes', '0', '', 'TRUE']) {
      expect(
        operatorPagesEnabled({ NODE_ENV: 'production', [OPERATOR_PAGES_ENV]: value }),
        `"${value}" should not open the gate`,
      ).toBe(false);
    }
  });
});

describe('the readiness check for it', () => {
  it('is met when closed in production', () => {
    const check = assessDeploymentReadiness('CA', PROD).checks.find(
      (c) => c.id === 'operator-pages-closed',
    )!;
    expect(check.status).toBe('met');
  });

  it('BLOCKS a deploy when open in production', () => {
    // The one case where blocking is the right word: nothing is broken,
    // everything works, and what works is publishing the gap registry.
    const report = assessDeploymentReadiness('CA', PROD_OPEN);
    expect(report.canDeploy).toBe(false);
    expect(blockingChecks(report).map((c) => c.id)).toEqual(['operator-pages-closed']);
  });

  it('names what would actually be published, not just that something would be', () => {
    const check = blockingChecks(assessDeploymentReadiness('CA', PROD_OPEN))[0]!;
    expect(check.detail).toMatch(/filesystem paths/i);
    expect(check.detail).toMatch(/compliance gap/i);
    // The item that would hurt most, named explicitly so nobody has to infer it.
    expect(check.detail).toMatch(/without a counsel opinion/i);
    expect(check.fix).toContain(OPERATOR_PAGES_ENV);
  });

  it('does not block in development, where the page is meant to be open', () => {
    expect(blockingChecks(assessDeploymentReadiness('CA', DEV))).toHaveLength(0);
  });
});

describe('the page actually consults the gate', () => {
  const PAGE = readFileSync(new URL('../../app/readiness/page.tsx', import.meta.url), 'utf8');

  it('calls operatorPagesEnabled and 404s', () => {
    // Source-text, because this is an async server component. The weaker
    // technique, and the one that runs in CI.
    expect(PAGE).toContain('operatorPagesEnabled()');
    expect(PAGE).toContain('notFound()');
  });

  it('404s rather than explaining itself', () => {
    // An explanatory page would confirm that an operator surface exists here
    // and is merely switched off, which is most of what a prober wanted.
    expect(PAGE).not.toContain(OPERATOR_PAGES_CLOSED_NOTE);
  });
});
