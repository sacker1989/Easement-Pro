import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  observe,
  recordOutcome,
  setOutcomeSink,
  type Outcome,
  type OutcomeSink,
} from './outcome-log';

const ADDRESS = '1200 Getty Center Dr';

function capture(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const sink: OutcomeSink = { write: (l) => lines.push(l) };
  const previous = setOutcomeSink(sink);
  return { lines, restore: () => setOutcomeSink(previous) };
}

let active: { restore: () => void } | null = null;
afterEach(() => {
  active?.restore();
  active = null;
});

describe('recordOutcome', () => {
  it('writes one JSON line with a timestamp and an event tag', () => {
    const c = capture();
    active = c;
    recordOutcome({ service: 'county-parcel', result: 'ok', county: 'Los Angeles County', state: 'CA' });

    expect(c.lines).toHaveLength(1);
    const parsed = JSON.parse(c.lines[0]!);
    expect(parsed.evt).toBe('upstream');
    expect(parsed.service).toBe('county-parcel');
    expect(parsed.county).toBe('Los Angeles County');
    expect(typeof parsed.ts).toBe('string');
  });

  it('never throws, even if the sink does', () => {
    // Diagnostics must not take down a page. A product that dies because it
    // could not describe itself is worse than one that runs quietly.
    const previous = setOutcomeSink({
      write() {
        throw new Error('disk full');
      },
    });
    active = { restore: () => setOutcomeSink(previous) };
    expect(() => recordOutcome({ service: 'fema-nfhl', result: 'ok' })).not.toThrow();
  });
});

describe('observe', () => {
  it('records timing and the classified result, and returns the value through', async () => {
    const c = capture();
    active = c;

    const value = await observe(
      'fema-nfhl',
      (r: { kind: string }) => ({ result: r.kind === 'found' ? 'ok' : 'degraded', state: 'CA' }),
      async () => ({ kind: 'found' }),
    );

    expect(value).toEqual({ kind: 'found' });
    const parsed = JSON.parse(c.lines[0]!);
    expect(parsed.result).toBe('ok');
    expect(typeof parsed.durationMs).toBe('number');
  });

  it('records a throw as failed and rethrows it', async () => {
    const c = capture();
    active = c;

    await expect(
      observe(
        'census-geocoder',
        () => ({ result: 'ok' as const }),
        async () => {
          throw new Error(`fetch failed for https://geocoder/?address=${ADDRESS}`);
        },
      ),
    ).rejects.toThrow();

    const parsed = JSON.parse(c.lines[0]!);
    expect(parsed.result).toBe('failed');
    expect(parsed.reason).toBe('network');
  });
});

describe('an address cannot reach the log', () => {
  it('does not write the error message, which quotes the request URL', async () => {
    /*
     * THE ASSERTION THE MODULE EXISTS FOR.
     *
     * The geocoder is called with the user's address in the URL. A fetch
     * failure's message routinely quotes that URL. The obvious implementation —
     * `catch (err) { log(err.message) }` — writes a residential address into
     * an operator's log, which then gets shipped, retained and read by people
     * who never saw this code.
     */
    const c = capture();
    active = c;

    await observe(
      'census-geocoder',
      () => ({ result: 'ok' as const }),
      async () => {
        throw new Error(`getaddrinfo ENOTFOUND geocoding.geo.census.gov?address=${ADDRESS}`);
      },
    ).catch(() => undefined);

    const all = c.lines.join('\n');
    expect(all).not.toContain(ADDRESS);
    expect(all).not.toContain('Getty');
    expect(all).not.toContain('ENOTFOUND');
  });

  it('has no free-text field an address could be put in', () => {
    // STRUCTURAL, NOT A CONVENTION. `reason` is a closed union, so the
    // mistake above does not compile rather than being caught in review.
    // A `message: string` or `detail: string` field here would make the
    // guarantee a matter of discipline again.
    const source = readFileSync(new URL('./outcome-log.ts', import.meta.url), 'utf8');
    const outcomeBlock = source.slice(
      source.indexOf('export interface Outcome'),
      source.indexOf('/** Where a record goes'),
    );
    expect(outcomeBlock).not.toMatch(/\b(message|detail|error|note|url|address)\s*\??\s*:\s*string/);
    // reason is the union, not a string.
    expect(outcomeBlock).toContain('reason?: FailureReason');
  });

  it('does not log a ZIP, even though it would be useful', () => {
    // County answers every operational question this is for. ZIP plus a
    // timestamp plus a parcel-shaped query narrows further than is worth it.
    const source = readFileSync(new URL('./outcome-log.ts', import.meta.url), 'utf8');
    const outcomeBlock = source.slice(
      source.indexOf('export interface Outcome'),
      source.indexOf('/** Where a record goes'),
    );
    expect(outcomeBlock.toLowerCase()).not.toContain('zip');
    expect(outcomeBlock.toLowerCase()).not.toContain('postal');
  });

  it('accepts only the fields it declares', () => {
    // Type-level, asserted at compile time by the @ts-expect-error below. If
    // Outcome ever gains an index signature or a loose field, this stops
    // erroring and the test fails to compile away.
    const ok: Outcome = { service: 'county-parcel', result: 'ok' };
    expect(ok.service).toBe('county-parcel');

    // @ts-expect-error -- an address has no home on this type, by design
    const bad: Outcome = { service: 'county-parcel', result: 'ok', address: ADDRESS };
    expect(bad).toBeDefined();
  });
});

