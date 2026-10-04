/**
 * Reading source for assertions, without the comments.
 *
 * WHY THIS EXISTS. Source-text assertions are used throughout this codebase to
 * enforce things a type cannot: that the handoff layer never imports the
 * rejected calculator, that the records-request builder has no HTTP client,
 * that the commerce guard has no override. They work, and they have one
 * recurring failure that has now bitten EIGHT times:
 *
 *   A guard fires on the comment explaining the guard.
 *
 * The appraisal scanner matched its own disclaimer. The opinion-of-value
 * pattern matched STANDING_HEADER's strongest disclaimer. The calculator guard
 * matched a doc comment naming the thing it forbids. The recording-act test
 * matched a note saying why the classification is withheld. And so on. Every
 * time, the prose was correct and the assertion was wrong, and every time the
 * fix was the same.
 *
 * So: `codeOf` strips comments and scans what executes. `proseOf` strips the
 * comment MARKERS and keeps the words, for the opposite case — asserting that
 * a file documents its own reasoning. Picking between them is picking what the
 * assertion is actually about.
 */

import { readFileSync } from 'node:fs';

/**
 * Source with comments removed. For "this must not appear in the code".
 *
 * Block comments first, then whole-line `//`, then trailing `//`. Trailing is
 * last and deliberately conservative — a `//` inside a string literal would be
 * stripped too, so a pattern that must match inside a URL should use `proseOf`
 * or match the raw file.
 */
export function codeOf(url: URL | string): string {
  return readFileSync(url, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/.*$/gm, '');
}

/**
 * Source with comment markers removed and whitespace collapsed. For "this file
 * must document X".
 *
 * Collapsing whitespace alone is not enough: a sentence spanning two comment
 * lines comes back with a `*` or `//` sitting mid-sentence, so an assertion
 * about the words fails on the formatting. Both have to go.
 */
export function proseOf(url: URL | string): string {
  return readFileSync(url, 'utf8')
    .replace(/^\s*(\/\/|\*\/|\/\*\*?|\*)/gm, ' ')
    .replace(/\s+/g, ' ');
}
