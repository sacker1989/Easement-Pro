import type { LaCountyFallbackData } from './types';

/**
 * LA County Registrar-Recorder reference data, per
 * docs/development-strategy-v2.md — no vendor fully solves pre-2009 document
 * retrieval for LA County, so this is the fallback path for every LA County
 * address.
 *
 * VERIFIED AGAINST THE COUNTY ON 2026-10-05, for the first time since it was
 * hardcoded from a strategy document in Phase 1. Three things were wrong, and
 * all three would have cost a homeowner something real:
 *
 * 1. THE FEE A USER OF THIS PRODUCT ACTUALLY PAYS WAS MISSING. The record
 *    carried `firstConformedCopy: 0` and a note saying "the first conformed
 *    copy of a document is free". That is true — for the person RECORDING a
 *    document, who gets their own instrument back conformed. This product
 *    serves the opposite party: a homeowner asking for a copy of an easement
 *    someone else recorded decades ago. They pay $5 for a plain copy or $6
 *    certified. The tool was telling them it was free.
 * 2. VIEWING IS NOW BY APPOINTMENT, up to two weeks ahead. The old record told
 *    people to walk into Room 2207 or LL001. Someone would have driven to
 *    Norwalk and been turned away — which is precisely the harm the staleness
 *    disclosure warned about in the abstract, found to be concrete.
 * 3. The lower-level coverage started in 1851, not 1850, and the search fee
 *    ($0.50 per name per year, $1 minimum) was absent entirely. A mail request
 *    hits that fee and the old record implied it would not.
 *
 * WHAT WAS RIGHT: the Norwalk address, the hours, Room 2207 for 1958-present,
 * and both certified-copy figures. So the Phase 1 data was mostly sound, which
 * is exactly why it survived unverified for so long — nothing about it looked
 * wrong.
 *
 * THE DISCLOSURE STAYS, and it is now a different claim. It used to say this
 * data had never been checked. It now says when it was checked and that the
 * county can change anything the next morning without telling anyone. Both are
 * reasons to call ahead; only the second is still true.
 */
export const LA_COUNTY_FALLBACK_DATA: LaCountyFallbackData = {
  recorderOffices: [
    {
      name: 'Registrar-Recorder/County Clerk — Norwalk Headquarters',
      address: '12400 Imperial Hwy, Norwalk, CA 90650',
      hours: 'Monday–Friday, 8:00am–5:00pm, excluding county holidays',
      searchRooms: [
        {
          room: 'Room 2207 (2nd floor)',
          coverage: '1958–present. BY APPOINTMENT — schedule up to two weeks ahead.',
        },
        {
          room: 'Lower level',
          coverage: '1851–1957. BY APPOINTMENT — schedule up to two weeks ahead.',
        },
      ],
    },
  ],
  copyFeeSchedule: {
    certifiedFirstPage: 6,
    certifiedAdditionalPage: 3,
    // The figures a homeowner researching an existing easement actually pays.
    plainFirstPage: 5,
    plainAdditionalPage: 3,
    // Kept, and kept honest: this is a recording-time benefit, not a
    // records-request one. It is the field that previously stood in for the
    // two above and told users the wrong thing.
    firstConformedCopy: 0,
    searchFeePerNamePerYear: 0.5,
    searchFeeMinimum: 1,
    currency: 'USD',
    notes:
      'To obtain a copy of an easement already on record: $5 for the first page plain, or $6 ' +
      'certified, plus $3 per additional page either way. A search fee of $0.50 per name per ' +
      'year searched also applies, with a $1 minimum — so a request that does not name an exact ' +
      'instrument number and recording date costs more than the copy fee alone. Credit-card ' +
      'orders carry a $1.75 handling fee and expedited mail is $18.50. ' +
      'THE FREE FIRST CONFORMED COPY IS NOT THIS. That applies to the party recording a new ' +
      'document, who gets their own instrument returned conformed at no charge. A homeowner ' +
      'asking for someone else\'s recorded easement is not that party and should budget for the ' +
      'figures above.',
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
      'number, or grantor/grantee names, along with payment for the applicable copy fee and ' +
      'any search fee. Naming the instrument number and recording date avoids the per-name, ' +
      'per-year search charge, so it is worth finding those first. Mail requests take longer ' +
      'than an in-person visit, and an in-person visit now requires an appointment. ' +
      'Real estate records: recorder@rrcc.lacounty.gov, or (800) 201-8999 option 3.',
  },
  verifiedOn: '2026-10-05',
  verifiedAgainst: [
    'https://www.lavote.gov/home/recorder/real-estate-records/real-estate-records-request/fees',
    'https://www.lavote.gov/contact-us/branch-office-locations',
    'https://www.lavote.gov/home/recorder/real-estate-records/viewing-real-estate-records/view-real-estate-records',
  ],
  stalenessDisclosure:
    'These office details, hours and fees were checked against the Registrar-Recorder on ' +
    '5 October 2026. Counties change hours, move counters, revise fee schedules and alter ' +
    'appointment rules without notice, and this tool has no live connection to theirs — the ' +
    'last check found three figures here that had gone out of date. Call the office or check ' +
    'their website before you travel, book an appointment rather than turning up, and treat ' +
    'every fee here as an estimate rather than a quote.',
};

export function getLaCountyFallback(): LaCountyFallbackData {
  return LA_COUNTY_FALLBACK_DATA;
}
