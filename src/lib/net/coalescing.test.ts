import { beforeEach, describe, expect, it } from 'vitest';
import { createResilientFetch, resetResilientFetchState } from './resilient-fetch';

const URL_A = 'https://example.county.gov/arcgis/rest/services/X/MapServer/0/query?f=json&a=1';
const URL_B = 'https://example.county.gov/arcgis/rest/services/X/MapServer/0/query?f=json&b=2';

/** A fetch that counts origin calls and resolves only when released. */
function gatedFetch(body = '{"features":[]}', status = 200) {
  let calls = 0;
  const releases: Array<() => void> = [];
  const impl = (async () => {
    calls += 1;
    await new Promise<void>((resolve) => releases.push(resolve));
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return {
    impl,
    get calls() {
      return calls;
    },
    releaseAll() {
      for (const r of releases.splice(0)) r();
    },
  };
}

describe('concurrent requests for the same URL hit the origin once', () => {
  beforeEach(() => resetResilientFetchState());

  it('coalesces ten simultaneous callers into one origin call', async () => {
    // THE FIX, STATED AS A NUMBER. Before this, ten callers arriving before
    // the first response landed produced ten origin requests: the cache can
    // only help AFTER one completes and said nothing about the ones already
    // in the air. The limiter bounded how many ran at once; it never asked
    // whether they were the same request.
    const origin = gatedFetch();
    const f = createResilientFetch({ fetchImpl: origin.impl });

    const all = Promise.all(Array.from({ length: 10 }, () => f(URL_A)));
    await Promise.resolve();
    expect(origin.calls).toBe(1);

    origin.releaseAll();
    const responses = await all;
    expect(responses).toHaveLength(10);
    expect(origin.calls).toBe(1);
    expect(f.stats().coalesced).toBe(9);
  });

  it('gives every caller its own readable body', async () => {
    // A Response body is a stream and can be read once, so waiters cannot be
    // handed the leader's Response. If this ever regresses, the second caller
    // sees an empty body or a locked-stream error.
    const origin = gatedFetch('{"features":[{"attributes":{"AIN":"123"}}]}');
    const f = createResilientFetch({ fetchImpl: origin.impl });

    const all = Promise.all([f(URL_A), f(URL_A), f(URL_A)]);
    await Promise.resolve();
    origin.releaseAll();

    const bodies = await Promise.all((await all).map((r) => r.text()));
    expect(bodies).toEqual([
      '{"features":[{"attributes":{"AIN":"123"}}]}',
      '{"features":[{"attributes":{"AIN":"123"}}]}',
      '{"features":[{"attributes":{"AIN":"123"}}]}',
    ]);
  });

  it('does not coalesce different URLs', async () => {
    const origin = gatedFetch();
    const f = createResilientFetch({ fetchImpl: origin.impl });

    const all = Promise.all([f(URL_A), f(URL_B)]);
    await Promise.resolve();
    expect(origin.calls).toBe(2);

    origin.releaseAll();
    await all;
    expect(f.stats().coalesced).toBe(0);
  });

  it('serves the cache once the leader has finished, not a second origin call', async () => {
    const origin = gatedFetch();
    const f = createResilientFetch({ fetchImpl: origin.impl });

    const first = f(URL_A);
    await Promise.resolve();
    origin.releaseAll();
    await first;

    await f(URL_A);
    expect(origin.calls).toBe(1);
    expect(f.stats().hits).toBe(1);
  });
});

describe('what the waiters get when the leader fails', () => {
  beforeEach(() => resetResilientFetchState());

  it('propagates the failure rather than letting each waiter retry', async () => {
    // THE DECISION WORTH DEFENDING. Letting waiters fall through to their own
    // request turns one failure into N against a service that has just shown
    // it is struggling — the stampede this whole module exists to prevent,
    // triggered by exactly the condition where it does most harm.
    let calls = 0;
    const impl = (async () => {
      calls += 1;
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;

    const f = createResilientFetch({
      fetchImpl: impl,
      maxAttempts: 1,
      sleep: async () => undefined,
    });

    const results = await Promise.allSettled([f(URL_A), f(URL_A), f(URL_A)]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    // One attempt, one caller. Not three.
    expect(calls).toBe(1);
  });

  it('does not cache a non-ok status for the next caller', async () => {
    // A 503 is shared with everyone waiting on it right now and then
    // forgotten. Serving it from cache a minute later would turn a momentary
    // outage into a sticky one.
    let calls = 0;
    const impl = (async () => {
      calls += 1;
      return new Response('busy', { status: 503 });
    }) as unknown as typeof fetch;

    const f = createResilientFetch({
      fetchImpl: impl,
      maxAttempts: 1,
      sleep: async () => undefined,
    });

    const first = await f(URL_A);
    expect(first.status).toBe(503);
    await f(URL_A);
    expect(calls).toBe(2);
    expect(f.stats().hits).toBe(0);
  });

  it('lets a later caller succeed after a failed leader', async () => {
    // The in-flight entry must be cleared on failure. If it leaked, a single
    // failure would poison that URL for the lifetime of the instance.
    let calls = 0;
    const impl = (async () => {
      calls += 1;
      if (calls === 1) throw new Error('ECONNRESET');
      return new Response('{"ok":true}', { status: 200 });
    }) as unknown as typeof fetch;

    const f = createResilientFetch({
      fetchImpl: impl,
      maxAttempts: 1,
      sleep: async () => undefined,
    });

    await expect(f(URL_A)).rejects.toThrow();
    const second = await f(URL_A);
    expect(second.status).toBe(200);
    await expect(second.text()).resolves.toBe('{"ok":true}');
  });
});

describe('non-cacheable requests are left alone', () => {
  beforeEach(() => resetResilientFetchState());

  it('does not coalesce POSTs', async () => {
    // Two POSTs to the same URL are two different intentions. Sharing one
    // response between them would be wrong regardless of load.
    const origin = gatedFetch();
    const f = createResilientFetch({ fetchImpl: origin.impl });

    const all = Promise.all([
      f(URL_A, { method: 'POST' }),
      f(URL_A, { method: 'POST' }),
    ]);
    await Promise.resolve();
    expect(origin.calls).toBe(2);

    origin.releaseAll();
    await all;
    expect(f.stats().coalesced).toBe(0);
  });

  it('does not coalesce when caching is disabled', async () => {
    const origin = gatedFetch();
    const f = createResilientFetch({ fetchImpl: origin.impl, cacheTtlMs: 0 });

    const all = Promise.all([f(URL_A), f(URL_A)]);
    await Promise.resolve();
    expect(origin.calls).toBe(2);

    origin.releaseAll();
    await all;
  });
});
