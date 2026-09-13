/**
 * A legal fact is a citation plus a classification, and they are stored
 * separately because they have different provenance.
 *
 * WHY THE TYPE IS SHAPED THIS WAY. Fetching a statute establishes what the
 * statute says. It does not establish what the statute MEANS for a question
 * the statute does not pose. The clearest case in this domain: fetching
 * California CCP §321 establishes that a five-year period appears there for
 * adverse possession. It does not establish that this section supplies the
 * period for a prescriptive EASEMENT — that chain is exactly what a reviewer
 * confirms and a fetch cannot. A single field holding "five years, per §321"
 * silently merges a retrieved fact with an inferred conclusion, and the
 * inference is the part that can be wrong.
 *
 * THE TRICK, WHICH IS THE SAME ONE `lookupEncumbranceFactor` USES.
 * `researcherReading` exists only on the `unreviewed` branch and `value` only
 * on the `counsel-confirmed` branch. A caller who has not narrowed the union
 * cannot reach either. There is no field a provisional reading can be picked
 * up from by accident, because on the branch the engine can read, that field
 * does not exist.
 */

export interface PrimarySourceCitation {
  /** Formal citation, e.g. "Cal. Civ. Code §1104". */
  readonly label: string;
  /**
   * Fetchable URL for the OFFICIAL text — a legislature or code-publisher
   * domain. Not a law-firm article, not a treatise summary, not an aggregator.
   * Where only a secondary source exists the fact stays `unreviewed` and the
   * note says so.
   */
  readonly url: string;
  /** ISO date the URL was fetched and read. */
  readonly fetchedOn: string;
  /** The operative words, verbatim. A paraphrase is a summary, and summaries are how this goes wrong. */
  readonly quotedText: string;
}

export type StateLegalFact<T> =
  | {
      readonly status: 'unreviewed';
      /** May be present — a fetched source is useful evidence FOR the reviewer. */
      readonly citation: PrimarySourceCitation | null;
      /**
       * A researcher's provisional reading, for the reviewer's convenience
       * ONLY. NOTHING in the engine may read this. It is not a value; it is a
       * note attached to a question.
       */
      readonly researcherReading: T | null;
      readonly note: string;
    }
  | {
      readonly status: 'counsel-confirmed';
      readonly citation: PrimarySourceCitation;
      readonly value: T;
      /** Which review record confirmed this specific field. */
      readonly confirmedByReviewId: string;
    };

export interface ReviewRecord {
  /** Stable id, referenced by StateLegalFact.confirmedByReviewId and by audit records. */
  readonly id: string;
  readonly state: string;
  /** Reviewing counsel, and their licensure in THIS state. */
  readonly reviewedBy: string;
  readonly barNumber: string;
  readonly barJurisdiction: string;
  readonly reviewedOn: string;
  /**
   * Stored rather than derived, so a reviewer can set a SHORTER expiry on a
   * state they consider unstable. REVIEW_MAX_AGE_MONTHS is the ceiling applied
   * when an entry omits one, not the rule.
   */
  readonly expiresOn: string;
  /** Which fields this review actually covers. A partial review is normal. */
  readonly coversFields: readonly string[];
  /** Whether the review covered the ORDER of durationRules, not merely their content. */
  readonly coversRuleOrder: boolean;
  readonly reviewedSchemaVersion: number;
  /** Digest over every citation reviewed; recomputed at load. */
  readonly citationsDigest: string;
  readonly notes?: string;
}

/**
 * Maximum review age.
 *
 * A STATED CONVENTION, NOT A MEASUREMENT — the same posture as
 * `BOUNDARY_STRIP_FT` in evidence-tier.ts. 24 months is short enough that a
 * legislative session cannot pass unnoticed and long enough to be affordable.
 * Argue with it here; it is not buried in a comparison somewhere.
 */
export const REVIEW_MAX_AGE_MONTHS = 24;

/** Narrowing helper. Deliberately the ONLY way the engine reads a fact. */
export function confirmedValue<T>(fact: StateLegalFact<T>): T | null {
  return fact.status === 'counsel-confirmed' ? fact.value : null;
}

/**
 * True when every citation on a confirmed fact is present and quoted.
 *
 * A `counsel-confirmed` fact with an empty `quotedText` is the paraphrase
 * failure wearing the confirmed badge, so it is caught structurally rather
 * than by review discipline.
 */
export function citationIsComplete(citation: PrimarySourceCitation): boolean {
  return (
    citation.label.trim().length > 0 &&
    /^https?:\/\//.test(citation.url) &&
    /^\d{4}-\d{2}-\d{2}$/.test(citation.fetchedOn) &&
    citation.quotedText.trim().length > 0
  );
}
