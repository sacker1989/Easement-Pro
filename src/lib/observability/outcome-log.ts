/**
 * What happened on an upstream call, recorded so an operator can see the
 * product failing before a user tells them.
 *
 * WHY THERE WAS NOTHING. Every upstream path in this product degrades politely
 * — a county lookup that fails falls back to national benchmarks and says so, a
 * FEMA outage drops the flood panel, a geocode miss drops it too. That is right
 * for the homeowner and it is invisible to whoever runs the thing. If San Diego
 * started refusing every query, the product would keep serving plausible
 * reports built on national averages and nobody would know for weeks.
 *
 * THE PRIVACY PROBLEM IS NOT HYPOTHETICAL AND IT SHAPES THE WHOLE TYPE. This
 * product takes a home address. The geocoder is called with that address IN
 * THE URL. So the obvious implementation —
 *
 *     catch (err) { log.error(err.message) }
 *
 * — writes a residential address into the operator's log the first time the
 * Census service returns an error that quotes the request. Logs get shipped,
 * retained, and read by people who never saw this file.
 *
 * SO THE RECORD CANNOT HOLD FREE TEXT. `reason` is a closed union, not a
 * string. There is no field on `Outcome` that an address could be put in
 * without changing this file, which means the mistake above does not compile
 * rather than being caught in review. That is the only form of this guarantee
 * worth having: everything else relies on whoever writes the next catch block
 * having read this comment.
 *
 * WHAT IS SAFE AND WHY. County and state are a fixed, small vocabulary shared
 * by thousands of properties. ZIP is deliberately ABSENT even though it would
 * be useful for spotting regional problems — a ZIP plus a timestamp plus a
 * parcel-shaped query narrows far enough to be worth avoiding, and county is
 * enough to answer every operational question this is for.
 */

/** Which upstream. A closed set; adding one is an edit here. */
export type UpstreamService =
  | 'county-parcel'
  | 'census-geocoder'
  | 'fema-nfhl'
  | 'calfire-fhsz'
  | 'assessor-valuation';

/**
 * Why a call did not fully succeed.
 *
 * A UNION RATHER THAN A STRING, which is the load-bearing decision in this
 * file. An upstream error message can quote the request URL, and this
 * product's request URLs contain the user's address.
 */
export type FailureReason =
  | 'timeout'
  | 'http-error'
  | 'service-error-body'
  | 'no-match'
  | 'no-coverage'
  | 'network'
  | 'unexpected-shape';

export interface Outcome {
  readonly service: UpstreamService;
  readonly result: 'ok' | 'degraded' | 'failed';
  /** Absent when ok. */
  readonly reason?: FailureReason;
  /** Two-letter state code. Safe: tens of millions of properties share one. */
  readonly state?: string;
  /** County name from the supported set. Safe for the same reason. */
  readonly county?: string;
  readonly durationMs?: number;
}

/** Where a record goes. Swappable so a test need not read stdout. */
export interface OutcomeSink {
  write(line: string): void;
}

/**
 * Default sink: one JSON object per line on stdout.
 *
 * NOT A LOGGING LIBRARY, deliberately. Vercel, Cloud Run and every container
 * platform already collect stdout and parse JSON lines into structured fields.
 * A library would add a dependency, a configuration surface and a second place
 * for an address to end up, to replace four lines.
 */
export const stdoutSink: OutcomeSink = {
  write(line) {
    // eslint-disable-next-line no-console -- this IS the logging mechanism
    console.log(line);
  },
};

let sink: OutcomeSink = stdoutSink;

/** For tests. Returns the previous sink so a test can restore it. */
export function setOutcomeSink(next: OutcomeSink): OutcomeSink {
  const previous = sink;
  sink = next;
  return previous;
}

/**
 * Records one upstream outcome.
 *
 * Never throws. A logging failure must not take down a page — this is
 * diagnostic, and a product that dies because it could not describe itself is
 * worse than one that runs quietly.
 */
export function recordOutcome(outcome: Outcome): void {
  try {
    sink.write(
      JSON.stringify({
        evt: 'upstream',
        ts: new Date().toISOString(),
        ...outcome,
      }),
    );
  } catch {
    // Deliberately empty. See above.
  }
}

/**
 * Times a call and records its outcome, returning whatever it returned.
 *
 * TAKES A CLASSIFIER rather than inspecting the result itself, because only
 * the caller knows what its own degraded states mean — `no-coverage` from FEMA
 * is normal and `no-match` from the geocoder is a typo, and neither is an
 * error. The classifier returns the record minus the timing, which is filled
 * in here.
 */
export async function observe<T>(
  service: UpstreamService,
  classify: (value: T) => Pick<Outcome, 'result' | 'reason' | 'state' | 'county'>,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const value = await run();
    recordOutcome({ service, durationMs: Date.now() - startedAt, ...classify(value) });
    return value;
  } catch (err) {
    /*
     * THE ERROR IS NOT LOGGED, and that is the point of this whole module.
     *
     * `err.message` from a fetch failure routinely contains the request URL,
     * and this product's request URLs contain the user's street address. The
     * fact that a call threw is the operationally useful part; the message is
     * the part that leaks. A stack trace would be nice and is not worth a
     * residential address in a log aggregator.
     */
    recordOutcome({
      service,
      result: 'failed',
      reason: 'network',
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
