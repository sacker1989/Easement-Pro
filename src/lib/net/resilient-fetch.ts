/**
 * A `fetch`-compatible wrapper carrying the retry, backoff, caching and load
 * control that county GIS services actually require.
 *
 * WHY THIS SHAPE. All three assessor providers already accept an injectable
 * `fetchImpl?: typeof fetch`. Matching the `fetch` signature means this drops
 * into LA, Orange and San Diego without touching a line of their parsing
 * logic, which is tested and correct. A bespoke client would have meant
 * rewriting three working modules to gain the same behaviour.
 *
 * WHY IT IS NEEDED, CONCRETELY. `county-database.ts` records the finding
 * against Orange County verbatim: "The whole ocgis.com server returned HTTP
 * 503 under modest query load, so production use needs caching, backoff and a
 * degraded path." That is a measurement from this project, not a general
 * precaution — a single page render can fan out into several queries, and the
 * naive path takes the county down for the user.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not interpret Esri payloads. Esri
 * returns HTTP 200 with an `{error:{code,message}}` body on failure, and all
 * three providers already detect that. Retrying it here would be wrong anyway:
 * an Esri error body usually means a malformed query, which will fail
 * identically forever.
 *
 * SERVER ONLY. County services do not send CORS headers, so a browser request
 * fails regardless. The guard throws rather than letting a client component
 * fail confusingly at runtime — Next.js server components already run
 * Node-side, which is where every caller lives.
 */

export class ResilientFetchError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastStatus: number | null,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ResilientFetchError';
  }
}

/**
 * Statuses worth a second attempt.
 *
 * 4xx is absent on purpose apart from 429: a malformed query, a bad layer id
 * or an unauthorised service will fail the same way every time, and retrying
 * turns one useless request into several.
 */
export const RETRYABLE_STATUSES: readonly number[] = [429, 500, 502, 503, 504];

export interface ResilientFetchOptions {
  /** Attempts in total, not retries after the first. */
  readonly maxAttempts?: number;
  /** Per-attempt timeout. */
  readonly timeoutMs?: number;
  /**
   * Ceiling across ALL attempts including backoff. A per-attempt timeout alone
   * lets three 10s attempts plus backoff block a page render for half a
   * minute; a request nobody is waiting for any more should stop.
   */
  readonly totalBudgetMs?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /** Successful GET responses are reused for this long. 0 disables. */
  readonly cacheTtlMs?: number;
  /** Simultaneous in-flight requests per host. */
  readonly maxConcurrentPerHost?: number;
  readonly fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to real elapsed time. */
  readonly now?: () => number;
  /** Injectable for tests; defaults to a real timer. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests. Defaults to Math.random, used for jitter. */
  readonly random?: () => number;
}

interface CacheEntry {
  readonly expiresAt: number;
  readonly body: string;
  readonly status: number;
  readonly headers: [string, string][];
}

const DEFAULTS = {
  maxAttempts: 3,
  timeoutMs: 10_000,
  totalBudgetMs: 25_000,
  baseDelayMs: 300,
  maxDelayMs: 4_000,
  cacheTtlMs: 60_000,
  maxConcurrentPerHost: 4,
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown-host';
  }
}

/**
 * Parses Retry-After, which the spec allows as either seconds or an HTTP date.
 * An agency under load is the case this exists for, and honouring its stated
 * wait is both better behaved and more likely to succeed than guessing.
 */
export function parseRetryAfter(header: string | null, nowMs: number): number | null {
  if (header === null) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) return null;
  return Math.max(0, asDate - nowMs);
}

/**
 * Full jitter: a random point in [0, exponential], rather than the
 * exponential itself. Several parcels resolving at once would otherwise retry
 * in lockstep and reproduce the burst that caused the 503.
 */
export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(random() * exponential);
}

/**
 * Per-host gate. Module-scoped so every provider shares one budget per host.
 *
 * WITHIN ONE PROCESS, WHICH IS THE LIMIT OF WHAT THIS CAN PROMISE. On a single
 * server that is a real global cap. On a serverless host each instance has its
 * own module scope, so the cap is per instance: twenty warm Vercel instances
 * means up to twenty times `maxConcurrentPerHost` at the county, and no amount
 * of tuning this number changes that.
 *
 * REQUEST COALESCING IS THE PART THAT DOES CROSS-CUT IT, which is why that was
 * built rather than a smaller limit. Deduplicating identical in-flight requests
 * cuts origin traffic by whatever share of load is duplicate — and for a free
 * tool whose users cluster on the same hot ZIP codes, that share is most of it.
 * Fewer requests reduces the fan-out even though the per-instance ceiling is
 * unchanged.
 *
 * A TRUE GLOBAL LIMIT NEEDS SHARED STATE and is not pretended at here. The
 * honest options are a shared cache in front of the county calls (Vercel KV,
 * Redis, or Next's own Data Cache) or a distributed semaphore. Both are
 * infrastructure decisions rather than code ones, and docs/deploy-runbook.md
 * records when they start to matter.
 */
