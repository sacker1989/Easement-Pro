import {
  stateTier,
  resolveStateCompliance,
  type StateComplianceEntry,
  type StateComplianceMatrix,
} from '@/lib/gating/state-tier-config';
import type { RegulatoryBasis } from '@/lib/gating/regulatory-basis';

/**
 * The single populated state-compliance matrix for the whole app. Phase 1
 * MVP ships with California as the only Tier A entry — per
 * docs/development-strategy-v2.md: "no state beyond CA should be enabled for
 * Track 1 until [counsel] review is done."
 *
 * Adding a state later should mean adding an entry here, not touching gating
 * logic elsewhere in the app.
 */

/**
 * The regime California's Tier A classification was written against.
 *
 * NO LONGER REACHES THIS PRODUCT, as of the free-mode decision on 2026-10-04.
 * The entry kept it rather than deleting it, because an audit record written
 * before that date names this statute and a reader needs to find it. Deleting
 * a basis makes the history unreadable; marking it lapsed does not.
 */
const CA_LDA_BASIS: RegulatoryBasis = {
  citation: 'Cal. Bus. & Prof. Code §6400 et seq.',
  regime: 'document-assistant',
  compensationIsAnElement: true,
  hasCompliancePath: true,
  note:
    '§6400(c) defines a legal document assistant as a person who provides "or offers to provide ' +
    '... for compensation, any self-help service to a member of the public who is representing ' +
    'themselves in a legal matter" (fetched 2026-08-22). Compensation is an element of the ' +
    'DEFINITION rather than an aggravating factor, so a product that charges nothing is not ' +
    'within it and the registration and bonding requirements do not attach. ' +
    'THE COMPLIANCE PATH EXISTS HERE, which is what made this the less serious of the two: ' +
    'register, post a bond, operate. Note "or offers to provide" — advertising a paid tier while ' +
    'free would put the product back inside this definition without a single charge being made, ' +
    'which is why mayOfferPaidTier() reads the same flag as the charge gate.',
};

/**
 * The regime that was always there, was never the stated basis, and is now the
 * only one operating.
 *
 * Recorded explicitly because its absence from this entry was itself the
 * defect. A reader of the old single-string basis would have concluded that
 * California's Track 1 question was an LDA-registration question. It never
 * only was.
 */
const CA_UPL_BASIS: RegulatoryBasis = {
  citation: 'Cal. Bus. & Prof. Code §6125',
  regime: 'unauthorized-practice',
  compensationIsAnElement: false,
  hasCompliancePath: false,
  note:
    'Fetched 2026-10-04, in full: "No person shall practice law in California unless the person ' +
    'is an active licensee of the State Bar." Nothing in it turns on payment, and §6126 makes ' +
    'unlicensed practice a misdemeanour. Free mode therefore does nothing to this basis. ' +
    'NO COMPLIANCE PATH SHORT OF BEING A LAWYER — there is no registration, bond or filing that ' +
    'authorises a non-attorney, which is why this is the harder of the two regimes even though ' +
    'it is the one that was never written down. The open question it leaves is narrower than the ' +
    'one free mode closed: not "may we sell this" but "is what we produce the practice of law at ' +
    'all". The product\'s answer is its existing posture — report what public records say, refuse ' +
    'to interpret rights — and the observation/doctrine split in the analysis layer is where that ' +
    'posture is enforced rather than merely asserted.',
};

