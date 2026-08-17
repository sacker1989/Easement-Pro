/**
 * The one populated rule: Florida DOT District 7.
 *
 * Every value here is transcribed from `docs/records-request-fdot-d7.md`,
 * which was built by actually scanning 1,558 FDOT ArcGIS services and reading
 * the statute — not by generalising a letter. Nothing in this file was
 * inferred from another state.
 *
 * DO NOT COPY THIS FILE FOR ANOTHER JURISDICTION. Public records law, whether
 * a value-records exemption exists at all, its lapse condition, fee rules and
 * response deadlines are state law and genuinely differ. A generated request
 * citing the wrong statute is worse than no request: it tells the custodian
 * the requester does not know their own law, and it invites a denial that is
 * harder to appeal than a silence.
 */

import type { RecordsRequestJurisdictionRule } from './jurisdiction-rule';

export const FL_FDOT_D7: RecordsRequestJurisdictionRule = {
  key: 'FL/FDOT-D7',
  statute: {
    cite: 'Chapter 119, Florida Statutes',
    name: 'Florida Public Records Act',
    retrievedOn: '2026-08-02',
  },
  custodian: {
    name: 'Florida Department of Transportation, District 7 — Office of General Counsel',
    email: 'D7prcustodian@dot.state.fl.us',
    phone: '813-975-6044',
    address: '11201 N. McKinley Drive, MS 7-120, Tampa, FL 33612-6403',
    portalUrl: 'FDOT Customer Service Portal',
    verifiedOn: '2026-08-02',
  },
  valueRecordExemption: {
    cite: 'Sec. 119.0711, F.S.',
    covers: 'appraisals, other reports relating to value, offers, and counteroffers',
    lapsesWhen:
      'a valid option contract is executed or a written offer to sell is conditionally accepted; ' +
      'the exemption also expires at the conclusion of condemnation litigation where no option ' +
      'contract is executed',
    // The argument that makes Item 1 answerable even where Item 2 is refused.
    // It is not a general principle: it holds because duration is a term of
    // the instrument, and the exemption enumerates records OF VALUE.
    severabilityArgument:
      'The duration of an easement is a term of the instrument rather than an appraisal, a report ' +
      'relating to value, an offer, or a counteroffer, so Sec. 119.0711 does not appear to reach it.',
  },
  targeting: {
    describeGroupA: 'acquisition shown complete by the Department\'s own ACQUIRED flag',
    describeGroupB:
      'right-of-way certified — a populated certification date, which is strong evidence the ' +
      'process concluded but is not the Department\'s own completion flag',
    fieldSemantics: [
      {
        field: 'ACQUIRED',
        value: 'COMPLETE',
        meaning: 'complete',
        note:
          'The Department\'s own completion flag. In the scanned layers only parcels 705A and 705B ' +
          '(CSX Transportation) read COMPLETE.',
      },
      {
        field: 'ACQUIRED',
        value: 'N/A',
        meaning: 'unknown',
        // The trap, encoded. This is the single most consequential line in the file.
        note:
          'The literal string "N/A" is NOT an acquisition status. It maps to unknown, not to no. ' +
          'Reading it as a negative would discard twelve ROW-certified parcels; reading it as a ' +
          'positive would target in-progress acquisitions and get the request denied.',
      },
      {
        field: 'ACQUIRED',
        value: '',
        meaning: 'in-progress',
        note:
          'Empty across all 27 records of the Pasco Segment_2a_ROW_Status and Seg_2B_ROW_Status ' +
          'layers, alongside an empty ACQ_DATE. Those acquisitions are in progress and the ' +
          'exemption has not lapsed — this is the targeting an earlier draft used and that was ' +
          'superseded for exactly this reason.',
      },
    ],
  },
  enforcementNotice: {
    cite: 'Sec. 119.12, F.S.',
    purpose:
      'Written notice identifying the public record request, given to the agency\'s custodian at ' +
      'least 5 business days before a civil action is filed, is a PRECONDITION TO RECOVERING ' +
      'attorney fees and enforcement costs if a court later determines the agency unlawfully ' +
      'refused access. It does not compel production, it does not start litigation, and it is not ' +
      'a demand. It preserves an option that cannot be recovered afterwards.',
    noticePeriod:
      'At least 5 business days. The period begins on the day the custodian RECEIVES the notice, ' +
      'excluding Saturday, Sunday and legal holidays.',
    mustIdentify: 'the public record request',
    recipient: 'the agency\'s custodian of public records',
    // Never omitted from a rendered notice. The same section that offers fees
    // takes them the other way, and a user who sees only the upside is being
    // shown half a statute.
    counterRisk:
      'The same section runs both ways. If a court determines the records were requested for an ' +
      'IMPROPER PURPOSE, it may not award the requester anything and SHALL award the agency its ' +
      'reasonable costs and attorney fees against the requester.',
    businessDaysRequired: 5,
  },
  withholdingAsks: [
    'Provide the records for the parcels where the exemption does not apply — Group A in particular.',
    'State the statutory basis for any withholding, as Sec. 119.07(1)(e) requires.',
    'Tell me what identifier to cite to request the withheld records once the exemption lapses.',
  ],
  feeAdvanceRule:
    'Please advise of any charge before incurring it if the total would exceed the stated ceiling. ' +
    'A spreadsheet listing term and amount per parcel is preferable to copies of the underlying ' +
    'instruments if that is cheaper or faster.',
  responseDeadlineRule:
    'Chapter 119 requires a response in good faith and a reasonable time; it sets no fixed day count.',
};

/**
 * The parcels the worked example identified, kept as a fixture rather than
 * hardcoded into the builder.
 *
 * 14 ROW-certified TCE parcels across two District 7 layers, 8 privately
 * owned, areas 129–44,686 sq ft published directly in AREA_SF / AREA_SQFT.
 * Only 705A and 705B carry ACQUIRED = COMPLETE.
 */
export const FL_FDOT_D7_WORKED_PARCELS = {
  layers: ['Segment3ROWParcels', 'US301_Parcels'],
  arcgisOrg: 'O1JpcwDW8sjYuddV',
  servicesScanned: 1558,
  groupA: ['705A', '705B'],
  note:
    'Group A rests on ACQUIRED = COMPLETE and a right-of-way certification date of 2023-12-31. ' +
    'Group B rests on certification dates between 2022-10-20 and 2024-10-31.',
  supersededTargeting:
    'An earlier draft aimed at the Pasco Segment_2a_ROW_Status / Seg_2B_ROW_Status TCE parcels. ' +
    'ACQUIRED and ACQ_DATE are empty across all 27 records there, so those acquisitions are in ' +
    'progress and the exemption has not lapsed.',
  whyOnlyTwoItems:
    'Parcel identity, owner, encumbered area and ROW certification date are all published in the ' +
    'Department\'s own layers. Term and compensation are the only two inputs that are not.',
} as const;
