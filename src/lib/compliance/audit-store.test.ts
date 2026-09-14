import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AuditStoreError,
  createFileAuditStore,
  createInMemoryAuditStore,
  recordSend,
  type AuditStore,
} from './audit-store';
import { buildSendAuditRecord, type SendAuditRecord } from './audit-record';
import { unclassifiedState } from '@/lib/gating/state-tier-config';
import { resolveStateRuleSet } from '@/lib/analysis-layer/registry';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'audit-'));
  file = join(dir, 'nested', 'audit.jsonl');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function rec(over: Partial<SendAuditRecord> = {}): SendAuditRecord {
  return {
    ...buildSendAuditRecord({
      letterType: 'maintenance-request',
      stateCompliance: unclassifiedState('CA'),
      now: new Date('2026-08-22T00:00:00.000Z'),
    }),
    ...over,
  };
}

describe('the guard refuses a store that would forget', () => {
  it('throws for an in-memory store', async () => {
    // An audit record that does not survive a restart is the absence of an
    // audit trail wearing the name.
    const store = createInMemoryAuditStore();
    await expect(recordSend(store, rec())).rejects.toThrow(AuditStoreError);
    await expect(recordSend(store, rec())).rejects.toThrow(/Configure a durable store/);
  });

  it('accepts a file store', async () => {
    const store = createFileAuditStore(file);
    await expect(recordSend(store, rec())).resolves.toBeUndefined();
    expect(await store.count()).toBe(1);
  });

  it('has no escape hatch', () => {
    // Same reason resolveStateRuleSet has no allowUnreviewed: an escape hatch
    // on a control is how the control stops applying.
    expect(recordSend.length).toBe(2);
    const src = String(recordSend);
    expect(src).not.toMatch(/allowNonDurable|force|skipDurability/i);
  });
});

describe('the file store survives a restart', () => {
  it('reads back records written by a previous instance', async () => {
    // The whole point. A second store object over the same path is the closest
    // in-process analogue of a process restart.
    const first = createFileAuditStore(file);
    await recordSend(first, rec({ state: 'CA' }));
    await recordSend(first, rec({ state: 'FL' }));

    const second = createFileAuditStore(file);
    expect(await second.count()).toBe(2);
    expect((await second.findByState('ca')).map((r) => r.state)).toEqual(['CA']);
  });

  it('creates the directory rather than failing on a missing path', async () => {
    const store = createFileAuditStore(file);
    await recordSend(store, rec());
    expect((await readFile(file, 'utf8')).trim().split('\n')).toHaveLength(1);
  });

  it('returns empty for a file that does not exist yet', async () => {
    expect(await createFileAuditStore(join(dir, 'absent.jsonl')).all()).toEqual([]);
  });
});

describe('append-only, and a corrupt line costs one record', () => {
  it('exposes no update or delete', () => {
    // An audit record states what was true at a moment. Correcting one means
    // appending a later record, not editing the earlier one.
    const store: AuditStore = createInMemoryAuditStore();
    expect(Object.keys(store).sort()).toEqual([
      'all',
      'append',
      'count',
      'durable',
      'findByState',
      'kind',
    ]);
  });

  it('skips a malformed line instead of failing the whole read', async () => {
    // One corrupt entry must not make the other ten thousand unreadable — that
    // turns a small loss into the total loss this store exists to prevent.
    const store = createFileAuditStore(file);
    await recordSend(store, rec({ state: 'CA' }));
    await writeFile(file, `${await readFile(file, 'utf8')}{ this is not json\n`, 'utf8');
    await recordSend(store, rec({ state: 'FL' }));

    const all = await store.all();
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.state).sort()).toEqual(['CA', 'FL']);
  });

  it('uses one line per record, so a crash mid-write costs one entry', async () => {
    const store = createFileAuditStore(file);
    await recordSend(store, rec());
    await recordSend(store, rec());
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
  });
});

describe('the analysis half of the trail', () => {
  it('records the rule-set gate, not just the UPL tier', () => {
    // The record previously captured only which tier permitted the letter, and
    // nothing about whether the substantive analysis rested on a reviewed rule
    // set. Those are separate gates with separate reviewers.
    const r = buildSendAuditRecord({
      letterType: 'maintenance-request',
      stateCompliance: unclassifiedState('CA'),
      ruleSet: resolveStateRuleSet('CA'),
      firedRule: { id: 'ca-express-perpetual', claimType: 'observation' },
    });
    expect(r.analysis).not.toBeNull();
    expect(r.analysis!.ruleSetStatus).toBe('unavailable');
    expect(r.analysis!.unavailableReason).toBe('never-reviewed');
    expect(r.analysis!.ruleId).toBe('ca-express-perpetual');
  });

  it('records WHAT the rule claimed, which is what makes partial operation defensible', () => {
    // "CA, unreviewed, and we still answered" is only defensible if the trail
    // shows the answer came from reading the instrument rather than from
    // doctrine. Without this field the two are indistinguishable later.
    const r = buildSendAuditRecord({
      letterType: 'referral-package',
      stateCompliance: unclassifiedState('CA'),
      ruleSet: resolveStateRuleSet('CA'),
      firedRule: { id: 'ca-express-perpetual', claimType: 'observation' },
    });
    expect(r.analysis!.ruleClaimType).toBe('observation');
  });

  it('is null where no substantive analysis was involved', () => {
    const r = buildSendAuditRecord({
      letterType: 'records-request',
      stateCompliance: unclassifiedState('FL'),
    });
    expect(r.analysis).toBeNull();
  });

  it('still carries the disclaimer version active at generation time', () => {
    // A disclaimer rewrite must not change what an old record says governed.
    expect(rec().disclaimerVersion).toBe('placeholder-v2');
  });
});

describe('a stored record round-trips intact', () => {
  it('preserves the analysis block through JSONL', async () => {
    const store = createFileAuditStore(file);
    const original = buildSendAuditRecord({
      letterType: 'maintenance-request',
      stateCompliance: unclassifiedState('CA'),
      ruleSet: resolveStateRuleSet('CA'),
      firedRule: { id: 'ca-illegible-document', claimType: 'observation' },
      now: new Date('2026-08-22T12:00:00.000Z'),
    });
    await recordSend(store, original);
    const [readBack] = await store.all();
    expect(readBack).toEqual(original);
  });
});
