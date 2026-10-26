import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES } from './easement-types';
import { GUIDE_BY_TYPE, guideFor } from './guide-content';
import { codeOf } from '@/lib/test-support/source-text';

/**
 * THE PRODUCT DOES NOT DETECT EASEMENTS, and nothing may say it does.
 *
 * A live test of nine production addresses on 2026-10-21 found that not one
 * report named a recorded easement, a holder or an instrument — because there
 * is no code path that could. The visitor picks a type from a dropdown,
 * defaulted to overhead utility, and the report explains that type.
 *
 * One Learn guide said, in its HOW TO CHECK list: "Run the free SafeHomeValue
 * report on your address — it flags overhead-utility easements." That is the
 * worst place such a claim could sit, because the list is read by someone
 * trying to establish whether they have an easement at all — the one question
 * the tool cannot answer. Someone acting on it would skip the title search
 * that is the actual answer.
 *
 * This guards the whole guide corpus rather than that one line, because the
 * line was not a typo. It is the claim a product like this drifts toward
 * every time someone writes marketing copy about it.
 */

const DETECTION_VERBS =
  /\b(flags?|detects?|identifies|finds?|discovers?|locates?|searches for|scans for|checks for|tells you whether you have|reveals?)\b/i;

/** Every string in a guide, flattened, with a path for the failure message. */
function stringsOf(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => stringsOf(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => stringsOf(v, `${path}.${k}`));
  }
  return [];
}

describe('no guide claims the report finds easements', () => {
  it('has guides to check', () => {
    // A sweep that matches nothing passes forever.
    expect(Object.keys(GUIDE_BY_TYPE).length).toBe(EASEMENT_TYPES.length);
  });

  it('never pairs the product name with a detection verb', () => {
    /*
     * SCOPED TO SENTENCES MENTIONING THE PRODUCT, deliberately. "Detect" and
     * "find" are ordinary words a guide needs — "find your deed", "a surveyor
     * locates the strip" — and banning them outright would make the guides
     * worse to read in order to prevent a claim nobody was making. What is
     * forbidden is the product doing the detecting.
     */
    for (const type of EASEMENT_TYPES) {
      for (const [path, text] of stringsOf(guideFor(type), type)) {
        for (const sentence of text.split(/(?<=[.!?])\s+/)) {
          if (!/SafeHomeValue|this (report|tool)|the (report|tool)/i.test(sentence)) continue;
          // "does not check", "has read no documents" are the corrections,
          // not violations — a negated claim is the thing we want.
          if (/\b(not|no|never|cannot|does not|doesn’t|don’t)\b/i.test(sentence)) continue;
          expect(
            DETECTION_VERBS.test(sentence),
            `${path} claims the product detects easements: "${sentence.trim()}"`,
          ).toBe(false);
        }
      }
    }
  });

  it('the overhead guide points at the title report, not at itself', () => {
    // The specific regression. Its howToCheck list must lead the reader to
    // the sources that can actually answer the question.
    const steps = guideFor('utility-overhead').howToCheck.join(' ');
    expect(steps).toMatch(/title report|deed/i);
    expect(steps).not.toMatch(/it flags/i);
  });

  it('says plainly that no documents were read, where it mentions the report', () => {
    const steps = guideFor('utility-overhead').howToCheck.join(' ');
    expect(steps).toMatch(/does not search for easements|has read no documents/i);
  });
});

describe('the report headline does not presume an easement exists', () => {
  const PAGE = codeOf(new URL('../../app/report/page.tsx', import.meta.url));

  it('is conditional rather than asserting', () => {
    /*
     * "What an easement on your property means" asserts there is one. The
     * headline is now "What <a sewer easement> would mean for <your
     * property>", which says what the reader asked about without claiming it
     * is there.
     */
    expect(PAGE).toContain('would mean for');
    expect(PAGE).not.toMatch(/<h1>What an easement on/);
  });

  it('states whose claim the easement type is, above the fold', () => {
    // The open-questions list already conceded this at item five, which is
    // the right admission in the wrong place — a reader who believes the
    // headline has no reason to scroll to the caveat that withdraws it.
    expect(PAGE).toContain('You chose');
    expect(PAGE).toMatch(/does not check whether one is recorded/);
    expect(PAGE).toMatch(/title search/);
  });
});
