import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readSource, visibleCopy } from '@/lib/test-support/source-text';

/**
 * Claims that must hold on EVERY page, not on the page someone remembered.
 *
 * WHY THIS FILE EXISTS. The invented national land value was deleted on
 * 2026-10-11. The homepage promised it anyway — "it uses national data
 * instead of your county's own figures" — and that was corrected the same
 * day, with a test. Two days later the identical sentence turned up on the
 * report page, which nobody had looked at, and only because an unrelated diff
 * happened to print it.
 *
 * A per-page test guards the page it was written for. The claim is a property
 * of the PRODUCT, so the guard has to be too: these assertions walk every page
 * under src/app and apply to pages that do not exist yet.
 *
 * Assertions run against reader-visible copy. Comments explaining a removed
 * claim necessarily quote it, and a guard firing on its own explanation is
 * noise — see test-support/source-text.ts for how often that has happened.
 */
const APP = fileURLToPath(new URL('.', import.meta.url));

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(child);
    return /\.tsx$/.test(entry.name) && !entry.name.includes('.test.') ? [child] : [];
  });
}

const PAGES = pageFiles(APP).map((f) => ({
  label: relative(APP, f),
  copy: visibleCopy(readSource(f)),
}));

describe('every page tells the same story about coverage', () => {
  it('there are pages to check', () => {
    // Guards the rest against passing because the walk found nothing.
    expect(PAGES.length).toBeGreaterThanOrEqual(4);
  });

  it.each(PAGES.map((p) => [p.label, p] as const))(
    '%s does not promise a national stand-in for county figures',
    (label, page) => {
      /*
       * The product refuses to price an easement without a published land
       * value. Any page saying national data is used instead is describing a
       * behaviour that was removed — and promising a substitute that no
       * longer exists is the same defect the removal fixed, one layer out.
       */
      for (const stale of [
        'national data instead of your',
        'uses national benchmarks and says so',
        'national median estimate',
        'FHFA/NAHB',
      ]) {
        expect(page.copy, `${label} still claims: ${stale}`).not.toContain(stale);
      }
    },
  );

  it.each(PAGES.map((p) => [p.label, p] as const))(
    '%s does not restate the absolute logging promise',
    (label, page) => {
      /*
       * "never written to our logs" is true of the application and not of the
       * URL, which carries the address into browser history and a host's
       * request records. The privacy page says both halves; no page may say
       * only the flattering one. Two pages making different-strength claims
       * about one fact is how a reader learns to trust neither.
       */
      expect(page.copy, `${label} overstates the logging promise`).not.toContain(
        'never written to our logs',
      );
    },
  );
});
