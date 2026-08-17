/**
 * Jurisdiction lookup. One populated rule, `unsupported` for everything else.
 *
 * THE DEFAULT IS THE POINT. Returning `unsupported` is not a gap waiting to be
 * filled by a reasonable guess — it is the correct answer until someone does
 * the research the Florida rule required. The alternative, applying the
 * Florida analysis to another state, produces a request that cites a statute
 * that does not govern the custodian reading it.
 */

import { FL_FDOT_D7 } from './fl-fdot';
import type { JurisdictionLookup, RecordsRequestJurisdictionRule } from './jurisdiction-rule';

const RULES: readonly RecordsRequestJurisdictionRule[] = [FL_FDOT_D7];

/** What a new jurisdiction needs before a rule can be written for it. */
const RESEARCH_REQUIRED: readonly string[] = [
  'The state public records statute, its citation, and the date retrieved.',
  // Names no other state on purpose. A comparison here would be an invitation
  // to reuse the one researched analysis, which is the failure this whole
  // module is arranged to prevent — and a test asserts the absence.
  'Whether a value-records exemption exists at all, what it covers, and the condition under which ' +
    'it lapses. Some states have no such exemption; others exempt considerably more.',
  'Whether any non-value term is severable from that exemption, and on what basis. Assert nothing ' +
    'without one.',
  'The custodian of record for the specific district or office, verified rather than inferred.',
  'The published field semantics for the agency\'s own layers — in particular which values mean ' +
    'UNKNOWN rather than no.',
  'The fee-advance rule and any statutory response deadline.',
];

export function lookupJurisdiction(key: string): JurisdictionLookup {
  const rule = RULES.find((r) => r.key.toLowerCase() === key.trim().toLowerCase());
  if (rule !== undefined) return { status: 'supported', rule };

  return {
    status: 'unsupported',
    jurisdiction: key,
    // Deliberately says nothing about this jurisdiction's law, and names no
    // statute from any other one. A test asserts the Florida citations never
    // appear in this output.
    explanation:
      `No records-request rule has been researched for "${key}". Public records law, the existence ` +
      'and scope of any exemption for records of value, its lapse condition, fee rules and ' +
      'response deadlines are all state law and genuinely differ between jurisdictions. This ' +
      'product does not generate a request here, because a request citing the wrong authority is ' +
      'worse than no request: it tells the custodian the requester does not know the applicable ' +
      'law, and it invites a denial that is harder to appeal than a silence.',
    whatWouldBeNeeded: RESEARCH_REQUIRED,
  };
}

/** The jurisdiction keys that actually have a rule. One, at present. */
export function supportedJurisdictions(): readonly string[] {
  return RULES.map((r) => r.key);
}
