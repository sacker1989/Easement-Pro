/**
 * Where audit records go, and the guard that stops them going nowhere.
 *
 * THE PROBLEM THIS SOLVES. `SendAuditRecord` has been a typed shape with no
 * store since Phase 1 — its own header said so. That means the record whose
 * entire purpose is remaining answerable about a letter sent last March did not
 * survive a page refresh. An audit trail that forgets is not a weaker audit
 * trail; it is the absence of one wearing the name.
 *
 * WHY A PORT RATHER THAN A DATABASE. Which store is right depends on where
 * this deploys, and that is not an engineering detail: a serverless host has an
 * ephemeral filesystem, so a file store silently loses records there while
 * working perfectly in development — the worst possible failure for this
 * particular record. That decision belongs to whoever picks the deployment
 * target. The port is shaped so a Prisma or Postgres adapter drops in without
 * touching a caller, which is what the original header anticipated.
 *
 * THE GUARD IS THE POINT. `recordSend` refuses a non-durable store. Without
 * that, the in-memory adapter is indistinguishable from a real one right up
 * until someone needs a record and finds it was never kept — and it would be
 * the default, because defaults are what ship. Failing loudly in production and
 * working quietly in tests is the correct asymmetry here.
 *
 * APPEND-ONLY, DELIBERATELY. There is no update and no delete on this
 * interface. An audit record is a statement about what was true at a moment;
 * correcting one means appending a later record, not editing the earlier one.
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SendAuditRecord } from './audit-record';

export class AuditStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditStoreError';
  }
}

export interface AuditStore {
  /** What backs this store. Named so a diagnostics surface can report it. */
  readonly kind: 'memory' | 'file';
  /**
   * Whether a record written here survives process restart.
   *
   * Not a capability flag to branch on for features — the only thing that may
   * read it is the guard below.
   */
  readonly durable: boolean;
  append(record: SendAuditRecord): Promise<void>;
  all(): Promise<readonly SendAuditRecord[]>;
  findByState(state: string): Promise<readonly SendAuditRecord[]>;
  count(): Promise<number>;
}

/**
 * For tests and local development. NOT durable, and says so.
 *
 * It exists because the alternative — making tests write files — is worse, not
 * because in-memory is an acceptable production posture. `recordSend` refuses
 * it.
 */
export function createInMemoryAuditStore(): AuditStore {
  const records: SendAuditRecord[] = [];
  return {
    kind: 'memory',
    durable: false,
    async append(record) {
      records.push(record);
    },
    async all() {
      return [...records];
    },
    async findByState(state) {
      const s = state.trim().toUpperCase();
      return records.filter((r) => r.state.toUpperCase() === s);
    },
    async count() {
      return records.length;
    },
  };
}

/**
 * Append-only JSONL on disk.
 *
 * JSONL rather than a JSON array for a specific reason: appending a line
 * cannot corrupt the lines already written, whereas rewriting an array means
 * every write risks the whole file. For a record that must survive, a format
 * where a crash mid-write costs one entry rather than all of them is worth the
 * loss of prettiness.
 *
 * A malformed line is SKIPPED on read rather than throwing. One corrupt entry
 * must not make the other ten thousand unreadable — that would turn a small
 * loss into the total loss this store exists to prevent.
 */
export function createFileAuditStore(filePath: string): AuditStore {
  async function readAll(): Promise<SendAuditRecord[]> {
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch {
      return [];
    }
    const out: SendAuditRecord[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      try {
        out.push(JSON.parse(trimmed) as SendAuditRecord);
      } catch {
        // Skipped on purpose. See the header.
      }
    }
    return out;
  }

  return {
    kind: 'file',
    durable: true,
    async append(record) {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
    },
    async all() {
      return readAll();
    },
    async findByState(state) {
      const s = state.trim().toUpperCase();
      return (await readAll()).filter((r) => r.state.toUpperCase() === s);
    },
    async count() {
      return (await readAll()).length;
    },
  };
}

/**
 * Records a real send. Refuses a store that would forget it.
 *
 * There is no `allowNonDurable` parameter, for the same reason
 * `resolveStateRuleSet` has no `allowUnreviewed` one: an escape hatch on a
 * control is how the control stops applying.
 */
export async function recordSend(store: AuditStore, record: SendAuditRecord): Promise<void> {
  if (!store.durable) {
    throw new AuditStoreError(
      `Refusing to record a send against a non-durable ${store.kind} store. This record exists to ` +
        'remain answerable about what governed an artefact months after it went out, and an ' +
        'in-memory store cannot do that — it would report success and lose the record at the next ' +
        'restart, which is worse than failing here. Configure a durable store before sending.',
    );
  }
  await store.append(record);
}
