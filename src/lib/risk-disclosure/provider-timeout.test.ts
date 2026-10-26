import { describe, expect, it } from 'vitest';
import { createResilientFetch, DEFAULTS as RESILIENT_DEFAULTS } from '@/lib/net/resilient-fetch';
import { createSanDiegoAssessorProvider } from './san-diego-assessor-provider';
import { createLaCountyAssessorProvider } from './la-county-assessor-provider';
import { createOrangeCountyAssessorProvider } from './orange-county-assessor-provider';
import { createCookCountyAssessorProvider } from './cook-county-assessor-provider';
import { PROVIDER_TIMEOUT_MS } from './provider-timeout';

/**
 * THE RETRY LAYER HAD NEVER FIRED IN PRODUCTION, and this is why.
 *
 * `resilient-fetch` exists because this project measured Orange County's whole
 * server returning 503 under modest load: three attempts, exponential backoff,
 * a 25-second total budget. Every assessor provider then wrapped its call in
 * its OWN AbortController set to 10 seconds — exactly the resilient layer's
 * PER-ATTEMPT timeout.
 *
 * So the two deadlines fire together. The instant attempt one hits ten
 * seconds, the provider's controller aborts too, and `resilient-fetch`
 * classifies a caller abort as fatal and deliberately does not retry it — a
 * cancelled render is not a transient failure. The second and third attempts
 * were unreachable from the day they were written.
 *
 * It is invisible when the services are fast, which is most of the time, and
 * that is exactly the shape of the bug reported from production on
 * 2026-10-21: two of nine addresses returned parcel data, with failures that
 * did not reproduce on a quiet afternoon. A locally reproduced San Diego
 * failure took 10,018ms — the provider's own deadline, to the millisecond.
 *
 * THE FIX IS AN ORDERING, NOT A NUMBER. A provider's timeout is a BACKSTOP
 * against a `fetchImpl` that has no deadline of its own (a bare `fetch` in a
 * test), so it has to sit ABOVE the retry budget rather than inside it.
 */
describe('a provider deadline must not cut the retry budget short', () => {
  it('sits above the resilient layer total budget, not at its per-attempt timeout', () => {
    expect(PROVIDER_TIMEOUT_MS).toBeGreaterThan(RESILIENT_DEFAULTS.totalBudgetMs);
    // The specific regression: equal to the per-attempt timeout meant the
    // caller's abort and the first attempt's abort raced, and the caller won.
    expect(PROVIDER_TIMEOUT_MS).not.toBe(RESILIENT_DEFAULTS.timeoutMs);
  });

  it('every provider uses it', () => {
    for (const create of [
      createSanDiegoAssessorProvider,
      createLaCountyAssessorProvider,
      createOrangeCountyAssessorProvider,
      createCookCountyAssessorProvider,
    ]) {
      // Constructed with no options, which is how county-dispatch builds them.
      expect(create({}).name.length).toBeGreaterThan(0);
    }
  });

  it('a retry now succeeds where it used to be killed by the caller', async () => {
    /*
     * THE BEHAVIOURAL PROOF. Two failures then a success, with the resilient
     * layer's per-attempt timeout well below the provider's deadline. Before
     * the fix the provider's controller fired during attempt one and the
     * retries never happened.
     */
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      // ONE failure, not two: San Diego's HOST_OVERRIDES caps maxAttempts at 2,
      // because a second attempt after a 28s wait cannot fit the budget. A
      // fixture expecting three tries would be testing a policy this host
      // deliberately does not have.
      if (calls < 2) return new Response('busy', { status: 503 });
      return new Response(
        JSON.stringify({
          features: [
            {
              attributes: {
                APN: '3503120200',
                ASR_LAND: 524874,
                ASR_IMPR: 349916,
                ASR_TOTAL: 874790,
                SITUS_ADDRESS: 7753,
                SITUS_PRE_DIR: ' ',
                SITUS_STREET: 'DRAPER',
                SITUS_SUFFIX: 'AVE',
                SITUS_POST_DIR: ' ',
                SITUS_ZIP: '92037-4301',
                DOCDATE: '20150101',
                DOCTYPE: 'GD',
                TOTAL_LVG_AREA: 1800,
                OWN_NAME1: 'SAMPLE',
                LEGLDESC: 'LOT 1',
                'Shape.STArea()': 7009,
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const resilient = createResilientFetch({
      fetchImpl: flaky,
      sleep: async () => undefined,
      cacheTtlMs: 0,
    }) as unknown as typeof fetch;

    const provider = createSanDiegoAssessorProvider({ fetchImpl: resilient });
    const result = await provider.findByAddress('7753 Draper Ave', '92037');

    expect(calls).toBe(2);
    expect(result.status).toBe('found');
  });
});