export const STATE_COMPLIANCE_MATRIX: StateComplianceMatrix = {
  CA: {
    state: 'CA',
    tier: stateTier('A'),
    track1RequiredFlow: 'licensed-pathway',
    track2Available: true,
    /*
     * BOTH, AND THE ORDER IS LAPSED-THEN-OPERATIVE DELIBERATELY. A reader
     * scanning this entry should see the statute the tier was written against
     * before the statute that now governs, because that is the order in which
     * the two became relevant and it is the order the audit records read in.
     */
    basis: [CA_LDA_BASIS, CA_UPL_BASIS],

    /*
     * STILL NULL ON 2026-10-05, AND THE REASON IS THE SAME ONE THE ANALYSIS
     * LAYER GIVES FOR CA_RULE_SET.review.
     *
     * The product owner directed on this date that counsel for California
     * allows open-ended research and advice from the product. That direction
     * is recorded below, in full, because it tells whoever commissions the
     * opinion what is expected and it changes what this product is being built
     * toward.
     *
     * IT CANNOT BE WRITTEN HERE, and the obstruction is structural rather than
     * procedural. A UplReviewRecord requires `reviewedBy`, `barNumber` and
     * `reviewedOn`. Those are facts about a specific California attorney on a
     * specific day, and nobody has supplied them. Filling them with plausible
     * values would manufacture the exact artifact this gate exists to demand,
     * and the gate would then be satisfied by its own forgery — in a record
     * that lands in the audit trail of every letter, where a regulator or a
     * court would read it as a representation that a named lawyer signed off.
     *
     * SO THE DIRECTION IS NOT BEING REFUSED, IT IS BEING ROUTED. Everything
     * the direction implies is built: the scope type carries
     * `openEndedResearch` and `advice` as first-class fields, the gate reads
     * them, and `uplDirection` below states exactly which four facts turn this
     * into an authorisation. Supplying them is a data edit in this file.
     */
    uplReview: null,

    uplDirection: {
      on: '2026-10-05',
      expectedScope: {
        reportsPublicRecords: true,
        openEndedResearch: true,
        advice: true,
        /*
         * NOT SET TRUE, AND IT IS THE ONE THE DIRECTION DID NOT NAME.
         *
         * "Open-ended research and advice" are statements made TO the user.
         * A Track 1 letter is different in kind: it is correspondence sent to
         * a utility or an agency, asserting a position on the homeowner's
         * behalf. Advice that turns out to be wrong leaves the homeowner
         * where they started; a letter that asserts a wrong position has
         * already been sent, and it is the artefact a §6125 complaint would
         * attach.
         *
         * Reading it in from the two that were named would widen the scope
         * beyond what the direction said, in the direction that is hardest to
         * undo. Left false until an opinion addresses it specifically.
         */
        positionAssertingLetters: false,
      },
      statedAs:
        'Product owner, 2026-10-05: "Assume the counsel for California allows for open ended ' +
        'research and advice from the product."',
      missing: [
        'The reviewing attorney\'s name.',
        'Their California bar number.',
        'The date the opinion was given.',
        'Whether the opinion addresses position-asserting correspondence (Track 1 letters), ' +
          'which the direction did not mention and which is not implied by research or advice.',
      ],
    },
    notes:
      "Phase 1 MVP's only Tier A entry. lastReviewedDate must be set once counsel " +
      'sign-off is actually recorded — do not treat this entry as reviewed until then. ' +
      'OPEN COMPLIANCE GAP CA-TRACK1-UNREVIEWED: Track 1 is offered here anyway. No ' +
      'grandfather clause exists to borrow — searched 2026-08-16. See ' +
      'src/lib/gating/compliance-gaps.ts. ' +
      'UPDATED 2026-10-04 FOR FREE MODE: the tier itself is unchanged and no gate moved. What ' +
      'changed is that §6400 stopped reaching this product, so "licensed-pathway" no longer ' +
      'describes a requirement anyone is under — LDA registration is not required of a free ' +
      'service. The flow value is retained rather than rewritten because changing it would alter ' +
      'gating behaviour, and the reason to change it would be a counsel opinion, not a pivot in ' +
      'the business model. §6125 is now the operative basis and it is unaffected by going free.',
  },
};

export function getStateCompliance(stateCode: string): StateComplianceEntry {
  return resolveStateCompliance(STATE_COMPLIANCE_MATRIX, stateCode);
}
