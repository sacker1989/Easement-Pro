/**
 * California — the REFERENCE IMPLEMENTATION OF THE SHAPE, and an UNREVIEWED
 * state.
 *
 * READ THIS BEFORE ASSUMING CALIFORNIA WORKS. Applied honestly, this entry has
 * `review: null`, which means `analyzeEasement({ state: 'CA' })` degrades to
 * `flagged-ambiguous` exactly as Texas does. That is not an oversight and it is
 * not a TODO. The existing compliance matrix sets CA to Tier A with
 * `lastReviewedDate: null` and nothing reads that field, so the tier asserts a
 * review that never happened. Phase 3 exists so that shape cannot recur, and
 * the first thing it costs is California's own substantive output.
 *
 * WHAT IS AND IS NOT ESTABLISHED HERE. The four citations below were fetched
 * from leginfo.legislature.ca.gov, the official source, and re-verified against
 * the live text. That establishes THAT THOSE WORDS APPEAR IN THOSE SECTIONS. It
 * establishes nothing else. Each `note` states what the fetch did not settle,
 * because that gap is the reviewer's actual job.
 *
 * THE RULES THEMSELVES ARE UNCHANGED. `CA_DURATION_RULE_SET` is imported from
 * ca-rule-set.ts rather than copied here, so the existing suite continues to
 * exercise the same array this entry ships. The spec calls for the array to be
 * moved; composing it instead keeps one definition and one set of tests, which
 * is the point the move was serving.
 */

import { CA_DURATION_FALLBACK, CA_DURATION_RULE_SET } from '../ca-rule-set';
import type { StateEasementRuleSet } from '../rule-set';
import { RULE_SET_SCHEMA_VERSION } from '../rule-set';

const LEGINFO = 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml';

export const CA_RULE_SET: StateEasementRuleSet = {
  state: 'CA',
  schemaVersion: RULE_SET_SCHEMA_VERSION,
  // The whole point of the phase. No review record exists, so no substantive
  // conclusion may issue for California either.
  review: null,

  prescriptivePeriodYears: {
    status: 'unreviewed',
    citation: {
      label: 'Cal. Code Civ. Proc. §321',
      url: `${LEGINFO}?lawCode=CCP&sectionNum=321`,
      fetchedOn: '2026-08-22',
      quotedText:
        'the property has been held and possessed adversely to such legal title, for five years ' +
        'before the commencement of the action',
    },
    // Deliberately null. A five-year figure sitting in a field the engine can
    // reach is exactly the accident this type exists to prevent.
    researcherReading: null,
    note:
      'Establishes that a five-year adverse-possession period appears in CCP §321. It does NOT ' +
      'establish that §321 — rather than §318, §319 or §325 — supplies the period for a ' +
      'prescriptive EASEMENT, nor what elements must run for that period. That chain is what a ' +
      'reviewer confirms and a fetch cannot.',
  },

  impliedFromPriorUse: {
    status: 'unreviewed',
    citation: {
      label: 'Cal. Civ. Code §1104',
      url: `${LEGINFO}?lawCode=CIV&sectionNum=1104`,
      fetchedOn: '2026-08-22',
      quotedText:
        'A transfer of real property passes all easements attached thereto, and creates in favor ' +
        'thereof an easement to use other real property… in the same manner and to the same ' +
        'extent as such property was obviously and permanently used… at the time when the ' +
        'transfer was agreed upon or completed',
    },
    researcherReading: null,
    note:
      'The statute states a standard of OBVIOUS AND PERMANENT USE. Re-verified against the live ' +
      'text: the word "necessity" does not appear in §1104 at all. Whether California applies a ' +
      'strict or reasonable necessity standard to this doctrine is therefore not on the face of ' +
      'the statute and must not be inferred from it.',
  },

  easementByNecessity: {
    status: 'unreviewed',
    // No source has been fetched for this doctrine. Null citation and null
    // reading is the correct expression of that, and the registry must be able
    // to carry it without a placeholder standing in.
    citation: null,
    researcherReading: null,
    note:
      'No primary source has been fetched for easement by necessity in California. It is a ' +
      'DISTINCT doctrine from implied easement from prior use above — it turns on landlocking ' +
      'rather than on a pre-existing apparent use — and the two must not be answered from one ' +
      'source.',
  },

  recordingAct: {
    status: 'unreviewed',
    citation: {
      label: 'Cal. Civ. Code §1214',
      url: `${LEGINFO}?lawCode=CIV&sectionNum=1214`,
      fetchedOn: '2026-08-22',
      quotedText:
        'void as against any subsequent purchaser or mortgagee of the same property, or any part ' +
        'thereof, in good faith and for a valuable consideration, whose conveyance is first duly ' +
        'recorded',
    },
    researcherReading: null,
    note:
      'BOTH a good-faith-and-value element and a first-to-record element appear in the same ' +
      'sentence, re-verified against the live text. That is what makes the three-way race / ' +
      'notice / race-notice classification a counsel question rather than a reading exercise, and ' +
      'it is the field this project got wrong on a first pass. No value is written here.',
  },

  marketableTitle: {
    status: 'unreviewed',
    citation: {
      label: 'Cal. Civ. Code §880.020',
      url: `${LEGINFO}?lawCode=CIV&sectionNum=880.020`,
      fetchedOn: '2026-08-22',
      quotedText:
        'Real property is a basic resource of the people of the state and should be made freely ' +
        'alienable and marketable to the extent practicable',
    },
    researcherReading: null,
    note:
      'Confirms California has a Marketable Record Title Act and states its policy. Says nothing ' +
      'about the root-of-title period, and nothing about whether easements are excepted from ' +
      'extinguishment — which is the decisive question for this product. Those live in other ' +
      'sections of the article that were NOT fetched.',
  },

  durationRules: CA_DURATION_RULE_SET,
  durationFallback: CA_DURATION_FALLBACK,
};
