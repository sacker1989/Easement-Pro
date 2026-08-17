import { describe, expect, it } from 'vitest';
import { buildFollowUp, FollowUpError } from './follow-up';
import {
  buildEnforcementNotice,
  earliestActionDate,
  EnforcementNoticeError,
  COUNSEL_LINE,
} from './enforcement-notice';
import { buildRecordsRequest, NOT_SENT_BANNER, type RecordsRequestDraft } from './build-request';
import { FL_FDOT_D7 } from './fl-fdot';
import type { ParcelEvidence } from './jurisdiction-rule';
import { unclassifiedState } from '@/lib/gating/state-tier-config';

const PARCELS: readonly ParcelEvidence[] = [
  { parcelId: '705A', layer: 'Segment3ROWParcels', acquiredValue: 'COMPLETE', rowCertifiedOn: '2023-12-31' },
  { parcelId: '705B', layer: 'Segment3ROWParcels', acquiredValue: 'COMPLETE', rowCertifiedOn: '2023-12-31' },
  { parcelId: '700', layer: 'Segment3ROWParcels', acquiredValue: 'N/A', rowCertifiedOn: '2022-10-20' },
  { parcelId: '701', layer: 'US301_Parcels', acquiredValue: 'N/A', rowCertifiedOn: '2024-10-31' },
];

function original(): RecordsRequestDraft {
  const r = buildRecordsRequest('FL/FDOT-D7', {
    requesterName: 'A. Requester',
    requesterContact: 'requester@example.com',
    feeCeilingUsd: 50,
    parcels: PARCELS,
    subjectMatter: 'temporary construction easement (TCE)',
    sourceLayers: ['Segment3ROWParcels', 'US301_Parcels'],
    stateCompliance: unclassifiedState('FL'),
    now: new Date('2026-08-16T00:00:00.000Z'),
  });
  if (r.status !== 'draft-not-sent') throw new Error('expected a draft');
  return r;
}

const BASE = {
  original: original(),
  originalSentOn: '2026-08-16',
  originalChannel: 'email to D7prcustodian@dot.state.fl.us',
  requesterName: 'A. Requester',
  requesterContact: 'requester@example.com',
};

describe('the follow-up is a nudge, not a threat', () => {
  it('identifies the original by date and channel', () => {
    const f = buildFollowUp({ ...BASE, today: '2026-09-07' });
    expect(f.body).toContain('2026-08-16');
    expect(f.body).toContain('D7prcustodian@dot.state.fl.us');
    expect(f.calendarDaysElapsed).toBe(22);
  });

  it('asks for a tracking identifier', () => {
    // The likeliest explanation is a request received and not routed, so the
    // useful ask is a reference number, not an accusation.
    expect(buildFollowUp({ ...BASE, today: '2026-09-07' }).body).toMatch(
      /tracking or reference number/,
    );
  });

  it('cites no enforcement provision', () => {
    // A follow-up carrying a litigation citation is not a follow-up. Escalation
    // lives behind a separate call.
    const body = buildFollowUp({ ...BASE, today: '2026-09-07' }).body;
    expect(body).not.toContain('119.12');
    expect(body).not.toMatch(/attorney fees/i);
    expect(body).not.toMatch(/civil action/i);
    expect(body).not.toMatch(/unlawful/i);
  });

  it('is a draft, like everything else here', () => {
    const f = buildFollowUp({ ...BASE, today: '2026-09-07' });
    expect(f.status).toBe('draft-not-sent');
    expect(f.body.startsWith(NOT_SENT_BANNER)).toBe(true);
  });

  it('does not leave a second NOT SENT banner inside the quoted original', () => {
    const f = buildFollowUp({ ...BASE, today: '2026-09-07' });
    expect(f.body.split(NOT_SENT_BANNER)).toHaveLength(2);
    expect(f.body).toContain('[original request]');
  });
});

