/**
 * Single source of truth for disclaimer language across every touchpoint
 * (checkout checkbox, letter footer, send-screen banner, paid-advice header).
 * Per docs/development-strategy-v2.md, Compliance Agent section: "reused
 * verbatim, not re-paraphrased per surface."
 *
 * STILL PLACEHOLDER COPY, STILL UNREVIEWED. `needsComplianceSignOff` remains
 * true. v2 implements three product requirements given on 2026-08-22 — the
 * letter states it is not from an attorney, states that the homeowner is its
 * author and sender, and the paid output is framed as recommendations rather
 * than a legal opinion. Those are sensible and they narrow the exposure.
 *
 * WHAT THEY DO NOT DO, AND THIS IS THE PART TO TAKE TO COUNSEL. Cal. Bus. &
 * Prof. Code §6400(c) defines a legal document assistant as "any person who is
 * not exempted under Section 6401 and who provides, or assists in providing,
 * or offers to provide, or offers to assist in providing, for compensation,
 * any self-help service to a member of the public who is representing
 * themselves in a legal matter" (fetched 2026-08-22).
 *
 * That definition turns on COMPENSATION plus SELF-HELP SERVICE plus a
 * SELF-REPRESENTED person. It does not turn on whether the provider disclaims
 * attorney status — disclaiming it is what an LDA does, not what exempts one.
 * So the copy below may place this product squarely inside the LDA regime
 * rather than outside it, and that regime requires REGISTRATION AND A BOND,
 * which no disclaimer substitutes for. §6401's exemption list has not been
 * fetched and is the specific next question.
 *
 * Two distinct questions for counsel, easily collapsed and different:
 *   1. Is the output "self-help service" within §6400(d), or does it cross
 *      into legal advice, which no registration authorises?
 *   2. If it is within §6400(d), must this product register as an LDA?
 */

export interface DisclaimerVersion {
  version: string;
  needsComplianceSignOff: true;
  /** Shown next to the checkout consent checkbox (Track 1 only). */
  checkoutCheckboxText: string;
  /** Base disclaimer text shared by every letter footer, regardless of track. */
  letterFooterText: string;
  /** Shown as a non-dismissible banner on the send screen, before the send action. */
  sendScreenBannerText: string;
  /**
   * Stated on the letter itself. Separate from the footer because it is a
   * statement about WHO WROTE THIS, which a reader weighs differently from a
   * limitation on what it means.
   */
  notFromAttorneyText: string;
  /**
   * The authorship position: the homeowner is the author and sender, and the
   * product prepared a draft at their direction. This is what the letter
   * asserts about itself, and it is also a factual claim the product must
   * actually honour — nothing is ever sent on a user's behalf.
   */
  authorshipText: string;
  /** Header for any paid analytical output. Recommendations, not an opinion. */
  recommendationsNotOpinionText: string;
  /**
   * Required on EVERY communication provided to the homeowner, not only on
   * letters they send. The report, the recommendations, the referral package
   * and any email are all communications, and the product direction of
   * 2026-08-22 is that each states it is not legal counsel. A test asserts
   * every surface carries it, because "we put it on the letter" is exactly how
   * the other surfaces get missed.
   */
  notLegalCounselText: string;
}

export const CURRENT_DISCLAIMER: DisclaimerVersion = {
  version: 'placeholder-v2',
  needsComplianceSignOff: true,
  checkoutCheckboxText:
    'I understand this letter is generated from my inputs and available records, that it is ' +
    'not written by an attorney and is not legal advice, that I am its author and the person ' +
    'sending it, and that it does not create an attorney-client relationship.',
  letterFooterText:
    'This letter was prepared by its sender using a records-research tool. It is not written ' +
    'by an attorney, is not legal advice, and is not a legal determination. It reflects a ' +
    'good-faith understanding of the public records described above and waives no legal right.',
  sendScreenBannerText:
    'Before you send: this letter is yours. It has not been reviewed by an attorney unless you ' +
    'added attorney review below, and this tool will not send it for you — you send it. ' +
    'Sending without review is a real, valid choice; it does not waive any right and is not ' +
    'held against you.',
  notFromAttorneyText:
    'NOT WRITTEN BY AN ATTORNEY. No attorney has reviewed this letter or advised on it, and no ' +
    'attorney-client relationship exists with the service that prepared it.',
  authorshipText:
    'This letter is sent by the property owner named below, who is its author. A records-research ' +
    'tool prepared the draft at their direction from public records; it does not represent them ' +
    'and does not act for them.',
  recommendationsNotOpinionText:
    'WHAT FOLLOWS IS A SET OF RECOMMENDATIONS, NOT A LEGAL OPINION. It describes what public ' +
    'records show and what steps are commonly taken next. It does not tell you what your rights ' +
    'are, what the law requires in your situation, or what outcome you should expect. Those are ' +
    'legal questions, and only an attorney licensed in your state can answer them.',
  notLegalCounselText:
    'NOT LEGAL COUNSEL. Nothing provided to you by this service — this document, any letter ' +
    'prepared for you, any report, recommendation or message — is legal counsel, and no ' +
    'attorney-client relationship is created by using it. Only an attorney licensed in your ' +
    'state can advise you on your rights.',
};
