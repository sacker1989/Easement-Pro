import { describe, expect, it } from 'vitest';
import { HOST_OVERRIDES, resolveHostConfig } from './resilient-fetch';

const SD = 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query?f=json';
const LA = 'https://public.gis.lacounty.gov/public/rest/services/x/MapServer/0/query?f=json';

/** Records the AbortSignal deadline each attempt was given. */
function timingSpy(delayMs: number, clock: { now: number }) {
  let attempts = 0;
  const impl = (async (_url: string, init?: RequestInit) => {
    attempts += 1;
    // Simulate a slow origin by advancing the injected clock, then check
    // whether the caller's signal aborted before we would have answered.
    clock.now += delayMs;
    if (init?.signal?.aborted) throw new Error('aborted by timeout');
    return new Response('{"features":[]}', { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, get attempts() { return attempts; } };
}

describe('per-host overrides', () => {
  it('gives San Diego a longer per-attempt timeout than the default', () => {
    /*
     * THE MEASUREMENT BEHIND THIS. Three consecutive timings of the same
     * parcel query on 2026-10-11: 0.6s, 22.4s, 1.3s. The 22-second one is the
     * service's spread, not an outage — and under the 10s default every
     * request that landed on it returned service-error, so San Diego reports
     * showed no parcel section and no valuation while the other three
     * counties were fine.
     */
    const sd = HOST_OVERRIDES['gis-public.sandiegocounty.gov'];
    expect(sd).toBeDefined();
    expect(sd!.timeoutMs).toBeGreaterThan(22_000);
  });

  it('gives San Diego FEWER attempts, not more', () => {
    // Retrying a slow service is worse than waiting for it: you abandon a
    // response that was about to arrive, pay the timeout anyway, and repeat.
    // The fix is patience, not persistence.
    expect(HOST_OVERRIDES['gis-public.sandiegocounty.gov']!.maxAttempts).toBe(2);
  });

  it('keeps the ceiling under the 30s Vercel function limit', () => {
    // /report declares maxDuration = 30. A budget at or above that would
    // trade a county timeout for a function timeout, which is worse: the
    // whole page dies instead of one section degrading.
    const sd = HOST_OVERRIDES['gis-public.sandiegocounty.gov']!;
    expect(sd.totalBudgetMs!).toBeLessThan(30_000);
    expect(sd.timeoutMs!).toBeLessThan(30_000);
  });

  it('applies the override to San Diego and not to other hosts', () => {
    const base = { maxAttempts: 3, timeoutMs: 10_000, totalBudgetMs: 25_000, baseDelayMs: 300, maxDelayMs: 4_000, cacheTtlMs: 60_000, maxConcurrentPerHost: 4 };

    const sd = resolveHostConfig('gis-public.sandiegocounty.gov', base, {});
    expect(sd.timeoutMs).toBe(28_000);
    expect(sd.maxAttempts).toBe(2);

    const la = resolveHostConfig('public.gis.lacounty.gov', base, {});
    expect(la.timeoutMs).toBe(10_000);
    expect(la.maxAttempts).toBe(3);

    // An unlisted host is untouched in every field.
    expect(resolveHostConfig('example.invalid', base, {})).toEqual(base);
  });

  it('lets an explicit caller option outrank the host table', () => {
    /*
     * A test that passes timeoutMs means it. Silently overriding it from a
     * table keyed on a hostname the test never mentioned would make every
     * San Diego test in this repo lie about what it was exercising.
     */
    const base = { maxAttempts: 3, timeoutMs: 10_000, totalBudgetMs: 25_000, baseDelayMs: 300, maxDelayMs: 4_000, cacheTtlMs: 60_000, maxConcurrentPerHost: 4 };
    const sd = resolveHostConfig('gis-public.sandiegocounty.gov', base, { timeoutMs: 5_000, maxAttempts: 1 });
    expect(sd.timeoutMs).toBe(5_000);
    expect(sd.maxAttempts).toBe(1);
    // Fields the caller did not set still come from the host override.
    expect(sd.totalBudgetMs).toBe(29_000);
  });
});