const inFlight = new Map<string, number>();
const waiters = new Map<string, (() => void)[]>();

async function acquire(host: string, limit: number): Promise<void> {
  const current = inFlight.get(host) ?? 0;
  if (current < limit) {
    inFlight.set(host, current + 1);
    return;
  }
  await new Promise<void>((resolve) => {
    const queue = waiters.get(host) ?? [];
    queue.push(resolve);
    waiters.set(host, queue);
  });
  inFlight.set(host, (inFlight.get(host) ?? 0) + 1);
}

function release(host: string): void {
  inFlight.set(host, Math.max(0, (inFlight.get(host) ?? 1) - 1));
  const queue = waiters.get(host);
  const next = queue?.shift();
  if (next) next();
}

/** Exposed so tests can start from a known state. */
export function resetResilientFetchState(): void {
  inFlight.clear();
  waiters.clear();
}

export interface ResilientFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  /** Cache statistics, for a diagnostics panel or a test. */
  readonly stats: () => { hits: number; misses: number; retries: number; coalesced: number };
  readonly clearCache: () => void;
}

export function createResilientFetch(options: ResilientFetchOptions = {}): ResilientFetch {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createResilientFetch is server-only. County GIS services send no CORS headers, so a ' +
        'browser request fails regardless of this wrapper. Call it from a server component, a ' +
        'route handler, or a server action.',
    );
  }

  const cfg = { ...DEFAULTS, ...options };
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = options.random ?? Math.random;

  const cache = new Map<string, CacheEntry>();
  /**
   * URLs with an origin request already running, and the result everyone
   * waiting on it will share.
   *
   * THE DEFECT THIS CLOSES. The cache was checked, then the request was made.
   * Two callers arriving before the first response landed both missed, both
   * passed the concurrency gate, and both hit the county — the cache can only
   * help the request AFTER one completes, and says nothing about the ones
   * already in the air.
   *
   * That is the common case rather than an edge one. A single report render
   * fans out several queries, and the whole point of a free tool is that many
   * people use it at once, frequently for the same hot ZIP codes. The limiter
   * bounded how many ran at a time; it never questioned whether they were the
   * same request.
   */
  const inFlightByUrl = new Map<string, Promise<CacheEntry>>();
  let hits = 0;
  let misses = 0;
  let retries = 0;
  let coalesced = 0;

  const responseFrom = (entry: CacheEntry): Response =>
    new Response(entry.body, { status: entry.status, headers: entry.headers });

  /**
   * One actual trip to the origin, with the concurrency gate and the retries.
   *
   * Split out so exactly one caller per URL runs it — see `wrapped`. It is
   * unchanged from when it was inline apart from taking its inputs as
   * parameters.
   */
  const originRequest = async (
    url: string,
    init: RequestInit | undefined,
    startedAt: number,
    cacheable: boolean,
  ): Promise<Response> => {
    const host = hostOf(url);
    await acquire(host, cfg.maxConcurrentPerHost);

    let lastStatus: number | null = null;
    let lastError: unknown = null;

    try {
      for (let attempt = 1; attempt <= cfg.maxAttempts; attempt += 1) {
        const elapsed = now() - startedAt;
        const remaining = cfg.totalBudgetMs - elapsed;
        if (remaining <= 0) {
          throw new ResilientFetchError(
            `Request budget of ${cfg.totalBudgetMs}ms exhausted after ${attempt - 1} attempt(s): ${url}`,
            attempt - 1,
            lastStatus,
            lastError,
          );
        }

        const controller = new AbortController();
        // The caller's own abort must win, and must NOT be retried — a
        // cancelled render is not a transient failure.
        const callerSignal = init?.signal ?? null;
        const onCallerAbort = () => controller.abort(callerSignal?.reason);
        callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
        const timer = setTimeout(() => controller.abort(), Math.min(cfg.timeoutMs, remaining));

        try {
          const response = await doFetch(url, { ...init, signal: controller.signal });
          lastStatus = response.status;

          if (response.ok) {
            if (!cacheable) return response;
            // Read the body ONCE and rebuild the Response, rather than
            // `response.clone().text()`.
            //
            // clone() tees the stream in undici, and a tee only drains if both
            // branches are consumed. Reading the clone to completion while the
            // original stays unread stalls once the buffered side exceeds the
            // internal high-water mark — which a multi-record parcel query
            // comfortably does. The stall then hit this wrapper's own timeout
            // and surfaced as an abort, so a healthy service that answered
            // curl in 0.2s looked unreachable. Live San Diego lookups failed
            // exactly this way; the unit suite could not see it because its
            // stub bodies were tiny.
            const body = await response.text();
            cache.set(url, {
              expiresAt: now() + cfg.cacheTtlMs,
              body,
              status: response.status,
              headers: [...response.headers.entries()],
            });
            return new Response(body, {
              status: response.status,
              headers: [...response.headers.entries()],
            });
          }

          if (!RETRYABLE_STATUSES.includes(response.status) || attempt === cfg.maxAttempts) {
            return response;
          }

          const retryAfter = parseRetryAfter(response.headers.get('retry-after'), now());
          const delay = retryAfter ?? backoffDelay(attempt, cfg.baseDelayMs, cfg.maxDelayMs, random);
          retries += 1;
          await sleep(Math.min(delay, Math.max(0, cfg.totalBudgetMs - (now() - startedAt))));
        } catch (err) {
          lastError = err;
          if (callerSignal?.aborted) {
            throw new ResilientFetchError('Request aborted by caller', attempt, lastStatus, err);
          }
          if (attempt === cfg.maxAttempts) {
            throw new ResilientFetchError(
              `Request failed after ${attempt} attempt(s): ${url}`,
              attempt,
              lastStatus,
              err,
            );
          }
          retries += 1;
          await sleep(backoffDelay(attempt, cfg.baseDelayMs, cfg.maxDelayMs, random));
        } finally {
          clearTimeout(timer);
          callerSignal?.removeEventListener('abort', onCallerAbort);
        }
      }

      throw new ResilientFetchError(
        `Request failed after ${cfg.maxAttempts} attempt(s): ${url}`,
        cfg.maxAttempts,
        lastStatus,
        lastError,
      );
    } finally {
      release(host);
    }
  };

  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const cacheable = cfg.cacheTtlMs > 0 && method === 'GET';
    const startedAt = now();

    if (!cacheable) return originRequest(url, init, startedAt, false);

    const entry = cache.get(url);
    if (entry !== undefined && entry.expiresAt > startedAt) {
      hits += 1;
      return responseFrom(entry);
    }
    if (entry !== undefined) cache.delete(url);
    misses += 1;

    const pending = inFlightByUrl.get(url);
    if (pending !== undefined) {
      coalesced += 1;
      /*
       * A FAILURE PROPAGATES TO EVERY WAITER, deliberately.
       *
       * The alternative is for each waiter to fall through and try the origin
       * itself, which turns one failed request into N against a service that
       * has just demonstrated it is struggling — the stampede this exists to
       * prevent, triggered by exactly the condition where it does most harm.
       * These callers asked for the same thing at the same moment; the honest
       * answer is the one answer that came back.
       */
      return responseFrom(await pending);
    }

    /*
     * MATERIALISED BEFORE IT IS SHARED. A Response body is a stream and can be
     * read once, so waiters cannot be handed the leader's Response — they get
     * their own, built from the bytes. This is also why the leader reads
     * `text()` rather than handing out `clone()`: see the undici tee note in
     * the success path above, which cost a round of live San Diego failures.
     */
    const leader = (async (): Promise<CacheEntry> => {
      const response = await originRequest(url, init, startedAt, true);
      const cached = cache.get(url);
      // The success path has already cached and rebuilt; reuse that entry
      // rather than reading the rebuilt Response a second time.
      if (cached !== undefined) return cached;
      return {
        /*
         * NOT CACHED, AND NOT BECAUSE OF THIS FIELD.
         *
         * Reaching here means the success path did not cache, so the status
         * was not ok. What keeps a 503 from being served to the next caller a
         * minute later is that nothing below writes this entry to `cache` —
         * it is handed to the callers waiting right now and then dropped.
         * `expiresAt` is required by the type and is read by nobody on this
         * path; a value was chosen that would also be harmless if someone
         * later did cache it, rather than one that merely looks deliberate.
         */
        expiresAt: 0,
        body: await response.text(),
        status: response.status,
        headers: [...response.headers.entries()],
      };
    })();

    inFlightByUrl.set(url, leader);
    // Attached immediately so a rejection with no waiters yet is never an
    // unhandled rejection. The real handling is the await below.
    leader.catch(() => undefined);

    try {
      return responseFrom(await leader);
    } finally {
      inFlightByUrl.delete(url);
    }
  };

  return Object.assign(wrapped, {
    stats: () => ({ hits, misses, retries, coalesced }),
    clearCache: () => {
      cache.clear();
      inFlightByUrl.clear();
    },
  }) as ResilientFetch;
}
