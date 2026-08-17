/**
 * A follow-up to a request that has gone unanswered.
 *
 * WHY THIS EXISTS AT ALL. `responseDeadlineRule` on the Florida rule correctly
 * records that Chapter 119 fixes no day count — the only permitted delay is the
 * reasonable time to retrieve and redact. Correct, and useless on its own: a
 * user holding that sentence has been told to wait indefinitely with no next
 * move. The product generated the ask and then abandoned them at the point
 * where something actually needed doing.
 *
 * WHAT A FOLLOW-UP IS FOR, AND WHAT IT IS NOT. It is an administrative nudge
 * that assumes the likeliest explanation: a request that was received and not
 * routed. It asks for a tracking identifier, restates the request so it can be
 * located, and offers to NARROW the ask. It does not threaten, does not cite
 * an enforcement provision, and does not allege anything. Escalation lives in
 * `enforcement-notice.ts`, deliberately behind a separate call, because a
 * follow-up that carries a litigation citation is not a follow-up.
 *
 * NARROWING IS THE POINT. Where the original split Group A from Group B, the
 * follow-up can drop to Group A alone — the parcels carrying the agency's own
 * completion flag, where no exemption analysis is even contested. A custodian
 * weighing a large ask against a small one answers the small one.
 */

import type { RecordsRequestDraft } from './build-request';
import { NOT_SENT_BANNER } from './build-request';

export class FollowUpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FollowUpError';
  }
}

export interface FollowUpOptions {
  /** The request being followed up on. */
  readonly original: RecordsRequestDraft;
  /** ISO date the original was sent. Required — a follow-up must identify it. */
  readonly originalSentOn: string;
  /** How it was sent, e.g. 'email to D7prcustodian@dot.state.fl.us'. */
  readonly originalChannel: string;
  readonly requesterName: string;
  readonly requesterContact: string;
  /**
   * Restate the ask as Group A only. Defaults to false: narrowing discards
   * parcels the requester is entitled to ask about, so it is a choice they
   * make rather than an optimisation applied on their behalf.
   */
  readonly narrowToGroupA?: boolean;
  /** ISO date this follow-up is written. */
  readonly today: string;
}

export interface FollowUpDraft {
  readonly status: 'draft-not-sent';
  readonly notSentBanner: string;
  readonly subject: string;
  readonly body: string;
  /** Calendar days since the original was sent. Not business days. */
  readonly calendarDaysElapsed: number;
  readonly narrowedToGroupA: boolean;
  /** Present when narrowing dropped parcels, so nothing vanishes silently. */
  readonly parcelsSetAside: readonly string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function buildFollowUp(options: FollowUpOptions): FollowUpDraft {
  for (const [label, value] of [
    ['originalSentOn', options.originalSentOn],
    ['today', options.today],
  ] as const) {
    if (!ISO_DATE.test(value)) {
      throw new FollowUpError(`${label} must be an ISO date (YYYY-MM-DD); received "${value}"`);
    }
  }

  const elapsed = daysBetween(options.originalSentOn, options.today);
  if (elapsed < 0) {
    throw new FollowUpError(
      `The original was sent on ${options.originalSentOn}, which is after ${options.today}.`,
    );
  }

  const narrow = options.narrowToGroupA === true;
  const { groupA, groupB } = options.original;
  if (narrow && groupA.length === 0) {
    throw new FollowUpError(
      'Cannot narrow to Group A: the original request had no Group A parcels. Group A is the set ' +
        'carrying the agency\'s own completion flag, and narrowing to an empty set would withdraw ' +
        'the request rather than focus it.',
    );
  }

  const setAside = narrow ? groupB.map((p) => p.parcelId) : [];
  const asked = narrow ? groupA : [...groupA, ...groupB];

  const subject = `Follow-up: ${options.original.subject}`;

  const lines: string[] = [NOT_SENT_BANNER, ''];
  lines.push(`Subject: ${subject}`, '');
  lines.push(`To the Custodian of Public Records, ${options.original.custodian.name},`, '');
  lines.push(
    `On ${options.originalSentOn} I sent the public records request below by ` +
      `${options.originalChannel}. As of ${options.today} I have not received a response. I am ` +
      'writing to confirm it was received and to ask how it is progressing.',
    '',
  );
  lines.push(
    'If it would help, please send a tracking or reference number I can cite in any further ' +
      'correspondence.',
    '',
  );

  if (narrow) {
    // The narrowest defensible ask. Group A rests on the agency's own flag, so
    // there is no exemption question left to argue about.
    lines.push(
      `To make this as easy as possible to answer, I am narrowing the request to the following ` +
        `parcels only: ${asked.map((p) => `${p.parcelId} (${p.layer})`).join(', ')}. These are the ` +
        'parcels the Department\'s own published data marks as complete.',
      '',
    );
    if (setAside.length > 0) {
      lines.push(
        `I am setting aside parcels ${setAside.join(', ')} for now. I am not withdrawing that ` +
          'part of the request and may renew it separately.',
        '',
      );
    }
  } else {
    lines.push(
      `The request concerns parcels ${asked.map((p) => p.parcelId).join(', ')}.`,
      '',
    );
  }

  lines.push(
    'If any part is unclear or the scope is burdensome, I am glad to narrow it further. A ' +
      'spreadsheet of the requested fields remains preferable to copies of the underlying ' +
      'documents if that is faster or cheaper to produce.',
    '',
  );
  lines.push('--- Original request follows ---', '');
  // The original body carries its own NOT SENT banner. Stripping it here would
  // leave the quoted copy looking like something that was sent as-is.
  lines.push(options.original.body.replace(NOT_SENT_BANNER, '[original request]').trimStart(), '');
  lines.push('Thank you,', options.requesterName, options.requesterContact);

  return {
    status: 'draft-not-sent',
    notSentBanner: NOT_SENT_BANNER,
    subject,
    body: lines.join('\n'),
    calendarDaysElapsed: elapsed,
    narrowedToGroupA: narrow,
    parcelsSetAside: setAside,
  };
}
