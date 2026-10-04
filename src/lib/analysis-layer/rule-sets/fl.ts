/**
 * Florida — the SECOND state, and the one that tests whether the interface was
 * an abstraction or just California with extra steps.
 *
 * THE ANSWER IS ENCOURAGING, AND THE EVIDENCE IS THAT FLORIDA DISAGREES WITH
 * CALIFORNIA ON EVERY FIELD. Different period on a different statute, the
 * reverse pattern of which implied-easement doctrine is codified, a recording
 * act that reads cleanly where California's reads ambiguously, and a
 * marketable-title act that excepts easements where the California reading
 * assumed the opposite. None of that transfers. A schema that had quietly
 * encoded California's answers would have had to be fought here, and it was
 * not.
 *
 * THIS ENTRY IS UNREVIEWED, exactly as California is. `review: null` means
 * `analyzeEasement({ state: 'FL' })` runs the document-observation rules and
 * refuses every doctrinal question. The five citations below were fetched on
 * 2026-10-04 from leg.state.fl.us and flsenate.gov — the Legislature's own
 * sites — which establishes THAT THOSE WORDS APPEAR IN THOSE SECTIONS and
 * nothing more.
 *
 * WHAT FLORIDA DOES NOT HAVE, and it is deliberate: any doctrinal duration
 * rule. California ships three presumption rules (appurtenant runs with the
 * land, prescriptive is perpetual once established, in gross may end with the
 * grantee). No primary source has been fetched for a Florida counterpart to
 * any of them, so there are none here. Mirroring California's three with `fl-`
 * ids would have cost nothing today — they cannot run while `review` is null —
 * and would have become live fiction on the day counsel signed off on three
 * rules they had never been shown. An empty doctrinal set is the honest
 * expression of "nobody has researched this yet".
 */

import { documentObservationRules } from '../document-observation-rules';
import type { ExpressDurationBasis } from '../duration-basis';
import type { StateEasementRuleSet } from '../rule-set';
import { RULE_SET_SCHEMA_VERSION } from '../rule-set';

const LEG = 'http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=';
const FETCHED = '2026-10-04';

/**
 * Florida's duration bases are the instrument-derived two and no others.
 *
 * California unions three presumption bases onto this. That Florida does not
 * is the type-level statement of the header's last paragraph: there is no
 * `perpetual-appurtenant-default` here because no Florida authority for one
 * has been read.
 */
export type FlDurationBasis = ExpressDurationBasis;

export const FL_DURATION_RULE_SET = documentObservationRules<FlDurationBasis>('fl');

export const FL_DURATION_FALLBACK = {
  tier: 'flagged-ambiguous',
  flagReason:
    'The document states no express duration, so the answer depends on what Florida law presumes ' +
    'for an easement of this character. This product has researched no Florida presumption and ' +
    'offers none. That is an absence of research, not a finding that your easement is ambiguous.',
} as const;

