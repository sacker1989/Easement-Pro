import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  backoffDelay,
  createResilientFetch,
  parseRetryAfter,
  resetResilientFetchState,
  ResilientFetchError,
  RETRYABLE_STATUSES,
} from './resilient-fetch';

const URL_A = 'https://www.ocgis.com/arcpub/rest/services/X/MapServer/0/query?f=json';

/** Deterministic harness: no real timers, no real randomness. */
function harness(responses: (Response | Error)[]) {
  const calls: string[] = [];
  let slept = 0;
  let clock = 0;
  let i = 0;

  const fetchImpl = (async (url: string | URL | Request) => {
    calls.push(String(url));
    const next = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    if (next instanceof Error) throw next;
    return next.clone();
  }) as unknown as typeof fetch;

  const f = createResilientFetch({
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => {
      slept += ms;
      clock += ms;
    },
    random: () => 0.5,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    cacheTtlMs: 0,
  });

  return { f, calls, sleptMs: () => slept, advance: (ms: number) => (clock += ms) };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => resetResilientFetchState());

describe('retries only what is worth retrying', () => {
  it('retries a 503 and succeeds', () => {
    // The motivating case, recorded in county-database.ts: the whole ocgis.com
    // server returned 503 under modest query load.
    const { f, calls } = harness([json({}, 503), json({ features: [] }, 200)]);
    return f(URL_A).then(async (r) => {
      expect(r.status).toBe(200);
      expect(calls).toHaveLength(2);
    });
  });

  it('does NOT retry a 400', async () => {
    // A malformed query fails identically forever. Retrying turns one useless
    // request into three.
    const { f, calls } = harness([json({ error: { code: 400 } }, 400)]);
    const r = await f(URL_A);
    expect(r.status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  it('does not retry 404 or 401 either', async () => {
    for (const status of [401, 403, 404]) {
      resetResilientFetchState();
      const { f, calls } = harness([json({}, status)]);
      await f(URL_A);
      expect(calls).toHaveLength(1);
    }
  });

  it('retries a network error', async () => {
    const { f, calls } = harness([new TypeError('socket hang up'), json({ ok: true })]);
    const r = await f(URL_A);
    expect(r.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('gives up after maxAttempts and reports how many it made', async () => {
    const { f, calls } = harness([new TypeError('ECONNRESET')]);
    await expect(f(URL_A)).rejects.toThrow(ResilientFetchError);
    expect(calls).toHaveLength(3);
    await expect(f(URL_A)).rejects.toMatchObject({ attempts: 3 });
  });

  it('returns the last response rather than throwing when retries run out on a status', async () => {
    // A 503 the caller can inspect is more useful than an exception that hides
    // the status; the providers already turn a non-ok response into their own
    // typed error.
    const { f } = harness([json({}, 503)]);
    const r = await f(URL_A);
    expect(r.status).toBe(503);
  });

  it('treats 429 as retryable but leaves other 4xx alone', () => {
    expect(RETRYABLE_STATUSES).toContain(429);
    expect(RETRYABLE_STATUSES).not.toContain(400);
    expect(RETRYABLE_STATUSES).not.toContain(404);
  });
});

describe('backoff', () => {
  it('is jittered, not a fixed exponential', () => {
    // Full jitter: several parcels resolving at once must not retry in
    // lockstep and reproduce the burst that caused the 503.
    expect(backoffDelay(1, 100, 1000, () => 0)).toBe(0);
    expect(backoffDelay(1, 100, 1000, () => 1)).toBe(100);
    expect(backoffDelay(3, 100, 1000, () => 1)).toBe(400);
  });

  it('is capped', () => {
    expect(backoffDelay(20, 100, 1000, () => 1)).toBe(1000);
  });

  it('grows between attempts', async () => {
    const { f, sleptMs } = harness([json({}, 503), json({}, 503), json({ ok: true })]);
    await f(URL_A);
    // attempt 1 -> 100*0.5 = 50, attempt 2 -> 200*0.5 = 100
    expect(sleptMs()).toBe(150);
  });

  it('honours Retry-After in seconds', async () => {
    const { f, sleptMs } = harness([json({}, 503, { 'retry-after': '2' }), json({ ok: true })]);
    await f(URL_A);
    expect(sleptMs()).toBe(2000);
  });

  it('honours Retry-After as an HTTP date', () => {
    const now = Date.parse('2026-08-17T00:00:00Z');
    expect(parseRetryAfter('Mon, 17 Aug 2026 00:00:30 GMT', now)).toBe(30_000);
  });

  it('ignores an unparseable Retry-After rather than stalling', () => {
    expect(parseRetryAfter('soon', Date.now())).toBeNull();
    expect(parseRetryAfter(null, Date.now())).toBeNull();
  });
});

describe('the total budget', () => {
  it('stops retrying once the budget is spent, however many attempts remain', async () => {
    // A per-attempt timeout alone lets three 10s attempts plus backoff block a
    // page render for half a minute.
    let clock = 0;
    const fetchImpl = (async () => {
      clock += 400;
      return json({}, 503);
    }) as unknown as typeof fetch;

    const f = createResilientFetch({
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      random: () => 1,
      maxAttempts: 10,
      totalBudgetMs: 1000,
      baseDelayMs: 200,
      cacheTtlMs: 0,
    });

    const result = await f(URL_A).catch((e) => e);
    expect(clock).toBeLessThan(3000);
    if (result instanceof ResilientFetchError) {
      expect(result.message).toMatch(/budget/);
    } else {
      expect(result.status).toBe(503);
    }
  });
});

describe('the caller stays in control', () => {
  it('does not retry a request the caller aborted', async () => {
    // A cancelled render is not a transient failure.
    const controller = new AbortController();
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      controller.abort();
      const err = new Error('aborted');
      err.name = 'AbortError';
      void init;
      throw err;
    }) as unknown as typeof fetch;

    const f = createResilientFetch({ fetchImpl, cacheTtlMs: 0, sleep: async () => {} });
    await expect(f(URL_A, { signal: controller.signal })).rejects.toThrow(/aborted by caller/);
  });
});

describe('caching', () => {
  it('serves a repeat GET from cache without a second request', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return json({ features: [1] });
    }) as unknown as typeof fetch;

    const f = createResilientFetch({ fetchImpl, cacheTtlMs: 60_000, now: () => 0 });
    const a = await f(URL_A);
    const b = await f(URL_A);
    expect(calls).toHaveLength(1);
    expect(await a.json()).toEqual({ features: [1] });
    expect(await b.json()).toEqual({ features: [1] });
    expect(f.stats().hits).toBe(1);
  });

  it('returns a readable body on the caching path, not a consumed one', async () => {
    // The regression. Populating the cache used to call
    // `response.clone().text()`, which tees the stream; in undici a tee only
    // drains when both branches are consumed, so a multi-record parcel
    // response stalled and tripped this wrapper's own timeout. A healthy
    // service that answered curl in 0.2s looked unreachable. The fix reads the
    // body once and rebuilds the Response — so the contract to assert is that
    // the caller can still read it, and gets the same bytes both times.
    const payload = { features: Array.from({ length: 26 }, (_, i) => ({ attributes: { APN: i } })) };
    const f = createResilientFetch({
      fetchImpl: (async () => json(payload)) as unknown as typeof fetch,
      cacheTtlMs: 60_000,
      now: () => 0,
    });

    const fromNetwork = await f(URL_A);
    expect(fromNetwork.bodyUsed).toBe(false);
    expect(await fromNetwork.json()).toEqual(payload);

    const fromCache = await f(URL_A);
    expect(await fromCache.json()).toEqual(payload);
    expect(f.stats().hits).toBe(1);
  });

  it('never calls clone() on the caching path', () => {
    // The behavioural test above does NOT have teeth against the real bug:
    // restoring `response.clone().text()` leaves it passing, because a
    // synthetic Response built from a short string never hits the tee stall
    // that a live multi-record parcel response does. A live probe caught it
    // and a live probe would catch it again — but nothing in CI would.
    //
    // So this asserts the mechanism instead of the symptom. It is a weaker
    // claim honestly stated, rather than a strong one that is not true.
    // Strip BOTH comment forms before scanning. The block-only version of this
    // fired on the line comment that explains why clone() is avoided — the
    // same self-match that hit the appraisal scanner against its own
    // disclaimer, and the calculator guard against its own doc comment. A
    // prohibition on code has to read code.
    const code = readFileSync(new URL('./resilient-fetch.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/\.clone\(\)/);
  });

  it('preserves status and headers through the rebuild', async () => {
    const f = createResilientFetch({
      fetchImpl: (async () =>
        json({ ok: true }, 200, { 'content-type': 'application/json' })) as unknown as typeof fetch,
      cacheTtlMs: 60_000,
      now: () => 0,
    });
    const r = await f(URL_A);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/json');
  });

  it('expires an entry once its TTL passes', async () => {
    const calls: string[] = [];
    let clock = 0;
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return json({ ok: true });
    }) as unknown as typeof fetch;

    const f = createResilientFetch({ fetchImpl, cacheTtlMs: 1000, now: () => clock });
    await f(URL_A);
    clock = 1001;
    await f(URL_A);
    expect(calls).toHaveLength(2);
  });

  it('never caches a failure', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return json({}, 503);
    }) as unknown as typeof fetch;

    const f = createResilientFetch({
      fetchImpl,
      cacheTtlMs: 60_000,
      now: () => 0,
      sleep: async () => {},
      maxAttempts: 1,
    });
    await f(URL_A);
    await f(URL_A);
    expect(calls).toHaveLength(2);
  });

  it('does not cache a non-GET', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return json({ ok: true });
    }) as unknown as typeof fetch;

    const f = createResilientFetch({ fetchImpl, cacheTtlMs: 60_000, now: () => 0 });
    await f(URL_A, { method: 'POST' });
    await f(URL_A, { method: 'POST' });
    expect(calls).toHaveLength(2);
  });
});

describe('it stays a drop-in for the providers', () => {
  it('matches the fetch signature the providers already accept', async () => {
    // Every assessor provider takes `fetchImpl?: typeof fetch`. Matching that
    // is why no provider needed rewriting.
    const f = createResilientFetch({
      fetchImpl: (async () => json({ features: [] })) as unknown as typeof fetch,
      cacheTtlMs: 0,
    });
    const typed: typeof fetch = f;
    const r = await typed(URL_A);
    expect(r.ok).toBe(true);
  });
});
