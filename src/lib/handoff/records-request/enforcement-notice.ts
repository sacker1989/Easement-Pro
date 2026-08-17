/**
 * The statutory notice that must precede an enforcement action, where a
 * jurisdiction has one.
 *
 * WHAT THIS DOCUMENT DOES AND DOES NOT DO. Under Sec. 119.12, F.S. — the one
 * provision this product has researched — written notice identifying the
 * request, delivered to the custodian at least 5 business days before a civil
 * action is filed, is a PRECONDITION TO RECOVERING FEES if a court later finds
 * the agency unlawfully refused access. It does not compel production. It does
 * not begin litigation. It is not a demand. It preserves an option that cannot
 * be recovered afterwards, and that is the entire reason to send one.
 *
 * IT ALLEGES NOTHING, AND THAT IS DELIBERATE. Whether an agency "unlawfully
 * refused" is a determination A COURT MAKES. A generated document asserting it
 * would be stating a legal conclusion this product cannot reach — the same line
 * `attorney-review.ts` exists to hold — and would hand the agency the opening
 * paragraph of its reply. So the notice states two facts: what was requested
 * and when, and that no response has been received. Nothing else is asserted.
 *
 * THE GUARDS ARE THE FEATURE.
 *
 *   - No rule, no notice. Every jurisdiction but Florida has
 *     `enforcementNotice: null`, and this throws rather than adapting the
 *     Florida text. A notice citing a statute that does not govern the reader
 *     is worse than silence.
 *   - A follow-up must have been sent first. Not an invented waiting period —
 *     the fee test turns on REFUSAL, and an unanswered follow-up is what
 *     distinguishes refusal from a request still sitting in a queue. Sending
 *     this as a first contact would be both premature and self-defeating.
 *   - The counter-risk is rendered every time, never suppressible. The same
 *     section that offers fees awards them AGAINST a requester found to have
 *     an improper purpose. A user shown only the upside has been shown half a
 *     statute.
 *   - An explicit acknowledgement is required on the call, following the
 *     land-class precedent in `rent-intake.ts`: free text, because a boolean
 *     records only that someone clicked past it.
 *
 * THIS IS NOT LEGAL ADVICE AND THE PRODUCT DOES NOT SEND IT. Whether to send a
 * pre-suit notice is a decision for a lawyer. Every draft says so, and every
 * draft is `draft-not-sent`.
 */

import { NOT_SENT_BANNER } from './build-request';
import type { RecordsRequestDraft } from './build-request';
import type { RecordsRequestJurisdictionRule } from './jurisdiction-rule';

export class EnforcementNoticeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnforcementNoticeError';
  }
}

/** Rendered in every notice, above the body. */
export const COUNSEL_LINE =
  'THIS IS A STEP TOWARD LITIGATION AND THIS TOOL IS NOT YOUR LAWYER. Whether to send this notice, ' +
  'and whether to file anything afterwards, is a decision for a licensed attorney in this ' +
  'jurisdiction. This document was assembled from a statute and the dates you supplied; nothing in ' +
  'it is legal advice, and nothing in it has been reviewed by counsel.';

export interface EnforcementNoticeOptions {
  readonly rule: RecordsRequestJurisdictionRule;
  readonly original: RecordsRequestDraft;
  readonly originalSentOn: string;
  readonly originalChannel: string;
  /**
   * Required. A notice sent before any follow-up is premature: the fee test
   * turns on refusal, and an unanswered follow-up is what separates a refusal
   * from a request still in a queue.
   */
  readonly followUpSentOn: string;
  readonly requesterName: string;
  readonly requesterContact: string;
  /** Free text confirming the improper-purpose exposure was read. */
  readonly acknowledgedCounterRisk: string;
  readonly today: string;
  /**
   * Legal holidays in the notice window, ISO dates. The statute excludes them
   * and this module does not know them: supply them, or the computed date is
   * reported as not accounting for holidays.
   */
  readonly legalHolidays?: readonly string[];
}

