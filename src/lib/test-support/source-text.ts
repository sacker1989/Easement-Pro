/**
 * Reading source for assertions, without the comments.
 *
 * WHY THIS EXISTS. Source-text assertions are used throughout this codebase to
 * enforce things a type cannot: that the handoff layer never imports the
 * rejected calculator, that the records-request builder has no HTTP client,
 * that the commerce guard has no override. They work, and they have one
 * recurring failure that has now bitten ELEVEN times:
 *
 *   A guard fires on the comment explaining the guard.
 *
 * The appraisal scanner matched its own disclaimer. The opinion-of-value
 * pattern matched STANDING_HEADER's strongest disclaimer. The calculator guard
 * matched a doc comment naming the thing it forbids. The recording-act test
 * matched a note saying why the classification is withheld. On 2026-10-11 the
 * areaEstablished guard matched the comment explaining the old expression, and
 * the FHFA guard and the homepage guard each did the same within hours. Every
 * time, the prose was correct and the assertion was wrong, and every time the
 * fix was the same.
 *
 * WHY IT KEPT HAPPENING AFTER THIS MODULE EXISTED, which is the more useful
 * question and the reason for the 2026-10-11 rewrite. Four test files imported
 * `codeOf` and were fine. Four others wrote their own one-line stripper
 * anyway, and they all had the same reason: THEY ALREADY HELD THE FILE TEXT.
 * A test that asserts on both the raw source and the stripped source — common,
 * because "the code must not say X" and "the file must document why" are
 * natural neighbours — could not use a helper that insists on doing its own
 * `readFileSync`. Reading the file twice to use the shared function is worse
 * than three lines of inline regex, so inline regex is what got written, and
 * each copy then drifted: one forgot trailing `//`, one split "sentences" that
 * source code does not have, one missed `{/* … *\/}` entirely.
 *
 * So the transforms below are PURE and take text. The readers are thin
 * wrappers for the common case. Having the file already is no longer a reason
 * to re-derive the regex.
 *
 * PICKING THE RIGHT ONE IS PICKING WHAT THE ASSERTION IS ABOUT:
 *
 *   stripComments        "this must not appear in the code"
 *   stripCommentMarkers  "this file must document its reasoning"
 *   stripJsxComments     "a reader of this page must not see this"
 *   stringLiterals       "no text that reaches the user may say this"
 */

import { readFileSync } from 'node:fs';

/**
 * Reads a file and normalises line endings.
 *
 * CRLF IS NOT COSMETIC HERE. This repo is developed on Windows with git's
 * autocrlf on, so files arrive with `\r\n` while every assertion in the suite
 * is written with `\n`. A pattern spanning two lines — which source-text
 * assertions constantly are — silently fails to match, and the test reports
 * the absence of something that is plainly there. That cost a debugging round
 * in page-ordering.test.ts before anyone realised the file was fine.
 *
 * Normalising in the one place files are read means no caller has to remember.
 */
export function readSource(url: URL | string): string {
  return readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

/**
 * Comments removed. For "this must not appear in the code".
 *
 * Block comments first, then whole-line `//`, then trailing `//`. Trailing is
 * last and deliberately conservative — a `//` inside a string literal would be
 * stripped too, so a pattern that must match inside a URL should use
 * `stripCommentMarkers` or the raw source.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/.*$/gm, '');
}

/**
 * Comment markers removed, words kept, whitespace collapsed. For "this file
 * must document X".
 *
 * Collapsing whitespace alone is not enough: a sentence spanning two comment
 * lines comes back with a `*` or `//` sitting mid-sentence, so an assertion
 * about the words fails on the formatting. Both have to go.
 */
export function stripCommentMarkers(source: string): string {
  return source.replace(/^\s*(\/\/|\*\/|\/\*\*?|\*)/gm, ' ').replace(/\s+/g, ' ');
}

/**
 * JSX comments removed entirely. For "a reader of this page must not see X".
 *
 * DISTINCT FROM stripComments, which would leave the `{}` wrapper behind and,
 * more importantly, is the wrong question for a page. `{/* … *\/}` renders as
 * nothing, so for an assertion about what a visitor reads it is not code and
 * not copy — it simply is not there. The homepage guard that fired on its own
 * explanation needed exactly this and had no way to say it.
 */
export function stripJsxComments(source: string): string {
  return source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

/**
 * Everything a reader of the rendered page would actually see: both comment
 * forms removed.
 *
 * ADDED AFTER COMPOSING IT BY HAND THREE TIMES. A `.tsx` page carries JSX
 * comments in its markup and plain block comments around its metadata, and a
 * guard on page copy has to ignore both — the privacy page kept failing its
 * own "do not restate this claim" test on the comment explaining why the
 * claim was removed, once per comment style.
 *
 * `stripJsxComments` alone leaves the metadata comment; `stripComments` alone
 * leaves `{}` where the JSX comment was. The order matters: JSX comments go
 * first, because stripping `/* … *\/` out of `{/* … *\/}` would leave the
 * braces behind for the second pass to trip over.
 */
export function visibleCopy(source: string): string {
  return stripComments(stripJsxComments(source));
}

/**
 * Every single-quoted literal, with adjacent concatenations joined first.
 *
 * FOR ASSERTIONS ABOUT TEXT THAT REACHES A USER, where the literal is the
 * right unit and the line is not. Long caveats in this codebase are written as
 * several quoted fragments joined by `+` across source lines, so a guard that
 * reads one fragment sees copy no reader ever meets as a unit — and a guard
 * that splits source into "sentences" fares worse still, because source code
 * has none: the chunk runs to the end of the file and passes on an unrelated
 * word hundreds of lines away. Both of those were written on 2026-10-11 before
 * this function was.
 *
 * Single-quoted only, which matches this codebase's convention and keeps the
 * pattern honest; a double-quoted literal would need its own alternation and
 * there are none worth scanning.
 */
export function stringLiterals(source: string): readonly string[] {
  return source.replace(/'\s*\+\s*'/g, '').match(/'(?:[^'\\\n]|\\.)*'/g) ?? [];
}

/** Reads a file and strips its comments. The common case for a code guard. */
export function codeOf(url: URL | string): string {
  return stripComments(readSource(url));
}

/** Reads a file and keeps its prose. The common case for a docs guard. */
export function proseOf(url: URL | string): string {
  return stripCommentMarkers(readSource(url));
}

/** Reads a page and keeps only what a visitor would see rendered. */
export function copyOf(url: URL | string): string {
  return stripJsxComments(readSource(url));
}
