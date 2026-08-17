/**
 * Renders a draft records request from a rule plus targeted parcels.
 *
 * THE PRODUCT NEVER SENDS ANYTHING. There is no email call, no portal
 * submission, and no function here that could acquire one without being
 * obvious in review. Every draft carries `status: 'draft-not-sent'` and the
 * banner, in the same terms the worked example uses: the user reviews it and
 * sends it themselves. Correspondence to a government agency in someone's name
 * is theirs to send.
 *
 * WHAT SURVIVES FROM THE WORKED EXAMPLE, and why each part is load-bearing:
 *
 *   - The Group A / Group B split, so a partial denial does not sink the whole
 *     request. A is the agency's own completion flag; B rests on a populated
 *     certification date.
 *   - Item 1 (term) requested INDEPENDENTLY of Item 2 (compensation), on the
 *     rule's severability argument. Where a jurisdiction has no such argument
 *     researched, the split is not asserted — claiming severability without a
 *     basis invites the denial it was meant to avoid.
 *   - The three withholding asks: partial production, statutory basis, and the
 *     identifier to cite once the exemption lapses.
 *   - A fee ceiling and a stated preference for a spreadsheet over copies of
 *     instruments, which is cheaper to fulfil and therefore likelier answered.
 *   - A narrow ask. Parcel identity, owner, encumbered area and certification
 *     date are already published; asking for them again invites a fee dispute.
 */

import { buildSendAuditRecord, type SendAuditRecord } from '@/lib/compliance/audit-record';
import type { StateComplianceEntry } from '@/lib/gating/state-tier-config';
import { lookupJurisdiction } from './registry';
import {
  classifyParcel,
  type ClassifiedParcel,
  type ParcelEvidence,
  type RecordsRequestJurisdictionRule,
  type UnsupportedJurisdiction,
} from './jurisdiction-rule';

/**
 * Verbatim in every draft. The wording is the worked document's, because the
 * point it makes is the same one: nothing is outstanding except sending it,
 * and sending it is the user's decision.
 */
export const NOT_SENT_BANNER =
  'STATUS: NOT SENT. This is a draft for you to review and send yourself. This product has no ' +
  'ability to file it, and sending correspondence to a government agency in your name is your ' +
  'decision, not this tool\'s.';

export class RecordsRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordsRequestError';
  }
}

export interface RequestItem {
  readonly number: number;
  readonly title: string;
  readonly text: string;
  /** True for the item the severability argument protects. */
  readonly severableFromValueExemption: boolean;
}

export interface RecordsRequestOptions {
  readonly requesterName: string;
  readonly requesterContact: string;
  /** Dollar ceiling above which the custodian should ask first. Null states none. */
  readonly feeCeilingUsd: number | null;
  readonly parcels: readonly ParcelEvidence[];
  /** What the records concern, e.g. 'temporary construction easement (TCE)'. */
  readonly subjectMatter: string;
  /** Layers the parcels came from, named so the custodian can find them. */
  readonly sourceLayers: readonly string[];
  readonly sourceOrg?: string;
  /**
   * Omit the compensation item entirely — for a follow-up asking only the
   * severable term. Item 1 must stand on its own when it does.
   */
  readonly includeCompensationItem?: boolean;
  readonly purposeNote?: string;
  readonly stateCompliance: StateComplianceEntry;
  readonly now?: Date;
  readonly acquisitionField?: string;
}

export interface RecordsRequestDraft {
  readonly status: 'draft-not-sent';
  readonly notSentBanner: string;
  readonly jurisdictionKey: string;
  readonly custodian: RecordsRequestJurisdictionRule['custodian'];
  readonly subject: string;
  readonly groupA: readonly ClassifiedParcel[];
  readonly groupB: readonly ClassifiedParcel[];
  /** Parcels deliberately NOT asked about, with the reason. */
  readonly excluded: readonly ClassifiedParcel[];
  readonly items: readonly RequestItem[];
  /** False when the rule carries no severability argument. */
  readonly severabilityAsserted: boolean;
  readonly body: string;
  readonly audit: SendAuditRecord;
}

export type RecordsRequestResult = RecordsRequestDraft | UnsupportedJurisdiction;

function parcelList(parcels: readonly ClassifiedParcel[]): string {
  return parcels.map((p) => `${p.parcelId} (${p.layer})`).join(', ');
}

export function buildRecordsRequest(
  jurisdictionKey: string,
  options: RecordsRequestOptions,
): RecordsRequestResult {
  const lookup = lookupJurisdiction(jurisdictionKey);
  // An unsupported jurisdiction returns the explanation unchanged. It does not
  // fall back to the researched rule, which would put a Florida citation in
  // front of a custodian in another state.
  if (lookup.status === 'unsupported') return lookup;
  return buildRequestFromRule(lookup.rule, options);
}

/**
 * Builds from a rule directly, bypassing the registry.
 *
 * Exported because the registry ships exactly one rule, and routing every path
 * through it makes the behaviour that matters most for a SECOND jurisdiction —
 * a rule with no severability argument — unreachable from outside. A branch
 * that cannot be exercised is a branch nobody has checked.
 */
