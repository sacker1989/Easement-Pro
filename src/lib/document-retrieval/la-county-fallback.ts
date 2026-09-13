import type { LaCountyFallbackData } from './types';

/**
 * Hardcoded LA County Registrar-Recorder fallback reference data, per
 * docs/development-strategy-v2.md — no vendor fully solves pre-2009 document
 * retrieval for LA County, so this static content is the fallback path for
 * every LA County address in Phase 1 MVP.
 *
 * `needsLiveVerificationBeforeLaunch` is a deliberate flag, not decoration:
 * this content must be confirmed against the Registrar-Recorder's current
 * published fees/hours/addresses before it reaches real users.
 */
export const LA_COUNTY_FALLBACK_DATA: LaCountyFallbackData = {
  recorderOffices: [
    {
      name: 'Registrar-Recorder/County Clerk — Norwalk Headquarters',
      address: '12400 Imperial Hwy, Norwalk, CA 90650',
      hours: 'Monday–Friday, 8:00am–5:00pm, excluding county holidays',
      searchRooms: [
        { room: 'Room 2207', coverage: '1958–present' },
        { room: 'Room LL001', coverage: '1850–1957' },
      ],
    },
  ],
  copyFeeSchedule: {
    certifiedFirstPage: 6,
    certifiedAdditionalPage: 3,
    firstConformedCopy: 0,
    currency: 'USD',
    notes:
      'The first conformed copy of a document is free. Certified copies cost $6 for ' +
      'the first page and $3 for each additional page.',
  },
  indexStructure: [
    'Documents recorded before 1973 are indexed in separate Grantor and Grantee indexes.',
    'From 1973 onward, the Grantor and Grantee indexes are combined into one index; ' +
      'entries for grantees are marked with an asterisk (*) to distinguish them from grantors.',
  ],
  mailRequest: {
    address: 'Registrar-Recorder/County Clerk, 12400 Imperial Hwy, Norwalk, CA 90650',
    process:
      'Submit a written request identifying the document by recording date, instrument ' +
      'number, or grantor/grantee names, along with payment for the applicable copy fee. ' +
      'Mail requests take longer to process than in-person requests at the Norwalk ' +
      'search rooms (Room 2207 or Room LL001, depending on the recording date).',
  },
  needsLiveVerificationBeforeLaunch: true,
  // Added 2026-08-22 at product direction. Note what it does and does not
  // claim: the direction given was that the data "is only as accurate as the
  // LA Registrar-Recorder office's data upkeep". That attributes the staleness
  // to the county, and it is OURS — these figures were hardcoded in Phase 1
  // from a strategy document and have never been checked against the live
  // source. Saying so plainly is the honest version, and it also tells the
  // reader the one thing they can act on: call before you drive there.
  //
  // The disclosure does NOT clear the flag. A warning that data may be wrong
  // is not a verification that it is right.
  stalenessDisclosure:
    'These office details, hours and fees were recorded when this tool was built and have NOT ' +
    'been re-checked against the Registrar-Recorder since. Counties change hours, relocate ' +
    'counters and revise fee schedules without notice, and this tool has no live connection to ' +
    'theirs. Call the office or check their website before you travel, and treat any fee here as ' +
    'an estimate rather than a quote.',
};

export function getLaCountyFallback(): LaCountyFallbackData {
  return LA_COUNTY_FALLBACK_DATA;
}