export const FL_RULE_SET: StateEasementRuleSet = {
  state: 'FL',
  schemaVersion: RULE_SET_SCHEMA_VERSION,

  /*
   * Unreviewed, on the same terms as California. No Florida-licensed attorney
   * has read this entry, and a ReviewRecord requires a bar number and
   * jurisdiction precisely so that fact cannot be papered over.
   *
   * Florida is worth reviewing SECOND rather than first even though its
   * citations are in better shape, because California is where the product's
   * users and county data are. The ordering argument is in
   * docs/phase-plan-3-4-5.md.
   */
  review: null,

  prescriptivePeriodYears: {
    status: 'unreviewed',
    citation: {
      label: 'Fla. Stat. §95.18',
      url: `${LEG}0000-0099/0095/Sections/0095.18.html`,
      fetchedOn: FETCHED,
      quotedText:
        '7 years under a claim of title exclusive of any other right… Paid… all outstanding taxes ' +
        'and matured installments of special improvement liens levied against the property by the ' +
        'state, county, and municipality within 1 year after entering into possession… Protected ' +
        'by substantial enclosure… Cultivated, maintained, or improved in a usual manner',
    },
    /*
     * NULL, AND THIS IS THE FIELD WHERE FLORIDA IS MOST DANGEROUS.
     *
     * California's entry carries a provisional 5, supplied by the product
     * owner. Nothing comparable has been supplied for Florida, and the
     * temptation is to reach for the number on the face of §95.18 the way the
     * California entry reached for §321. Three reasons not to:
     *
     * 1. §95.18 is ADVERSE POSSESSION — a possessory doctrine. A prescriptive
     *    easement is a right of USE. The same gap flagged on California's §321
     *    exists here, unchanged.
     * 2. The elements are worse, not better. §95.18 requires paying all
     *    outstanding taxes within one year of entry AND filing a return with
     *    the property appraiser within 30 days. Someone who merely drove over
     *    a neighbour's strip for years did neither. Reading the period off
     *    this section imports requirements that no prescriptive-easement
     *    claimant could ever meet, which would silently make the doctrine
     *    unavailable rather than merely mis-timed.
     * 3. The number differs from California's. 7 here, 5 there, on
     *    structurally parallel statutes — which is the concrete demonstration
     *    that a neighbouring state's answer is worth nothing.
     *
     * No source stating the Florida prescriptive-easement period has been
     * fetched. Null is what that looks like.
     */
    researcherReading: null,
    note:
      'Establishes that a SEVEN-year period appears in Fla. Stat. §95.18, for adverse possession ' +
      'without colour of title. It establishes nothing about prescriptive easements. ' +
      'NO PROVISIONAL READING IS OFFERED, deliberately — see the comment above this note for the ' +
      'three reasons, of which the second is the sharpest: §95.18 conditions the claim on paying ' +
      'all outstanding taxes within one year of entry and filing a return with the property ' +
      'appraiser within 30 days. Those are the acts of someone claiming to OWN the land. A ' +
      'prescriptive easement is claimed by someone who concedes the neighbour owns it and asserts ' +
      'only a right to use it, and such a claimant has never paid those taxes. Importing the ' +
      'element set with the period would not merely mis-time the doctrine, it would make it ' +
      'unsatisfiable. ' +
      'COMPARE CALIFORNIA, where CCP §321 states five years and CCP §325 attaches a parallel tax ' +
      'and enclosure requirement. Same structural problem, different number. Counsel must supply ' +
      'the operative Florida authority — which may well not be a statute at all — together with ' +
      'the element list, and must not be asked merely to confirm a number.',
  },

  impliedFromPriorUse: {
    status: 'unreviewed',
    /*
     * No source fetched. This is the MIRROR IMAGE of California, where §1104
     * codifies the quasi-easement and nothing was found for necessity. In
     * Florida the codified doctrine is necessity (§704.01, below) and prior
     * use is not addressed by it.
     *
     * The inviting mistake is therefore the same mistake in reverse: reading
     * §704.01 as covering this field because it is the easement-creation
     * section and it is right there. It does not. The module header of
     * rule-set.ts names this as the single most inviting error in the schema,
     * and Florida is where the invitation is strongest, because here the two
     * doctrines sit in adjacent statutory subsections.
     */
    citation: null,
    researcherReading: null,
    note:
      'No primary source has been fetched for implied easement from prior use — the ' +
      'quasi-easement — in Florida. ' +
      'DO NOT READ THIS OFF §704.01. That section codifies the way of NECESSITY and is cited on ' +
      'the easementByNecessity field below. The two doctrines share the word "necessity" and ' +
      'nothing else: prior use turns on an apparent, continuous use existing at severance, ' +
      'whereas necessity turns on the parcel being landlocked and requires no prior use at all. ' +
      'A state can recognise one and not the other, on different standards. ' +
      'EXACTLY INVERTED FROM CALIFORNIA, which has a fetched statute for prior use (Civ. Code ' +
      '§1104) and nothing for necessity. The two entries together are the evidence that these ' +
      'had to be separate fields: a merged field would have been half-answered in both states, ' +
      'from different halves, and would have looked complete in each.',
  },

  easementByNecessity: {
    status: 'unreviewed',
    citation: {
      label: 'Fla. Stat. §704.01(1)',
      url: 'https://www.flsenate.gov/Laws/Statutes/2024/704.01',
      fetchedOn: FETCHED,
      quotedText:
        'The common-law rule of an implied grant of a way of necessity is hereby recognized, ' +
        'specifically adopted, and clarified… a right-of-way is presumed to have been granted or ' +
        'reserved… no other reasonable and practicable way of egress, or ingress and same is ' +
        'reasonably necessary for the beneficial use or enjoyment of the part granted or reserved',
    },
    /*
     * A reading IS offered here, and the reason it is offered in Florida and
     * withheld in California is worth stating: both halves of the type are on
     * the face of the fetched statute. "Recognized, specifically adopted"
     * answers `recognised`. "Reasonably necessary for the beneficial use"
     * answers the standard. California's entry left this null because only
     * `recognised` had support and a half-filled reading reads as a complete
     * one.
     */
    researcherReading: { recognised: true, necessityStandard: 'reasonable' },
    note:
      'Florida CODIFIES the common-law way of necessity, and both halves this field requires ' +
      'appear in the fetched text: "recognized, specifically adopted" for recognition, and ' +
      '"reasonably necessary for the beneficial use or enjoyment" for the standard. That is why a ' +
      'provisional reading is offered here and was withheld in California, where only the ' +
      'recognition half had support. ' +
      'WHAT REMAINS OPEN, AND IT IS STRUCTURAL: §704.01 contains TWO doctrines, not one. ' +
      'Subsection (2) creates a STATUTORY way of necessity described in the fetched text as ' +
      '"exclusive of any common-law right", arising where land is "shut off or hemmed in by ' +
      'lands, fencing, or other improvements by other persons so that no practicable route of ' +
      'egress or ingress is available". This field models the common-law doctrine in subsection ' +
      '(1) only. The schema has no second slot, and the statutory way may carry different ' +
      'elements, a different trigger and — per the fetched text, which mentions utilities and ' +
      'cable service — a different scope of permitted use. ' +
      'WHY THAT MATTERS TO THIS PRODUCT SPECIFICALLY: a homeowner reading a report about their ' +
      'own burdened parcel is on the receiving end of a neighbour\'s access claim. Which of the ' +
      'two doctrines the neighbour is asserting changes what the homeowner must show. Counsel ' +
      'must confirm the subsection (1) reading AND say whether subsection (2) needs its own ' +
      'field before this state is turned on.',
  },

  recordingAct: {
    status: 'unreviewed',
    citation: {
      label: 'Fla. Stat. §695.01(1)',
      url: `${LEG}0600-0699/0695/Sections/0695.01.html`,
      fetchedOn: FETCHED,
      quotedText:
        'No conveyance, transfer, or mortgage of real property, or of any interest therein, nor ' +
        'any lease for a term of 1 year or longer, shall be good and effectual in law or equity ' +
        'against creditors or subsequent purchasers for a valuable consideration and without ' +
        'notice, unless the same be recorded according to law',
    },
    researcherReading: 'notice',
    note:
      'READS AS A NOTICE STATUTE ON ITS FACE, and the structural reason is worth stating because ' +
      'it is exactly what California lacks. §695.01(1) protects a subsequent purchaser who takes ' +
      '"for a valuable consideration and without notice". The recording requirement — "unless the ' +
      'same be recorded" — attaches to the EARLIER conveyance, not to the subsequent purchaser\'s ' +
      'own. Nothing in the section requires the subsequent purchaser to record first in order to ' +
      'prevail, and a recording requirement imposed on the subsequent purchaser is the ' +
      'distinguishing feature of race-notice. ' +
      'CONTRAST CALIFORNIA, where Civ. Code §1214 protects a purchaser "in good faith and for a ' +
      'valuable consideration, whose conveyance is first duly recorded" — the race-notice marker, ' +
      'in the same sentence as the notice elements, which is why that field carries a flagged ' +
      'conflict. Florida has no such clause. The two entries together establish that the ' +
      'three-way field is doing real work rather than recording a distinction without a ' +
      'difference. ' +
      'STILL UNREVIEWED, AND NOT MERELY AS A FORMALITY. Recording-act classification rests on how ' +
      'the state\'s courts have read the section, not only on the words, and no Florida case law ' +
      'has been fetched. "Reads as" is not "is". ' +
      'WHAT TURNS ON IT: whether an UNRECORDED easement binds someone who later buys the burdened ' +
      'parcel. Under notice, a buyer with actual or constructive notice takes subject to it even ' +
      'though it was never recorded — and visible infrastructure of the kind this product scans ' +
      'for is the classic source of constructive notice.',
  },

  marketableTitle: {
    status: 'unreviewed',
    citation: {
      label: 'Fla. Stat. §712.03(5)',
      url: `${LEG}0700-0799/0712/Sections/0712.03.html`,
      fetchedOn: FETCHED,
      quotedText:
        'Recorded or unrecorded easements or rights, interest or servitude in the nature of ' +
        'easements, rights-of-way and terminal facilities, including those of a public utility or ' +
        'of a governmental agency… so long as the same are used and the use of any part thereof ' +
        'shall except from the operation hereof the right to the entire use thereof',
    },
    researcherReading: { actExists: true, rootOfTitleYears: 30, easementsExcepted: true },
    note:
      'Florida has a Marketable Record Title Act and it EXCEPTS EASEMENTS, which is the decisive ' +
      'field and the one the schema comment predicted would be nuanced. ' +
      'ROOT OF TITLE: 30 years, from Fla. Stat. §712.02, fetched ' +
      `${FETCHED} at ` +
      `${LEG}0700-0799/0712/Sections/0712.02.html — "has been vested with any estate in land of ` +
      'record for 30 years or more, shall have a marketable record title… free and clear of all ' +
      'claims except the matters set forth as exceptions to marketability in s. 712.03". Cited in ' +
      'this note rather than the citation slot because the exception, not the period, is what ' +
      'decides whether an old easement survives. ' +
      'THE NUANCE, AND IT IS A CONDITION RATHER THAN A BLANKET EXCEPTION: the fetched text ' +
      'excepts these interests "so long as the same are used". An easement in active use is ' +
      'excepted and survives. What happens to a recorded easement that has NOT been used — an ' +
      'abandoned rail spur, a utility line long since rerouted — is not answered by the words ' +
      'fetched, and it is the case a homeowner is most likely to be asking about, because a ' +
      'burden nobody exercises is the one they notice only at closing. ' +
      'DIRECTION OF THE READING, AND IT IS THE OPPOSITE OF CALIFORNIA\'S. The California entry ' +
      'carries a provisional "easements are NOT excepted" — meaning old easements are wiped once ' +
      'the period runs, the outcome the burdened homeowner wants — and that entry is flagged ' +
      'twice for failing toward our own user. Florida\'s reading fails the other way: the ' +
      'easement survives, the homeowner stays burdened, and the product tells them something they ' +
      'do not want to hear. That is the direction this codebase treats as safe, so this field ' +
      'needs less scrutiny than California\'s does — but it still needs counsel, because ' +
      '"so long as the same are used" is doing work no fetch can measure.',
  },

  durationRules: FL_DURATION_RULE_SET,
  durationFallback: FL_DURATION_FALLBACK,
};
