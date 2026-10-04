/**
 * Which audit store this deployment uses, and whether anyone chose it.
 *
 * THE DISTINCTION THAT MATTERS HERE IS CONFIGURED VERSUS DURABLE, and they are
 * not the same thing. A file store is durable in the sense the guard cares
 * about — a written record survives a process restart — but on a serverless
 * host the filesystem itself is ephemeral, so the same adapter that is correct
 * on a VM silently loses everything on Vercel or Lambda. No code can tell which
 * it is running on reliably, and guessing would produce exactly the false
 * confidence this record exists to prevent.
 *
 * So the resolver reports BOTH facts and refuses to conflate them. An explicit
 * `AUDIT_LOG_PATH` means someone made a decision about where records live. A
 * defaulted path means the app works locally and nobody has decided yet, which
 * is fine in development and is not fine in production — and the difference is
 * surfaced rather than inferred.
 */

import { join } from 'node:path';
import { createFileAuditStore, type AuditStore } from './audit-store';

export const AUDIT_PATH_ENV = 'AUDIT_LOG_PATH';

/** Local fallback. Deliberately inside the project, not a system temp dir. */
const DEFAULT_RELATIVE_PATH = join('.audit', 'sends.jsonl');

export interface AuditStoreConfig {
  readonly store: AuditStore;
  /** True when AUDIT_LOG_PATH was set explicitly. */
  readonly configured: boolean;
  readonly path: string;
  /**
   * Shown to an operator, not to a homeowner. Null when explicitly configured.
   *
   * A temp directory is called out separately because it is the one default
   * that looks like it works and is routinely cleared underneath you.
   */
  readonly warning: string | null;
}

/** Takes only what it reads, so a test need not fabricate a whole ProcessEnv. */
export function resolveAuditStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AuditStoreConfig {
  const explicit = env[AUDIT_PATH_ENV]?.trim();

  if (explicit !== undefined && explicit !== '') {
    return {
      store: createFileAuditStore(explicit),
      configured: true,
      path: explicit,
      warning: null,
    };
  }

  const path = join(process.cwd(), DEFAULT_RELATIVE_PATH);
  const fileStore = createFileAuditStore(path);

  // IN PRODUCTION, UNCONFIGURED IS A REFUSAL RATHER THAN A WARNING.
  //
  // A warning is operator-facing and gets shipped past; that is what warnings
  // are for and it is why this cannot rely on one. Marking the store
  // non-durable reuses the guard that already exists — `recordSend` refuses it,
  // `recordGeneration` returns not-ok, and every send flow already withholds
  // its artefact and shows the blocked message. No new error path, and the
  // asymmetry is the right way round: development works, production stops.
  //
  // The file store itself is unchanged and still writes. What is being refused
  // is the CLAIM that an unconfigured production deployment has somewhere
  // durable to put these, which on a serverless host it does not.
  const productionUnconfigured = env.NODE_ENV === 'production';

  return {
    store: productionUnconfigured ? { ...fileStore, durable: false } : fileStore,
    configured: false,
    path,
    warning:
      `${AUDIT_PATH_ENV} is not set, so audit records are being written to ${path}. That works in ` +
      'development. It is NOT a production configuration: on a serverless host the filesystem is ' +
      'ephemeral and every record written there is lost at the next cold start, silently and ' +
      'without error. Set ' +
      `${AUDIT_PATH_ENV} to durable storage, or replace the adapter with a database-backed one, ` +
      'before sending anything real.',
  };
}