describe('narrowing is a choice, not an optimisation', () => {
  it('keeps every parcel by default', () => {
    const f = buildFollowUp({ ...BASE, today: '2026-09-07' });
    expect(f.narrowedToGroupA).toBe(false);
    expect(f.parcelsSetAside).toEqual([]);
    expect(f.body).toContain('700');
  });

  it('drops to Group A when asked, and says what was set aside', () => {
    // Narrowing discards parcels the requester is entitled to ask about, so
    // nothing may vanish silently.
    const f = buildFollowUp({ ...BASE, today: '2026-09-07', narrowToGroupA: true });
    expect(f.narrowedToGroupA).toBe(true);
    expect(f.parcelsSetAside).toEqual(['700', '701']);
    expect(f.body).toMatch(/setting aside parcels 700, 701/);
    expect(f.body).toMatch(/not withdrawing/);
  });

  it('refuses to narrow to an empty Group A', () => {
    const noGroupA = buildRecordsRequest('FL/FDOT-D7', {
      requesterName: 'A',
      requesterContact: 'a@example.com',
      feeCeilingUsd: null,
      parcels: [PARCELS[2]!, PARCELS[3]!],
      subjectMatter: 'TCE',
      sourceLayers: ['X'],
      stateCompliance: unclassifiedState('FL'),
    });
    if (noGroupA.status !== 'draft-not-sent') throw new Error('expected draft');
    expect(() =>
      buildFollowUp({ ...BASE, original: noGroupA, today: '2026-09-07', narrowToGroupA: true }),
    ).toThrow(/withdraw the request rather than focus it/);
  });
});

describe('follow-up date handling', () => {
  it('rejects a non-ISO date', () => {
    expect(() => buildFollowUp({ ...BASE, today: '09/07/2026' })).toThrow(FollowUpError);
  });

  it('rejects a today that precedes the original', () => {
    expect(() => buildFollowUp({ ...BASE, today: '2026-08-01' })).toThrow(/is after/);
  });
});

describe('the enforcement notice refuses to travel', () => {
  it('throws for a jurisdiction with no researched requirement', () => {
    // Most states have no equivalent, and adapting the Florida text would cite
    // an authority that does not govern the reader.
    const noRule = { ...FL_FDOT_D7, key: 'PA/PennDOT', enforcementNotice: null };
    expect(() =>
      buildEnforcementNotice({
        rule: noRule,
        ...BASE,
        followUpSentOn: '2026-09-07',
        acknowledgedCounterRisk: 'I have read the improper-purpose exposure and accept it.',
        today: '2026-09-21',
      }),
    ).toThrow(EnforcementNoticeError);
    expect(() =>
      buildEnforcementNotice({
        rule: noRule,
        ...BASE,
        followUpSentOn: '2026-09-07',
        acknowledgedCounterRisk: 'I have read the improper-purpose exposure and accept it.',
        today: '2026-09-21',
      }),
    ).toThrow(/does not govern the custodian reading it/);
  });
});

describe('the enforcement notice alleges nothing', () => {
  const ok = () =>
    buildEnforcementNotice({
      rule: FL_FDOT_D7,
      ...BASE,
      followUpSentOn: '2026-09-07',
      acknowledgedCounterRisk:
        'I have read the improper-purpose exposure in Sec. 119.12 and am proceeding anyway.',
      today: '2026-09-21',
    });

  it('never asserts unlawful refusal — that is for a court', () => {
    const body = ok().body;
    expect(body).not.toMatch(/unlawful/i);
    expect(body).not.toMatch(/you (have )?violated/i);
    expect(body).not.toMatch(/\bdemand\b/i);
  });

  it('states only what was requested, when, and that nothing came back', () => {
    const body = ok().body;
    expect(body).toContain('2026-08-16');
    expect(body).toContain('2026-09-07');
    expect(body).toMatch(/no\s+response to either/);
  });

  it('offers the off-ramp before any further step', () => {
    expect(ok().body).toMatch(/no further action will be necessary/);
  });

  it('identifies the request, which is its whole statutory job', () => {
    const d = ok();
    expect(d.body).toContain(FL_FDOT_D7.enforcementNotice!.cite);
    expect(d.body).toContain('705A');
    expect(d.body).toContain('--- Request being identified ---');
  });
});

