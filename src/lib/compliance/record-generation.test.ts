import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUDIT_BLOCKED_MESSAGE, recordGeneration } from './record-generation';
import { AUDIT_PATH_ENV, resolveAuditStore } from './audit-store-config';
import { unclassifiedState } from '@/lib/gating/state-tier-config';
import { analyzeEasement } from '@/lib/analysis-layer';

let dir: string;
let original: string | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'auditcfg-'));
  original = process.env[AUDIT_PATH_ENV];
});

afterEach(async () => {
  if (original === undefined) delete process.env[AUDIT_PATH_ENV];
  else process.env[AUDIT_PATH_ENV] = original;
  await rm(dir, { recursive: true, force: true });
});

describe('configured and durable are different facts', () => {
  it('reports configured when the path was set explicitly', () => {
    const cfg = resolveAuditStore({ [AUDIT_PATH_ENV]: join(dir, 'x.jsonl') });
    expect(cfg.configured).toBe(true);
    expect(cfg.warning).toBeNull();
    expect(cfg.store.durable).toBe(true);
  });

  it('still returns a DURABLE store when unconfigured, and warns anyway', () => {
    // The trap this separation exists for: a file store is durable in the
    // sense the guard checks — a written record survives a restart — while the
    // filesystem underneath it may be ephemeral. Durability alone would report
    // everything fine on a serverless host that loses every record.
    const cfg = resolveAuditStore({});
    expect(cfg.store.durable).toBe(true);
    expect(cfg.configured).toBe(false);
    expect(cfg.warning).not.toBeNull();
  });

  it('names the serverless failure mode specifically', () => {
    const cfg = resolveAuditStore({});
    expect(cfg.warning).toMatch(/serverless/);
    expect(cfg.warning).toMatch(/silently and\s+without error/);
    expect(cfg.warning).toMatch(new RegExp(AUDIT_PATH_ENV));
  });

  it('treats an empty string as unset rather than as a path', () => {
    expect(resolveAuditStore({ [AUDIT_PATH_ENV]: '   ' }).configured).toBe(false);
  });
});

describe('a generated artefact leaves a trail', () => {
  it('writes the record and reports the warning through', async () => {
    process.env[AUDIT_PATH_ENV] = join(dir, 'sends.jsonl');
    const result = await recordGeneration({
      letterType: 'maintenance-request',
      stateCompliance: unclassifiedState('CA'),
      now: new Date('2026-08-22T00:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warning).toBeNull();
    const written = await readFile(join(dir, 'sends.jsonl'), 'utf8');
    expect(JSON.parse(written.trim()).letterType).toBe('maintenance-request');
  });

  it('carries the analysis basis, including what the rule claimed', async () => {
    // The field that makes partial operation in an unreviewed state
    // answerable months later.
    process.env[AUDIT_PATH_ENV] = join(dir, 'sends.jsonl');
    const analysis = analyzeEasement({
      state: 'CA',
      duration: {
        easementType: 'appurtenant',
        hasPerpetualLanguage: true,
        hasTermOrConditionSubsequent: false,
        documentLegible: true,
      },
    });
    const result = await recordGeneration({
      letterType: 'maintenance-request',
      stateCompliance: unclassifiedState('CA'),
      ruleSet: analysis.ruleSet,
      firedRule: analysis.firedRule ?? undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.analysis!.ruleId).toBe('ca-express-perpetual');
    expect(result.record.analysis!.ruleClaimType).toBe('observation');
    expect(result.record.analysis!.ruleSetStatus).toBe('unavailable');
  });

  it('records the rule that fired without a lookup that could drift', () => {
    // analyzeEasement returns firedRule directly rather than the caller
    // resolving a claim type by id afterwards — the audit trail needs the rule
    // that RAN and its claim to be the same fact.
    const analysis = analyzeEasement({
      state: 'CA',
      duration: {
        easementType: 'appurtenant',
        hasPerpetualLanguage: false,
        hasTermOrConditionSubsequent: true,
        documentLegible: true,
      },
    });
    expect(analysis.firedRule).toEqual({
      id: 'ca-express-term-limited',
      claimType: 'observation',
    });
  });

  it('reports no fired rule when nothing ran', () => {
    const analysis = analyzeEasement({
      state: 'TX',
      duration: {
        easementType: 'appurtenant',
        hasPerpetualLanguage: true,
        hasTermOrConditionSubsequent: false,
        documentLegible: true,
      },
    });
    expect(analysis.firedRule).toBeNull();
  });
});

describe('failure is returned, not thrown', () => {
  it('never throws out of recordGeneration', async () => {
    // A page that cannot write an audit record must not hand the user a letter
    // as though nothing happened, and must not show them a stack trace either.
    process.env[AUDIT_PATH_ENV] = join(dir, 'sends.jsonl');
    await expect(
      recordGeneration({
        letterType: 'referral-package',
        stateCompliance: unclassifiedState('CA'),
      }),
    ).resolves.toBeDefined();
  });

  it('the blocked message blames us and says nothing was charged', () => {
    // The reader did nothing wrong, the fault is ours, and the sentence says
    // so without pretending the artefact is coming.
    expect(AUDIT_BLOCKED_MESSAGE).toMatch(/not generated/);
    expect(AUDIT_BLOCKED_MESSAGE).toMatch(/fault on our side/);
    expect(AUDIT_BLOCKED_MESSAGE).toMatch(/Nothing was charged and nothing was sent/);
    // And it does not tell a homeowner about our storage configuration.
    expect(AUDIT_BLOCKED_MESSAGE).not.toMatch(/serverless|AUDIT_LOG_PATH|store/i);
  });
});

describe('the send flows record before they render', () => {
  it('advocacy withholds the letter when the record cannot be written', () => {
    // Asserted on source: the page is an async server component. What matters
    // is the ORDER — an artefact that exists without a trail is the case the
    // control is for, so rendering first and logging after would leave exactly
    // that gap on any failure.
    const src = readFileSync(new URL('../../app/advocacy/page.tsx', import.meta.url), 'utf8');
    const auditAt = src.indexOf('await recordGeneration');
    const renderAt = src.indexOf('buildMaintenanceRequestLetter({');
    expect(auditAt).toBeGreaterThan(-1);
    expect(renderAt).toBeGreaterThan(-1);
    expect(auditAt).toBeLessThan(renderAt);
    expect(src).toContain('AUDIT_BLOCKED_MESSAGE');
  });

  it('audits the free clarification letter too', () => {
    // The reason to record is not that money changed hands.
    const src = readFileSync(new URL('../../app/advocacy/page.tsx', import.meta.url), 'utf8');
    expect(src).toContain("letterType: 'request-for-clarification'");
  });
});
