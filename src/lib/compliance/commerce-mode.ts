/**
 * Whether this product may take money. It may not.
 *
 * THE DECISION, 2026-10-04: ship free until counsel review completes. No
 * charging, no payment surface, no paid tier offered.
 *
 * WHY IT WORKS, AND EXACTLY HOW FAR. Cal. Bus. & Prof. Code §6400(c) defines a
 * legal document assistant as a person who provides "or offers to provide ...
 * FOR COMPENSATION, any self-help service to a member of the public who is
 * representing themselves in a legal matter" (fetched 2026-08-22). Compensation
 * is an element of the definition, not an aggravating factor. Remove it and the
 * definition is not met, which removes the registration and bonding
 * requirements of §6400 et seq. along with it. That is a real reduction in
 * exposure and it is the reason for this switch.
 *
 * WHAT IT DOES NOT DO, AND THIS MUST NOT BE MISREAD. Unauthorized practice of
 * law is a SEPARATE prohibition with no compensation element. §6125, fetched
 * 2026-10-04, reads in full: "No person shall practice law in California unless
 * the person is an active licensee of the State Bar." Nothing there turns on
 * payment, and §6126 makes unlicensed practice a misdemeanour. Going free
 * therefore narrows the open question from "may we sell this" to "is what we
 * produce the practice of law at all" — which is a better question to be left
 * with, and is still open.
 *
 * The product's answer to that narrower question is its existing posture, and
 * it is now the load-bearing one: this tool reports what public records say and
 * refuses to interpret rights. The observation/doctrine split in the analysis
 * layer is the clearest expression of it — a rule that reads an instrument runs
 * everywhere, a rule that applies state doctrine runs only where counsel has
 * reviewed it.
 *
 * "OFFERS TO PROVIDE" IS IN THE DEFINITION TOO. That is why this gate covers
 * the offer surface and not merely the charge. A free product that advertises a
 * coming paid tier, takes pre-orders, collects cards for later, or pushes an
 * upgrade is still OFFERING to provide for compensation. Free has to mean free,
 * including the absence of a sales pitch for the paid thing.
 *
 * TO REVERSE THIS you change a constant in a file whose comment explains what
 * you are taking on. That is deliberate: an environment variable can be set
 * wrong in one environment by someone who never read any of this, and the
 * failure would be silent and billable.
 */

export const COMMERCE_ENABLED = false as boolean;

/** Recorded so the reversal is a decision against stated conditions. */
export const COMMERCE_REENABLE_CONDITIONS: readonly string[] = [
  'Written opinion from a California-admitted attorney on whether the Track 1 output is the ' +
    'practice of law under §6125 — which free mode narrows the question to, and does not answer.',
  'If it is self-help service rather than legal advice, a determination on whether LDA ' +
    'registration and bonding under §6400 et seq. is required once compensation resumes.',
  'Compliance sign-off on the disclaimer, which is still placeholder copy.',
  'A durable audit store configured for the deployment, since paid artefacts are the ones most ' +
    'likely to be asked about later.',
];

export class CommerceDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommerceDisabledError';
  }
}

/** Shown to a user who reaches a payment surface. */
export const COMMERCE_DISABLED_MESSAGE =
  'This service is free while it is under legal review, and nothing here can be purchased. No ' +
  'payment details are collected and no charge is possible. Everything the tool can do is ' +
  'available to you at no cost.';

/**
 * Throws unless commerce is enabled.
 *
 * Takes no override. A guard with a bypass parameter is a guard that gets
 * bypassed, and this one sits in front of the only path that can charge a card.
 */
export function assertCommerceEnabled(context: string): void {
  if (COMMERCE_ENABLED) return;
  throw new CommerceDisabledError(
    `Refusing to ${context}: this product is operating in free mode pending counsel review. ` +
      'Compensation is an element of the legal-document-assistant definition in Cal. Bus. & Prof. ' +
      'Code §6400(c), so taking payment would re-open a question that free operation closes. ' +
      'See COMMERCE_REENABLE_CONDITIONS before changing this.',
  );
}

/** True when a paid tier may be advertised. Same answer, different question. */
export function mayOfferPaidTier(): boolean {
  // Deliberately the same flag. "Offers to provide ... for compensation" is in
  // the §6400(c) definition, so advertising a paid tier while free is not a
  // safe middle position — it is the offer the definition names.
  return COMMERCE_ENABLED;
}
