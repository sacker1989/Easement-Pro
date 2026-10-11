import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  codeOf,
  copyOf,
  proseOf,
  readSource,
  stringLiterals,
  stripComments,
  stripCommentMarkers,
  stripJsxComments,
} from './source-text';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

describe('the transforms', () => {
  it('stripComments removes block, whole-line and trailing comments', () => {
    const source = [
      '/* a block */',
      'const a = 1; // trailing',
      '// whole line',
      'const b = 2;',
      '/**',
      ' * multi',
      ' */',
      'const c = 3;',
    ].join('\n');
    const code = stripComments(source);
    expect(code).toContain('const a = 1;');
    expect(code).toContain('const b = 2;');
    expect(code).toContain('const c = 3;');
    for (const gone of ['a block', 'trailing', 'whole line', 'multi']) {
      expect(code, `leaked: ${gone}`).not.toContain(gone);
    }
  });

  it('stripCommentMarkers keeps the words and drops the punctuation', () => {
    const prose = stripCommentMarkers('/**\n * why this\n * exists\n */\nconst a = 1;');
    // The sentence spans two comment lines; without stripping the markers it
    // comes back with a `*` sitting in the middle of it.
    expect(prose).toContain('why this exists');
    expect(prose).not.toContain('*');
  });

  it('stripJsxComments removes the whole block, braces included', () => {
    const copy = stripJsxComments('<p>kept</p>\n{/* explains the old wording */}\n<p>also</p>');
    expect(copy).toContain('kept');
    expect(copy).toContain('also');
    expect(copy).not.toContain('old wording');
    // stripComments would leave the braces behind, which is why this is its
    // own function rather than a caller detail.
    expect(copy).not.toContain('{}');
  });

  it('stringLiterals joins concatenations before matching', () => {
    /*
     * THE CASE THIS WAS WRITTEN FOR. Long caveats are authored as several
     * quoted fragments joined by `+` across source lines; a guard that reads
     * one fragment sees text no reader meets as a unit.
     */
    const source = "const s =\n  'the rework estimate is a regional ' +\n  'Census median, not yours';";
    expect(stringLiterals(source)).toEqual([
      "'the rework estimate is a regional Census median, not yours'",
    ]);
  });

  it('stringLiterals returns empty rather than null when there are none', () => {
    expect(stringLiterals('const n = 1;')).toEqual([]);
  });

  it('readSource normalises CRLF, which this checkout produces', () => {
    /*
     * Not cosmetic. Every assertion in the suite is written with \n, and a
     * pattern spanning two lines silently fails against \r\n — reporting the
     * absence of something plainly there. That cost a debugging round in
     * page-ordering.test.ts before anyone suspected the line endings.
     */
    const text = readSource(new URL('./source-text.ts', import.meta.url));
    expect(text).not.toContain('\r');
    expect(text.length).toBeGreaterThan(500);
  });

  it('the readers compose the transforms, so they cannot drift apart', () => {
    const url = new URL('./source-text.ts', import.meta.url);
    const raw = readSource(url);
    expect(codeOf(url)).toBe(stripComments(raw));
    expect(proseOf(url)).toBe(stripCommentMarkers(raw));
    expect(copyOf(url)).toBe(stripJsxComments(raw));
  });
});

describe('no test file hand-rolls its own comment stripper', () => {
  /*
   * THE GUARD THAT WOULD HAVE CAUGHT FOUR BYPASSES, and the reason this file
   * exists at all.
   *
   * This module has existed for a while. Four test files imported it and were
   * fine; four others wrote their own one-line stripper anyway, and each copy
   * drifted — one forgot trailing `//`, one split source into "sentences",
   * one missed JSX comments entirely. Three of those were written on
   * 2026-10-11, by someone who did not check whether a helper already
   * existed, which is exactly the failure a greppable guard prevents and a
   * doc comment does not.
   *
   * The signature is assembled from fragments rather than written out,
   * because a guard looking for a block-comment regex would otherwise match
   * itself — the same self-matching problem the whole module is about.
   */
  const BLOCK_COMMENT_SIGNATURE = '[' + '\\s\\S' + ']*?\\*\\/';
  const JSX_COMMENT_SIGNATURE = '\\{\\\\/\\\\*';

  function testFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) return testFiles(child);
      return entry.name.endsWith('.test.ts') ? [child] : [];
    });
  }

  const SELF = fileURLToPath(new URL('./source-text.test.ts', import.meta.url));

  it.each(testFiles(SRC).filter((f) => f !== SELF).map((f) => [relative(SRC, f), f]))(
    '%s uses the shared helper',
    (label, file) => {
      const source = readSource(file);
      const handRolled =
        source.includes(BLOCK_COMMENT_SIGNATURE) || source.includes(JSX_COMMENT_SIGNATURE);
      expect(
        handRolled,
        `${label} appears to strip comments inline. Import stripComments, ` +
          'stripJsxComments or stringLiterals from @/lib/test-support/source-text ' +
          'instead — the private copies drift, and four of them already had.',
      ).toBe(false);
    },
  );
});