describe('a declared service is a watched service', () => {
  /*
   * THE DEFECT THIS EXISTS FOR, which cost an unknown number of weeks.
   *
   * 'county-parcel' was the first member of UpstreamService ever written and
   * the last one to be wired up. For months it was a string in a union and
   * nothing else: no call site, no records, no way to tell. In that window the
   * San Diego provider began returning service-error for every address. Every
   * report still rendered, because a failed county lookup falls back to
   * national benchmarks and says so — correct for the homeowner, and silent
   * for whoever runs the thing. It surfaced only because somebody timed the
   * upstreams by hand.
   *
   * A UNION MEMBER IS A PROMISE THAT SOMETHING IS WATCHED, and an unused one
   * is worse than an absent one: it reads, to the next person opening this
   * file, as coverage that already exists. So the promise is checked.
   *
   * SOURCE-TEXT, which is the weaker technique and the only one that can see
   * an absence. There is no runtime handle on "nobody calls observe with this
   * argument" — the gap is precisely that no code exists to run.
   */
  const SELF = readFileSync(new URL('./outcome-log.ts', import.meta.url), 'utf8');

  /** Every `| 'name'` between the union's declaration and the next one. */
  const DECLARED = (
    SELF.slice(
      SELF.indexOf('export type UpstreamService'),
      SELF.indexOf('export type FailureReason'),
    ).match(/\|\s*'([a-z-]+)'/g) ?? []
  ).map((line) => line.replace(/[^a-z-]/g, ''));

  /**
   * Every non-test source file except this module, which declares the union
   * and so cannot also be its own caller.
   */
  function sourceText(dir: string): string {
    return readdirSync(dir, { withFileTypes: true })
      .map((entry) => {
        const child = join(dir, entry.name);
        if (entry.isDirectory()) return sourceText(child);
        if (!/\.tsx?$/.test(entry.name)) return '';
        if (entry.name.includes('.test.') || entry.name === 'outcome-log.ts') return '';
        return readFileSync(child, 'utf8');
      })
      .join('\n');
  }

  const CALLERS = sourceText(join(fileURLToPath(new URL('.', import.meta.url)), '..', '..'));

  it('reads the union from source rather than restating it here', () => {
    // A restated list drifts. A broken parse would make every case below pass
    // vacuously, so the parse is asserted before it is trusted.
    expect(DECLARED).toContain('county-parcel');
    expect(DECLARED).toContain('census-geocoder');
    // Four today. A floor rather than an equality, so adding an upstream
    // does not fail here — it fails in the case below, which is the one
    // that asks whether the new member is actually watched.
    expect(DECLARED.length).toBeGreaterThanOrEqual(4);
    expect(CALLERS.length).toBeGreaterThan(10_000);
  });

  it.each(DECLARED)("%s is actually passed to observe()", (service) => {
    /*
     * Checked near an `observe(` rather than anywhere in src, so a service
     * named only in a comment or a type annotation does not satisfy it. The
     * window is generous because the classifier argument is formatted across
     * several lines by Prettier.
     */
    const nearAnObserveCall = CALLERS.split('observe(')
      .slice(1)
      .some((tail) => tail.slice(0, 120).includes(`'${service}'`));

    expect(
      nearAnObserveCall,
      `'${service}' is declared in UpstreamService and passed to observe() nowhere. ` +
        'Either instrument it or remove it from the union — a member nobody calls ' +
        'reads as coverage that does not exist.',
    ).toBe(true);
  });
});
