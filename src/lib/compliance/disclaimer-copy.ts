/**
 * Single source of truth for disclaimer language across all three touchpoints
 * (checkout checkbox, letter footer, send-screen banner). Per
 * docs/development-strategy-v2.md, Compliance Agent section: "reused
 * verbatim, not re-paraphrased per surface."
 *
 * IMPORTANT: this is placeholder copy, not attorney-reviewed language. It
 * exists so every touchpoint reads from one place today, and so swapping in
 * real counsel-reviewed copy later is a one-file change, not a hunt across
 * the codebase. Do not treat `version` as final — bump it and update
 * `needsComplianceSignOff` only once real sign-off happens.
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
}

export const CURRENT_DISCLAIMER: DisclaimerVersion = {
  version: 'placeholder-v1',
  needsComplianceSignOff: true,
  checkoutCheckboxText:
    'I understand this letter is generated based on my inputs and available records, is not ' +
    'a substitute for legal advice, and does not create an attorney-client relationship.',
  letterFooterText:
    'This letter reflects a good-faith understanding of the recorded easement and is not a ' +
    'legal determination. It is not a substitute for legal advice, and does not waive any ' +
    'legal right.',
  sendScreenBannerText:
    'Before you send: this letter has not been reviewed by an attorney unless you added ' +
    'attorney review below. Sending without review is a real, valid choice — it does not ' +
    'waive any right and is not held against you.',
};