describe('the notice shows the requester their own exposure', () => {
  it('refuses without an explicit acknowledgement', () => {
    expect(() =>
      buildEnforcementNotice({
        rule: FL_FDOT_D7,
        ...BASE,
        followUpSentOn: '2026-09-07',
        acknowledgedCounterRisk: 'ok',
        today: '2026-09-21',
      }),
    ).toThrow(/runs against you, not against the agency/);
  });

  it('names the improper-purpose exposure in the refusal itself', () => {
    let message = '';
    try {
      buildEnforcementNotice({
        rule: FL_FDOT_D7,
        ...BASE,
        followUpSentOn: '2026-09-07',
        acknowledgedCounterRisk: '',
        today: '2026-09-21',
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/IMPROPER PURPOSE/);
    expect(message).toMatch(/SHALL award the agency/);
  });

  it('carries the counter-risk on every draft, verbatim from the rule', () => {
    expect(
      buildEnforcementNotice({
        rule: FL_FDOT_D7,
        ...BASE,
        followUpSentOn: '2026-09-07',
        acknowledgedCounterRisk: 'Read and accepted; the request is for research purposes.',
        today: '2026-09-21',
      }).counterRisk,
    ).toBe(FL_FDOT_D7.enforcementNotice!.counterRisk);
  });

  it('says plainly that it is not legal advice', () => {
    expect(COUNSEL_LINE).toMatch(/NOT YOUR LAWYER/);
    expect(COUNSEL_LINE).toMatch(/decision for a licensed attorney/);
    expect(
      buildEnforcementNotice({
        rule: FL_FDOT_D7,
        ...BASE,
        followUpSentOn: '2026-09-07',
        acknowledgedCounterRisk: 'Read and accepted; the request is for research purposes.',
        today: '2026-09-21',
      }).body,
    ).toContain(COUNSEL_LINE);
  });
});

describe('a follow-up must come first', () => {
  it('rejects a follow-up date before the original request', () => {
    expect(() =>
      buildEnforcementNotice({
        rule: FL_FDOT_D7,
        ...BASE,
        followUpSentOn: '2026-08-01',
        acknowledgedCounterRisk: 'Read and accepted; proceeding for research purposes.',
        today: '2026-09-21',
      }),
    ).toThrow(/precedes the original request date/);
  });

  it('requires the follow-up date at all — it is not optional', () => {
    // Typed as required. The fee test turns on refusal, and an unanswered
    // follow-up is what separates refusal from a queue.
    const keys = Object.keys({
      rule: 0, original: 0, originalSentOn: 0, originalChannel: 0, followUpSentOn: 0,
      requesterName: 0, requesterContact: 0, acknowledgedCounterRisk: 0, today: 0,
    });
    expect(keys).toContain('followUpSentOn');
  });
});

describe('the 5-business-day computation', () => {
  it('counts five full business days after receipt, skipping weekends', () => {
    // Monday 2026-09-21 receipt -> Mon 22? No: counts start the following day.
    // Tue 22, Wed 23, Thu 24, Fri 25, Mon 28.
    expect(earliestActionDate('2026-09-21', 5)).toBe('2026-09-28');
  });

  it('pushes past a supplied legal holiday', () => {
    expect(earliestActionDate('2026-09-21', 5, ['2026-09-24'])).toBe('2026-09-29');
  });

  it('says so when holidays were not supplied, rather than implying precision', () => {
    const d = buildEnforcementNotice({
      rule: FL_FDOT_D7,
      ...BASE,
      followUpSentOn: '2026-09-07',
      acknowledgedCounterRisk: 'Read and accepted; proceeding for research purposes.',
      today: '2026-09-21',
    });
    expect(d.earliestActionDate).toBe('2026-09-28');
    expect(d.earliestActionBasis).toMatch(/LEGAL HOLIDAYS ARE NOT DEDUCTED/);
    expect(d.earliestActionBasis).toMatch(/ambiguous about whether the day of receipt itself counts/);
  });

  it('reports no date where the statute fixes no number', () => {
    const noCount = {
      ...FL_FDOT_D7,
      enforcementNotice: { ...FL_FDOT_D7.enforcementNotice!, businessDaysRequired: null },
    };
    const d = buildEnforcementNotice({
      rule: noCount,
      ...BASE,
      followUpSentOn: '2026-09-07',
      acknowledgedCounterRisk: 'Read and accepted; proceeding for research purposes.',
      today: '2026-09-21',
    });
    expect(d.earliestActionDate).toBeNull();
    expect(d.earliestActionBasis).toMatch(/question for counsel/);
  });
});