export function buildRequestFromRule(
  rule: RecordsRequestJurisdictionRule,
  options: RecordsRequestOptions,
): RecordsRequestDraft {
  const classified = options.parcels.map((p) =>
    classifyParcel(rule, p, options.acquisitionField ?? 'ACQUIRED'),
  );
  const groupA = classified.filter((p) => p.group === 'A');
  const groupB = classified.filter((p) => p.group === 'B');
  const excluded = classified.filter((p) => p.group === 'not-targetable');

  if (groupA.length === 0 && groupB.length === 0) {
    throw new RecordsRequestError(
      'No targetable parcels. Every parcel supplied either shows an acquisition still in progress ' +
        'or carries no certification date, so nothing indicates the exemption has lapsed. Sending ' +
        'this request would draw a denial and teach the custodian nothing about the next one.',
    );
  }

  const severabilityAsserted =
    rule.valueRecordExemption !== null && rule.valueRecordExemption.severabilityArgument !== null;

  const items: RequestItem[] = [
    {
      number: 1,
      title: `The term of the ${options.subjectMatter}`,
      text:
        'Commencement and expiration dates, or the stated number of months or years. This may ' +
        'appear in the instrument, the acquisition plans, or the parcel sketch.',
      severableFromValueExemption: severabilityAsserted,
    },
  ];
  if (options.includeCompensationItem !== false) {
    items.push({
      number: 2,
      title: `The compensation paid for the ${options.subjectMatter}`,
      text: 'And the document stating it.',
      severableFromValueExemption: false,
    });
  }

  const subject =
    `Public records request — ${options.subjectMatter} terms` +
    `${options.includeCompensationItem === false ? '' : ' and compensation'}` +
    `, ${rule.custodian.name}`;

  const lines: string[] = [];
  lines.push(NOT_SENT_BANNER, '');
  lines.push(`Subject: ${subject}`, '');
  lines.push(`To the Custodian of Public Records, ${rule.custodian.name},`, '');
  lines.push(
    `Under ${rule.statute.cite}, I request copies of records relating to ${options.subjectMatter} ` +
      `parcels shown in the published right-of-way GIS layers ${options.sourceLayers.join(' and ')}` +
      `${options.sourceOrg ? ` (ArcGIS organisation ${options.sourceOrg})` : ''}.`,
    '',
  );

  if (groupA.length > 0) {
    lines.push(
      `Group A — ${rule.targeting.describeGroupA}. Parcels ${parcelList(groupA)}.`,
      '',
    );
  }
  if (groupB.length > 0) {
    lines.push(
      `Group B — ${rule.targeting.describeGroupB}. Parcels ${parcelList(groupB)}.`,
      '',
    );
  }

  lines.push('For each parcel above I request:', '');
  for (const item of items) {
    lines.push(`${item.number}. ${item.title}. ${item.text}`, '');
  }

  if (rule.valueRecordExemption !== null) {
    const ex = rule.valueRecordExemption;
    lines.push(
      `I understand ${ex.cite} exempts ${ex.covers} until ${ex.lapsesWhen}. I have selected these ` +
        'parcels because the agency\'s own published data indicates the right-of-way process has ' +
        'concluded for them. If the exemption nonetheless still applies to any parcel, please:',
      '',
    );
    for (const [i, ask] of rule.withholdingAsks.entries()) {
      lines.push(`(${'abcdefgh'[i]}) ${ask}`);
    }
    lines.push('');

    if (severabilityAsserted && items.length > 1) {
      lines.push(`Item 1 is requested independently of Item 2. ${ex.severabilityArgument}`, '');
    } else if (severabilityAsserted) {
      lines.push(
        `This item is requested independently of any record of value. ${ex.severabilityArgument}`,
        '',
      );
    }
    // Where severabilityArgument is null the split is simply not asserted. No
    // hedged version, no "arguably" — an unsupported legal claim in a request
    // is what turns a slow answer into a denial.
  }

  lines.push(
    options.feeCeilingUsd === null
      ? `Fees. ${rule.feeAdvanceRule}`
      : `Fees. Please advise of any charge before incurring it if the total would exceed ` +
        `$${options.feeCeilingUsd}. ${rule.feeAdvanceRule}`,
    '',
  );
  lines.push('Format. Electronic copies by email, please.', '');
  if (options.purposeNote !== undefined) lines.push(options.purposeNote, '');
  lines.push('Thank you,', options.requesterName, options.requesterContact);

  return {
    status: 'draft-not-sent',
    notSentBanner: NOT_SENT_BANNER,
    jurisdictionKey: rule.key,
    custodian: rule.custodian,
    subject,
    groupA,
    groupB,
    excluded,
    items,
    severabilityAsserted,
    body: lines.join('\n'),
    audit: buildSendAuditRecord({
      letterType: 'records-request',
      stateCompliance: options.stateCompliance,
      now: options.now,
    }),
  };
}
