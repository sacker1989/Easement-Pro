import { DEFAULTS as RESILIENT_DEFAULTS, HOST_OVERRIDES } from '@/lib/net/resilient-fetch';

/**
 * How long an assessor provider waits before giving up on its own.
 *
 * IT IS A BACKSTOP, NOT THE DEADLINE, and conflating those two cost this
 * product its entire retry layer.
 *
 * Every provider accepts an injectable `fetchImpl`. In production that is the
 * shared resilient fetch, which already owns retries, backoff, a per-attempt
 * timeout and a total budget. In a test it is often a bare `fetch`, which owns
 * no deadline at all — so the provider keeps a controller of its own to stop a
 * hung socket lasting forever.
 *
 * THE OLD VALUE WAS 10_000, which is exactly the resilient layer's PER-ATTEMPT
 * timeout. The two deadlines therefore expired together: the moment attempt
 * one hit ten seconds the provider aborted too, `resilient-fetch` classified
 * it as a caller abort — fatal by design, since a canceled render is not a
 * transient failure — and attempts two and three never ran. The retry logic,
 * written because Orange County's server was measured returning 503 under
 * modest load, had never once fired.
 *
 * The symptom was intermittent and invisible on a quiet afternoon, which is
 * why it survived: on 2026-10-21 a production sweep got parcel data for two of
 * nine addresses, and a San Diego failure reproduced locally at 10,018ms —
 * the provider's own deadline, to the millisecond.
 *
 * THE SAN DIEGO OVERRIDE IS WHY THIS TAKES A MAXIMUM, NOT THE DEFAULT.
 * Someone had already measured that county's tail at about 22 seconds and
 * raised its host override to a 28s timeout on a 29s budget, with a comment
 * saying the point was to stop throwing away slow successes. The provider's
 * hardcoded 10_000 then threw them away regardless. Every bit of that
 * measurement and tuning was dead on arrival, and nothing failed loudly
 * enough to say so — the override simply never got to apply.
 *
 * So this is derived from the LARGEST budget any host can ask for. Using the
 * default alone would give 30_000, which clears San Diego's 29_000 by luck
 * today and would quietly stop clearing it the next time someone measures a
 * slower tail.
 */
const LARGEST_BUDGET_MS = Math.max(
  RESILIENT_DEFAULTS.totalBudgetMs,
  ...Object.values(HOST_OVERRIDES).map((o) => o.totalBudgetMs ?? RESILIENT_DEFAULTS.totalBudgetMs),
);

export const PROVIDER_TIMEOUT_MS = LARGEST_BUDGET_MS + 5_000;