export interface EnforcementNoticeDraft {
  readonly status: 'draft-not-sent';
  readonly notSentBanner: string;
  readonly counselLine: string;
  readonly cite: string;
  readonly subject: string;
  readonly body: string;
  /** Conservative earliest date the notice period could be satisfied. */
  readonly earliestActionDate: string | null;
  /** How that date was computed, including what it does not account for. */
  readonly earliestActionBasis: string;
  readonly counterRisk: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireIso(label: string, value: string): void {
  if (!ISO_DATE.test(value)) {
    throw new EnforcementNoticeError(`${label} must be an ISO date (YYYY-MM-DD); received "${value}"`);
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * The conservative earliest date the notice period could be satisfied.
 *
 * Counts 5 full business days AFTER the day of receipt. The statute says the
 * period "begins on the day the written notice is received ... and runs until
 * 5 business days have elapsed", which is genuinely ambiguous about whether
 * the receipt day counts. This takes the reading that waits longer, because
 * the cost of waiting an extra day is nothing and the cost of filing a day
 * early is the fee award the notice existed to preserve.
 */
export function earliestActionDate(
  receivedOn: string,
  businessDays: number,
  holidays: readonly string[] = [],
): string {
  const holidaySet = new Set(holidays);
  let cursor = receivedOn;
  let counted = 0;
  while (counted < businessDays) {
    cursor = addDays(cursor, 1);
    if (!isWeekend(cursor) && !holidaySet.has(cursor)) counted += 1;
  }
  return cursor;
}

export function buildEnforcementNotice(
  options: EnforcementNoticeOptions,
): EnforcementNoticeDraft {
  const notice = options.rule.enforcementNotice;
  // No researched rule, no notice. Adapting the Florida text to another state
  // would produce a document citing a statute that does not govern its reader.
  if (notice === null) {
    throw new EnforcementNoticeError(
      `No pre-enforcement notice requirement has been researched for ${options.rule.key}. This ` +
        'product will not adapt another jurisdiction\'s statute: such a notice would cite an ' +
        'authority that does not govern the custodian reading it, and where a state has no such ' +
        'requirement the document accomplishes nothing at all. Ask an attorney in this ' +
        'jurisdiction what, if anything, must precede an enforcement action.',
    );
  }

  requireIso('originalSentOn', options.originalSentOn);
  requireIso('followUpSentOn', options.followUpSentOn);
  requireIso('today', options.today);
  for (const h of options.legalHolidays ?? []) requireIso('legalHolidays entry', h);

  if (options.followUpSentOn < options.originalSentOn) {
    throw new EnforcementNoticeError(
      'The follow-up date precedes the original request date. Check the dates: this notice ' +
        'identifies a specific request and wrong dates defeat its only statutory purpose.',
    );
  }
  if (options.today < options.followUpSentOn) {
    throw new EnforcementNoticeError('today precedes the follow-up date.');
  }

  const ack = options.acknowledgedCounterRisk.trim();
  if (ack.length < 20) {
    throw new EnforcementNoticeError(
      `Refusing to generate this notice without an explicit acknowledgement of the counter-risk. ` +
        `${notice.counterRisk} Supply acknowledgedCounterRisk describing why you are proceeding ` +
        'anyway. This is not a formality: the exposure runs against you, not against the agency.',
    );
  }

  const holidays = options.legalHolidays ?? [];
  const earliest =
    notice.businessDaysRequired === null
      ? null
      : earliestActionDate(options.today, notice.businessDaysRequired, holidays);

  const basis =
    notice.businessDaysRequired === null
      ? `${notice.cite} fixes no number of business days. The waiting period is a question for counsel.`
      : `Counted as ${notice.businessDaysRequired} full business days after the date of RECEIPT, ` +
        `assuming receipt on ${options.today}. Weekends are excluded. ` +
        (holidays.length === 0
          ? 'LEGAL HOLIDAYS ARE NOT DEDUCTED — none were supplied, and this module does not know ' +
            'this jurisdiction\'s holiday calendar. Any holiday in the window pushes the date later.'
          : `Legal holidays deducted: ${holidays.join(', ')}.`) +
        ' The statute is ambiguous about whether the day of receipt itself counts; this takes the ' +
        'reading that waits longer.';

  const subject = `Notice under ${notice.cite} — ${options.original.subject}`;

  const lines: string[] = [NOT_SENT_BANNER, '', COUNSEL_LINE, ''];
  lines.push(`Subject: ${subject}`, '');
  lines.push(`To ${notice.recipient}, ${options.original.custodian.name},`, '');
  lines.push(
    `This is written notice under ${notice.cite} identifying ${notice.mustIdentify} described ` +
      'below.',
    '',
  );
  // Two facts, no characterisation. What was asked and when; that nothing came
  // back. The conclusion the statute turns on belongs to a court.
  lines.push(
    `On ${options.originalSentOn} I submitted a public records request by ` +
      `${options.originalChannel}, with the subject "${options.original.subject}". It concerned ` +
      `parcels ${[...options.original.groupA, ...options.original.groupB]
        .map((p) => p.parcelId)
        .join(', ')}. On ${options.followUpSentOn} I sent a follow-up. To date I have received no ` +
      'response to either.',
    '',
  );
  lines.push(
    'I would prefer to resolve this without any further step. If the records can be produced, or ' +
      'if you can tell me the status of the request or the statutory basis for any withholding, ' +
      'please do so and no further action will be necessary.',
    '',
  );
  lines.push('--- Request being identified ---', '');
  lines.push(options.original.body.replace(NOT_SENT_BANNER, '[original request]').trimStart(), '');
  lines.push('Thank you,', options.requesterName, options.requesterContact);

  return {
    status: 'draft-not-sent',
    notSentBanner: NOT_SENT_BANNER,
    counselLine: COUNSEL_LINE,
    cite: notice.cite,
    subject,
    body: lines.join('\n'),
    earliestActionDate: earliest,
    earliestActionBasis: basis,
    // Carried out of the rule verbatim, on every draft, unsuppressible.
    counterRisk: notice.counterRisk,
  };
}
